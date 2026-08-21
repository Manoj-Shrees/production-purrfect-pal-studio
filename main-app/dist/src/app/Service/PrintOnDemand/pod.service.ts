import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { baseurl, headers } from '../servicebasemodel';
import { Observable } from 'rxjs';

export interface CreatePendingOrderRequest {
  userName:           string;
  email:              string;
  /** Always pass null when no image exists yet — never pass an empty string. */
  imageURL?:          string | null;
  /** Full order total (items + delivery). Always required — never default to 0. */
  price:              number;
  /** Delivery cost only. Always required — never default to 0. */
  shipping_charge:    number;
  estimated_delivery: string;
  itemType?:          string;
  notes?:             string;
}

export interface PODOrderResponse {
  message: string;
  data: {
    orderID:           string;
    userName:          string;
    email:             string | null;
    imageURL:          string | null;
    previewImageURL:   string | null;
    itemType:          string;
    status:            string;
    price:             string;
    shippingCharge:    string;
    trackingNumber:    string;
    courierName:       string;
    estimatedDelivery: string | null;
    notes:             string;
    createdAt:         string;
    updatedAt:         string;
    [key: string]: any;
  };
}

export interface PODDeleteResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class PODService {

  constructor(private http: HttpClient) {}

  // ── Create a shell order before payment (no image yet) ────────────────────
  createPendingOrder(data: CreatePendingOrderRequest): Observable<PODOrderResponse> {
    console.log('[POD] Creating pending order:', data);
    return this.http.post<PODOrderResponse>(
      `${baseurl}/printondemand/create`,
      { ...data, status: 'Pending', orderID: '' },
      { headers }
    );
  }

  // ── Update the customer reference photo after file upload ─────────────────
  // Route: PUT /printondemand/:orderID/image  (updatePrintondemandImageURL in controller)
  updateOrderImage(podOrderId: string, imageURL: string): Observable<PODOrderResponse> {
    console.log('[POD] Patching customer image URL for order:', podOrderId);
    return this.http.put<PODOrderResponse>(
      `${baseurl}/printondemand/${podOrderId}/image`,
      { imageURL },
      { headers }
    );
  }

  // ── Update the admin-generated mockup / preview image ────────────────────
  // Route: PUT /printondemand/update/:orderID/preview-image
  updatePreviewImage(podOrderId: string, previewImageURL: string): Observable<PODOrderResponse> {
    console.log('[POD] Updating preview image URL for order:', podOrderId);
    return this.http.put<PODOrderResponse>(
      `${baseurl}/printondemand/update/${podOrderId}/preview-image`,
      { previewImageURL },
      { headers }
    );
  }

  // ── Advance order status ──────────────────────────────────────────────────
  // Route: PUT /printondemand/update/:orderID/advance
  // Call this after the image patch so the order moves Pending → Order Generated.
  confirmPodOrder(podOrderId: string): Observable<PODOrderResponse> {
    console.log('[POD] Confirming order (advancing status):', podOrderId);
    return this.http.put<PODOrderResponse>(
      `${baseurl}/printondemand/update/${podOrderId}/advance`,
      {},
      { headers }
    );
  }

  // ── Fetch a single order ──────────────────────────────────────────────────
  getPodOrder(podOrderId: string): Observable<PODOrderResponse> {
    console.log('[POD] Fetching order:', podOrderId);
    return this.http.get<PODOrderResponse>(
      `${baseurl}/printondemand/${podOrderId}`,
      { headers }
    );
  }

  // ── Delete an order by ID ─────────────────────────────────────────────────
  deletePodOrder(podOrderId: string): Observable<PODDeleteResponse> {
    console.log('[POD] Deleting order:', podOrderId);
    return this.http.delete<PODDeleteResponse>(
      `${baseurl}/printondemand/${podOrderId}`,
      { headers }
    );
  }
}