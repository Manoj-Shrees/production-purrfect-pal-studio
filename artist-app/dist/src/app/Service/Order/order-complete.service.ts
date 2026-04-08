import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { DatePipe } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class OrderCompleteService {

  private url = baseurl;

  constructor(private http: HttpClient, private datepipe: DatePipe) {}

  // ─── Complete entire order ───────────────────────────────────────────────
  // FIX: was calling '/order/ordercomplete/:id' — that route does not exist.
  // Router registers: PUT /order/complete/:id → updateOrderStatustoComplete
  completeorder(orderId: string): Observable<any> {
    const data = { end_date: this.datepipe.transform(new Date(), 'yyyy-MM-dd HH:mm:ss') };
    return this.http.put(this.url + '/order/complete/' + orderId, data, { headers }).pipe(
      switchMap((response) => of(response)),
      catchError((error) => of(error))
    );
  }

  // ─── Update a single item's status ──────────────────────────────────────
  // Maps the four status values to the four backend routes:
  //   active    → PUT /order/item/active/:itemID
  //   ongoing   → PUT /order/item/ongoing/:itemID
  //   completed → PUT /order/item/complete/:itemID
  //   cancelled → PUT /order/item/cancel/:itemID
  //
  // The body must include order_id so the push-notification wrapper
  // in appRouter.js can attach the correct order reference.
  //
  // itemIndex is used as the itemID here — adjust if your backend stores
  // a dedicated item identifier inside the Orders.items JSON array.
  updateItemStatus(orderId: string, itemIndex: number, newStatus: string): Observable<any> {
    const routeMap: Record<string, string> = {
      active:    'active',
      ongoing:   'ongoing',
      completed: 'complete',
      cancelled: 'cancel',
    };

    const segment = routeMap[newStatus.toLowerCase()];
    if (!segment) {
      console.error(`[OrderCompleteService] Unknown item status: "${newStatus}"`);
      return of({ error: true, message: `Unsupported status: ${newStatus}` });
    }

    const body = { order_id: orderId };

    return this.http
      .put(`${this.url}/order/item/${segment}/${itemIndex}`, body, { headers })
      .pipe(
        switchMap((response) => of(response)),
        catchError((error) => of(error))
      );
  }
}