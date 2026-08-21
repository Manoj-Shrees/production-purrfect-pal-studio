import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { baseurl, headers as rawHeaders } from '../servicebasemodel';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { DatePipe } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly url     = baseurl;
  private readonly headers = new HttpHeaders(rawHeaders);

  // Route map for item-level status transitions.
  // Note: 'ongoing' → 'ongoing' is the *basic* path (no revision data).
  //       When a revisionEntry is present the method overrides to
  //       'ongoing-revision' so rejection reason + history entry reach the
  //       correct backend handler.
  private readonly routeMap: Record<string, string> = {
    active:           'active',
    ongoing:          'ongoing',
    pending_approval: 'pending-approval',
    completed:        'complete',
    cancelled:        'cancel',
  };

  constructor(private http: HttpClient, private datepipe: DatePipe) {}

  // ── READ ─────────────────────────────────────────────────────────────────

  getorders(id: number): Observable<any> {
    return this.http.get(`${this.url}/order/user/${id}`, { headers: this.headers }).pipe(
      catchError(e => of(e))
    );
  }

  getordercount(id: number): Observable<any> {
    return this.http.get(`${this.url}/order/count/${id}`, { headers: this.headers }).pipe(
      catchError(e => of(e))
    );
  }

  getorderbyid(orderId: string): Observable<any> {
    return this.http.get(`${this.url}/order/${orderId}`, { headers: this.headers }).pipe(
      catchError(e => of(e))
    );
  }

  // ── WRITE ────────────────────────────────────────────────────────────────

  createOrder(bodyData: { payment_intent: string }): Observable<any> {
    return this.http.post(`${this.url}/order/create`, bodyData, { headers: this.headers });
  }

  /**
   * Transitions an order to refund_pending status.
   * Callers should chain this with createRefundRequest() so the admin
   * refund queue receives a corresponding pending record.
   */
  cancelorder(id: string, reason?: string): Observable<any> {
    const data = {
      end_date: this.datepipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss'),
      status:   'refund_pending',
      reason:   reason?.trim() || 'Order cancelled by user',
    };
    return this.http
      .put(`${this.url}/order/cancel/${id}`, data, { headers: this.headers })
      .pipe(
        catchError(e => {
          console.error('[OrderService] cancelorder failed:', e);
          return throwError(() => e);
        })
      );
  }

  /**
   * Creates a pending entry in the admin refund queue.
   *
   * Must be called immediately after a successful cancelorder() so the
   * admin can see the request in the refund management screen.
   *
   * The backend resolves customer_name and customer_email from the
   * order's User_ID — the client only needs order_id, reason, and amount.
   *
   * @param payload.order_id  The Order_ID string (e.g. "ORD-0001").
   * @param payload.reason    Cancellation reason supplied by the user.
   * @param payload.amount    Total order value used as the refund amount.
   * @param payload.currency  Defaults to 'AUD' if omitted.
   */
  createRefundRequest(payload: {
    order_id: string;
    reason:   string;
    amount:   number;
    currency?: string;
  }): Observable<any> {
    const body = {
      order_id: payload.order_id,
      reason:   payload.reason,
      amount:   payload.amount,
      currency: payload.currency ?? 'AUD',
    };
    return this.http
      .post(`${this.url}/refund/from-order`, body, { headers: this.headers })
      .pipe(
        catchError(e => {
          console.error('[OrderService] createRefundRequest failed:', e);
          // Return a structured error so the caller can distinguish
          // a partial failure (order cancelled but refund record missing)
          return of({ error: true, partial: true, message: e?.message ?? 'Refund record creation failed' });
        })
      );
  }

  /**
   * Transitions a single item to a new status.
   *
   * @param orderId         The Order_ID string (e.g. "ORD-0001").
   * @param itemIndex       Numeric 0-based item index OR the full itemID string.
   * @param status          Target status: 'active' | 'ongoing' | 'pending_approval' |
   *                        'completed' | 'cancelled'.
   * @param rejectionReason Optional rejection reason (used when status = 'ongoing' +
   *                        revision data is provided).
   * @param revisionEntry   Full revision-history snapshot.
   *                        When provided alongside status = 'ongoing', the request is
   *                        routed to /ongoing-revision instead of /ongoing so the
   *                        server records the rejection reason and increments
   *                        revision_count.
   * @param itemUrls        Artwork URLs submitted for approval
   *                        (used when status = 'pending_approval').
   * @param artistId        Artist ID to assign (used when status = 'active').
   *                        Previously smuggled through revisionEntry — now a
   *                        proper dedicated parameter.
   */
  updateItemStatus(
    orderId:          string,
    itemIndex:        number,
    status:           string,
    rejectionReason?: string,
    revisionEntry?:   {
      upload_number:    number;
      img_url:          string;
      file_url:         string | null;
      submitted_at:     string;
      rejected_at?:     string | null;
      rejection_reason: string | null;
      status?:          string;
    },
    itemUrls?: {
      img_url:      string;
      file_url:     string;
      submitted_at: string;
    },
    artistId?: number
  ): Observable<any> {
    const key = status.toLowerCase();

    // When the caller is submitting a revision rejection it passes both
    // 'ongoing' and a revisionEntry. Route these to the dedicated
    // /ongoing-revision endpoint so the server calls
    // SetItemOngoingWithRevision (which increments revision_count and
    // appends to revision_history[]). Without this the rejection reason
    // and history entry were silently discarded by the /ongoing endpoint.
    const isRevisionRejection = key === 'ongoing' && !!revisionEntry;
    const segment = isRevisionRejection
      ? 'ongoing-revision'
      : this.routeMap[key];

    if (!segment) {
      console.error(
        `[OrderService] No backend route for status: "${status}". ` +
        `Allowed: ${Object.keys(this.routeMap).join(', ')}`
      );
      return of({ error: true, message: `Unsupported status: "${status}"` });
    }

    const body: Record<string, any> = { order_id: orderId };

    if (key === 'completed' || key === 'cancelled') {
      body['end_date'] = this.datepipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss');
    }

    if (isRevisionRejection) {
      if (rejectionReason)  body['rejection_reason']       = rejectionReason;
      if (revisionEntry)    body['revision_history_entry'] = revisionEntry;
    }

    if (key === 'pending_approval') {
      if (itemUrls)      body['item_urls']              = itemUrls;
      if (revisionEntry) body['revision_history_entry'] = revisionEntry;
    }

    if (key === 'active' && artistId != null) {
      body['artist_id'] = artistId;
    }

    return this.http
      .put(`${this.url}/order/item/${segment}/${itemIndex}`, body, { headers: this.headers })
      .pipe(catchError(e => of({ error: true, message: e?.message ?? 'Request failed' })));
  }

  overrideOrderStatus(orderId: string, status: string): Observable<any> {
    return this.http.put(`${this.url}/order/override/${orderId}`, { status }, { headers: this.headers }).pipe(
      catchError(e => { console.error('Override order status failed:', e); return throwError(() => e); })
    );
  }

  overrideItemStatus(orderId: string, itemId: string, status: string): Observable<any> {
    return this.http.put(`${this.url}/order/item/override/${itemId}`, { order_id: orderId, status }, { headers: this.headers }).pipe(
      catchError(e => { console.error('Override item status failed:', e); return throwError(() => e); })
    );
  }
}