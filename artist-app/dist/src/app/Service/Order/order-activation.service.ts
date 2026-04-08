import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { catchError, Observable, of, switchMap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrderActivationService {

  private url = baseurl;

  constructor(private http: HttpClient) {}

  // FIX: was calling '/order/orderactive/:id' — that route does not exist.
  // Router registers: PUT /order/active/:id → updateOrderStatustoActive
  updatetoactive(orderId: string): Observable<any> {
    const data = { artist_id: 1 };
    return this.http.put(this.url + '/order/active/' + orderId, data, { headers }).pipe(
      switchMap((response) => of(response)),
      catchError((error) => of(error))
    );
  }
}