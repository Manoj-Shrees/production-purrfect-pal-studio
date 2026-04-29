import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { catchError, Observable, of, switchMap, throwError } from 'rxjs';
import { DatePipe } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private url = baseurl;

  private readonly routeMap: Record<string, string> = {
    ongoing:          'ongoing',
    pending_approval: 'pending-approval',
    completed:        'complete',
    cancelled:        'cancel',
  };

  constructor(private http: HttpClient, private datepipe: DatePipe) {}

  // ── READ ─────────────────────────────────────────────────────────────────

  getorders(id: number): Observable<any> {
    return this.http.get(`${this.url}/order/user/${id}`, { headers }).pipe(
      catchError(e => of(e))
    );
  }

  getordercount(id: number): Observable<any> {
    return this.http.get(`${this.url}/order/count/${id}`, { headers }).pipe(
      catchError(e => of(e))
    );
  }

  getorderbyid(orderId: string): Observable<any> {
    return this.http.get(`${this.url}/order/${orderId}`, { headers }).pipe(
      catchError(e => of({ error: true, message: e?.message }))
    );
  }

  createOrder(bodyData: { payment_intent: string }): Observable<any> {
    return this.http.post(`${baseurl}/order/create`, bodyData, { headers });
  }

  cancelorder(id: string): Observable<any> {
    const data = { end_date: this.datepipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss') };
    return this.http.put(`${this.url}/order/cancel/${id}`, data, { headers }).pipe(
      switchMap(r => of(r)),
      catchError(e => { console.error('Cancel order failed:', e); return throwError(() => e); })
    );
  }

  /**
   * Mark the entire order as complete (artist action).
   * Backend guards this with item-approval validation.
   */
  completeOrder(orderId: string): Observable<any> {
    const data = {
      end_date: this.datepipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    };
    return this.http
      .put(`${this.url}/order/complete/${orderId}`, data, { headers })
      .pipe(catchError(e => of({ error: true, message: e?.message ?? 'Request failed' })));
  }

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
    }
  ): Observable<any> {
    const key     = status.toLowerCase();
    const segment = this.routeMap[key];

    if (!segment) {
      console.error(`[OrderService] No route for status: "${status}"`);
      return of({ error: true, message: `Unsupported status: "${status}"` });
    }

    const body: Record<string, any> = { order_id: orderId };

    if (key === 'completed' || key === 'cancelled') {
      body['end_date'] = this.datepipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss');
    }
    if (key === 'ongoing') {
      if (rejectionReason) body['rejection_reason']       = rejectionReason;
      if (revisionEntry)   body['revision_history_entry'] = revisionEntry;
    }
    if (key === 'pending_approval') {
      if (itemUrls)      body['item_urls']              = itemUrls;
      if (revisionEntry) body['revision_history_entry'] = revisionEntry;
    }

    return this.http
      .put(`${this.url}/order/item/${segment}/${itemIndex}`, body, { headers })
      .pipe(catchError(e => of({ error: true, message: e?.message ?? 'Request failed' })));
  }
}