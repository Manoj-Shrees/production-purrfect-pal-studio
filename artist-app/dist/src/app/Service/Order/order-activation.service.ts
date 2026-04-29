import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrderActivationService {

  constructor(private http: HttpClient) {}

  /**
   * Accepts an order by setting its status to 'active' and assigning the artist.
   *
   * PUT /order/active/:orderId
   * body: { artist_id }
   *
   * The backend controller reads artist_id from req.body and calls
   * SetOrderactive(artist_id, order_id) followed by SyncOrderStatus.
   */
  updatetoactive(orderId: string, artistId: number): Observable<any> {
    return this.http.put(
      `${baseurl}/order/active/${orderId}`,
      { artist_id: artistId },
      { headers }
    );
  }
}