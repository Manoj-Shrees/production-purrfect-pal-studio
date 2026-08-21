import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ItemService {

  private url = baseurl + '/Items';

  constructor(private http: HttpClient) {}

  // ── Public website ─────────────────────────────────────────────────────────
  // Returns only Items with status = 'approved'.
  // Use this anywhere items are displayed to customers (shop, product page, etc).
  getapproveditems(): Observable<any> {
    return this.http
      .get(this.url + '/approved', { headers })
      .pipe(catchError(err => of(err)));
  }


  // ── Approval actions (customer order detail page) ──────────────────────────
  approveitem(itemId: number | string): Observable<any> {
    return this.http
      .put(`${this.url}/${itemId}/approve`, {}, { headers })
      .pipe(catchError(err => of(err)));
  }

  rejectitem(itemId: number | string): Observable<any> {
    return this.http
      .put(`${this.url}/${itemId}/reject`, {}, { headers })
      .pipe(catchError(err => of(err)));
  }
}