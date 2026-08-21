import {
  ChangeDetectorRef,
  Component,
  HostListener,
  OnInit,
  OnDestroy,
  AfterViewInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { catchError, of, Subject, switchMap, take, takeUntil } from 'rxjs';
import { OrderService }        from '../Service/OrderPage/order.service';
import { RouteAccessService }  from '../Service/User/route-access-service.service';
import { SociallinkService }   from '../Service/Sociallinks/sociallink.service';
import { AuthService }         from '../Service/User/auth.service';
import { LoggingService }      from '../Service/Logs/logging.service';
import { ToastService }        from '../Service/common/toast.service';

@Component({
  selector: 'app-order-page',
  standalone: false,
  templateUrl: './order-page.component.html',
  styleUrl: './order-page.component.css',
})
export class OrderPageComponent implements OnInit, OnDestroy, AfterViewInit {

  // ── State ──────────────────────────────────────────────────────
  orderlist:        any[]   = [];
  isLoading         = signal(true);
  showCancelModal   = signal(false);
  isCancelling      = signal(false);
  selectedItemIndex = signal<number>(0);

  // Tracks which order cards have their extra items expanded
  private expandedOrders = new Set<number>();

  // Skeleton placeholder array (3 ghost cards)
  readonly skeletonItems = [1, 2, 3];

  menuOpen   = false;
  innerWidth = window.innerWidth;

  private userId   = 0;
  private destroy$ = new Subject<void>();

  constructor(
    private orderService:   OrderService,
    private authService:    AuthService,
    private accessService:  RouteAccessService,
    private router:         Router,
    private cdRef:          ChangeDetectorRef,
    private loggingService: LoggingService,
    private socialMedia:    SociallinkService,
    private toast:          ToastService,
  ) {}

  ngOnInit(): void {
    // take(1) prevents double-firing if checkAuth() replays more than once
    this.authService.checkAuth()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(response => {
        if (response.isAuthenticated && response.user) {
          this.userId = response.user.ID ?? response.user.user_id;
          this.fetchOrders();
        } else {
          this.router.navigate(['/login']);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngAfterViewInit(): void {}

  @HostListener('window:resize')
  onResize(): void {
    this.innerWidth = window.innerWidth;
    this.cdRef.detectChanges();
  }

  // ── Data ───────────────────────────────────────────────────────

  /** Fetch orders and update list reactively — no page reload needed */
  fetchOrders(): void {
    this.isLoading.set(true);
    this.expandedOrders.clear();
    this.orderService.getorders(this.userId).pipe(
      catchError(err => {
        this.loggingService.error(err);
        this.toast.showToast('error', 'Order List', 'Failed to fetch orders.');
        return of({ Orders: [] });
      }),
      takeUntil(this.destroy$),
    ).subscribe(response => {
      this.orderlist = response.Orders ?? [];
      this.isLoading.set(false);
      this.cdRef.detectChanges();
    });
  }

  // ── Fee & Express Delivery Calculations ──────────────────────────────
  isExpressDelivery(item: any): boolean {
    if (!item) return false;
    const notes = (item.artist_additional_notes || '').toLowerCase();
    if (notes.includes('express') || notes.includes('24h') || notes.includes('rush')) return true;
    const fee = Number(item.additional_fee) || 0;
    if (fee === 15 || fee === 35) return true;
    return false;
  }

  getExpressFee(item: any): number {
    return this.isExpressDelivery(item) ? 15 : 0;
  }

  getCopyrightFee(item: any): number {
    if (!item) return 0;
    const fee = Number(item.additional_fee) || 0;
    if (this.isExpressDelivery(item)) {
      return fee > 15 ? fee - 15 : 0;
    }
    return fee;
  }

  getOrderBaseSubtotal(order: any): number {
    if (!order || !order.items) return 0;
    return order.items.reduce((sum: number, i: any) => sum + (Number(i.price) || 0), 0);
  }

  getOrderCopyrightTotal(order: any): number {
    if (!order || !order.items) return 0;
    return order.items.reduce((sum: number, i: any) => sum + this.getCopyrightFee(i), 0);
  }

  getOrderExpressTotal(order: any): number {
    if (!order || !order.items) return 0;
    return order.items.reduce((sum: number, i: any) => sum + this.getExpressFee(i), 0);
  }

  getActiveCount(): number {
    return this.orderlist.filter(o => o.Status === 'active' || o.Status === 'pending').length;
  }

  getCompletedCount(): number {
    return this.orderlist.filter(o => o.Status === 'completed').length;
  }

  // ── Expand / collapse extra items ──────────────────────────────

  /** Toggle the expanded state for the given order */
  toggleExpand(orderId: number): void {
    if (this.expandedOrders.has(orderId)) {
      this.expandedOrders.delete(orderId);
    } else {
      this.expandedOrders.add(orderId);
    }
    this.cdRef.detectChanges();
  }

  /** Returns true when the extra items panel for this order is open */
  isExpanded(orderId: number): boolean {
    return this.expandedOrders.has(orderId);
  }

  // ── Cancel / refund flow ───────────────────────────────────────
  cancelReason = signal('');

  opencancelmodal(index: number): void {
    this.selectedItemIndex.set(index);
    this.cancelReason.set('');
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    if (!this.isCancelling()) this.showCancelModal.set(false);
  }

  /**
   * Two-step cancel flow:
   *
   * 1. PUT /order/cancel/:id  → sets Orders.Status = 'refund_pending'
   * 2. POST /refund/from-order → inserts a 'pending' row in the refunds
   *    table so the admin refund queue shows the request immediately.
   *
   * Both calls are chained with switchMap. If step 1 fails, step 2 is
   * skipped and an error toast is shown. If step 1 succeeds but step 2
   * returns a partial error, the order is already cancelled so we still
   * show a success toast (the order list refreshes) but log the failure
   * so an admin can reconcile manually if needed.
   */
  cancelorder(): void {
    const order   = this.orderlist[this.selectedItemIndex()];
    const orderId = order.Order_ID as string;

    // Total refund amount = sum of each item's price + additional_fee
    const amount = ((order.items as any[]) ?? []).reduce(
      (sum: number, item: any) =>
        sum + (Number(item.price) || 0) + (Number(item.additional_fee) || 0),
      0
    );

    const reason = this.cancelReason().trim() || 'Order cancelled by user';

    this.isCancelling.set(true);

    this.orderService
      .cancelorder(orderId, reason)
      .pipe(
        // ── Step 2: chain refund record creation ──────────────────
        switchMap(cancelResponse => {
          // If the cancel PUT itself failed (throwError from the service),
          // this block is skipped and the catchError below handles it.
          // But the service already throws, so we guard here for safety.
          if (cancelResponse?.error) {
            return of({ error: true, step: 'cancel' });
          }
          return this.orderService.createRefundRequest({ order_id: orderId, reason, amount });
        }),
        // ── Error boundary ────────────────────────────────────────
        catchError(err => {
          this.loggingService.error(err);
          return of({ error: true, step: 'cancel' });
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(response => {
        this.isCancelling.set(false);
        this.showCancelModal.set(false);

        if (!response?.error) {
          // Both steps succeeded — normal happy path
          this.toast.showToast(
            'success',
            'Refund Requested',
            'Your cancellation and refund request has been submitted for admin approval.'
          );
          this.fetchOrders();
        } else if (response?.partial) {
          // Order was cancelled (status = refund_pending) but the refund
          // queue entry could not be created. The user's order is safe;
          // the admin may need to manually create the refund record.
          this.loggingService.error(
            `[OrderPage] Partial failure for ${orderId}: order cancelled but refund record not created.`
          );
          this.toast.showToast(
            'error',
            'Order Cancelled',
            'Your order was cancelled but there was a problem logging the refund request. Please contact support.'
          );
          this.fetchOrders();
        } else {
          // Cancel itself failed — nothing changed
          this.toast.showToast(
            'error',
            'Request Failed',
            'There was an error submitting your cancellation request. Please try again or contact support.'
          );
        }
      });
  }

  // ── Navigation ─────────────────────────────────────────────────
  openorderdetail(data: any): void {
    this.accessService.allowNextAccess();
    this.router.navigate(['/OrderTracking'], {
      queryParams: { order: encodeURIComponent(JSON.stringify(data)) },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────

  /**
   * Filters the literal string "null" stored by the backend to prevent
   * broken <img src="null"> tags.
   */
  splitPetImgs(petimgStr: string): string[] {
    if (!petimgStr) return [];
    return petimgStr.split(';').filter(s => s && s !== 'null' && s !== 'undefined');
  }

  onImgError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/default_picture.png';
  }

  opensocialurl(pos: number): void {
    this.socialMedia.geturl(pos);
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  isChatVisible = false;
  private chatObserver!: IntersectionObserver;

  scrollToChat(): void {
    const chatEl = document.querySelector('.chat-section');
    if (chatEl) chatEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }


  /**
 * Returns the primary display image for an order item.
 * - 'pet'     → petimg1 only
 * - 'myself'  → personimg only
 * - 'pet+me'  → petimg1 first, fallback to personimg
 */
getPrimaryImage(item: any): string {
  const urls = item?.urls ?? {};
  const subjectType: string = (item?.subject_type ?? '').toLowerCase().trim();

  if (subjectType === 'myself') {
    return this.splitPetImgs(urls.personimg)[0] ?? '';
  }

  if (subjectType === 'pet+me') {
    return (
      this.splitPetImgs(urls.petimg1)[0] ||
      this.splitPetImgs(urls.personimg)[0] ||
      ''
    );
  }

  // default: 'pet'
  return this.splitPetImgs(urls.petimg1)[0] ?? '';
}


}