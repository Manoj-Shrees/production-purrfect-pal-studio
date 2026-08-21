import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { ActivatedRoute, Router, NavigationStart } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import LZString from 'lz-string';
import { ToastService }      from '../Service/common/toast.service';
import { StripeService }     from '../Service/Stripe/stripe.service';
import { PODService }        from '../Service/PrintOnDemand/pod.service';
import { PodSessionService } from '../Service/PrintOnDemand/pod-session.service';
import { CanComponentDeactivate } from '../Service/Guard/pending-payment.guard';
import { hosturl }           from '../Service/servicebasemodel';

type PaymentStatus      = 'idle' | 'cancelled' | 'provider-error' | 'processing' | 'success';
export type PodUploadStatus = 'idle' | 'uploading' | 'done' | 'failed';

const STRIPE_ERROR_MAP: Record<string, { title: string; sub: string }> = {
  payment_intent_unexpected_state: {
    title: 'Session expired',
    sub:   'Your payment session timed out. Please try again.',
  },
  payment_method_provider_decline: {
    title: 'Provider declined',
    sub:   'The payment provider declined this transaction. Try a different method.',
  },
  payment_method_provider_timeout: {
    title: 'Provider unavailable',
    sub:   'The payment service is temporarily down. Try card or another method.',
  },
  processing_error: {
    title: 'Processing error',
    sub:   'Something went wrong on our end. Try again in a moment.',
  },
  card_declined: {
    title: 'Card declined',
    sub:   'Your card was declined. Check your details or try a different card.',
  },
  insufficient_funds: {
    title: 'Insufficient funds',
    sub:   'Your card has insufficient funds. Try a different payment method.',
  },
  expired_card: {
    title: 'Card expired',
    sub:   'Your card has expired. Please use a different card.',
  },
};

@Component({
  selector:    'app-payment',
  standalone:  false,
  templateUrl: './payment.component.html',
  styleUrls:   ['./payment.component.css'],
})
export class PaymentComponent implements CanComponentDeactivate, OnInit, AfterViewInit, OnDestroy {

  /* ── UI state ────────────────────────────────────────────────────────────── */
  isProcessing      = false;
  isPaymentReady    = false;
  hasUnsavedChanges = true;
  paymentMessage    = '';
  zoomOpen          = false;
  isLoaded          = false;

  selectedItemIndex = 0;

  paymentStatus:    PaymentStatus = 'idle';
  cancelNoticeTitle = '';
  cancelNoticeSub   = '';

  showGiftAnim = true;

  /* ── Leave-guard modal ───────────────────────────────────────────────────── */
  showLeaveModal         = false;
  private leaveResolve:  ((value: boolean) => void) | null = null;
  private pendingNavUrl: string | null = null;
  private currentUrl:    string = '';
  private navSub:        Subscription | null = null;
  private guardActive    = false;
  private leaveConfirmed = false;

  /* ── Stripe mount ────────────────────────────────────────────────────────── */
  private pendingStripeMount:   (() => void) | null = null;
  private stripeAlreadyMounted = false;
  private skeletonEl:           HTMLElement | null = null;
  private paramsSub:            Subscription | null = null;

  /* ── Order data ──────────────────────────────────────────────────────────── */
  mycartdata: any[] = [];

  /**
   * totalprice is INTEGER CENTS throughout this component.
   *
   * The cart sends getTotalPriceInCents() — e.g. 799 for AUD $7.99.
   *
   * Rules:
   *   • Pass totalprice directly to Stripe — it is already in cents.
   *   • Use formattedTotalPrice (totalprice / 100) for ALL display in template.
   *   • Never bind totalprice directly to any template expression.
   *   • Never multiply totalprice by 100 before Stripe — already cents.
   *   • Never divide totalprice before Stripe — that would charge the wrong amount.
   */
  totalprice = 0; // INTEGER CENTS — e.g. 799 for AUD $7.99

  email      = '';
  username   = '';
  userid     = '';
  promoCode  = '';

  /* ── POD-specific ────────────────────────────────────────────────────────── */
  isPodOrder = false;
  podOrderId = '';

  podPreviewUrl:    string | null = null;
  podPreviewLoading = false;

  podUploadStatus:   PodUploadStatus = 'idle';
  podUploadProgress: number          = 0;
  podUploadError     = '';

  tempOrderKey: string | null = null;

  private paymentIntentId = '';

  private readonly RETURN_URL = `${hosturl}/OrderComplete`;

  constructor(
    private route:             ActivatedRoute,
    private router:            Router,
    private stripeSvc:         StripeService,
    private toast:             ToastService,
    private ngZone:            NgZone,
    private cdRef:             ChangeDetectorRef,
    private elRef:             ElementRef,
    private podService:        PODService,
    private podSessionService: PodSessionService,
  ) {}

  /* ════════════════════════════════════════════════
     COMPUTED GETTERS
  ════════════════════════════════════════════════ */
  get selectedItem(): any         { return this.mycartdata?.[this.selectedItemIndex] ?? null; }
  get showCancelNotice(): boolean { return this.paymentStatus === 'cancelled' || this.paymentStatus === 'provider-error'; }
  get isPodUploading():   boolean { return this.isPodOrder && (this.podUploadStatus === 'uploading' || this.podUploadStatus === 'done'); }
  get isPodUploadFailed():boolean { return this.isPodOrder && this.podUploadStatus === 'failed'; }

  /**
   * Dollar-formatted total for display ONLY.
   *
   * totalprice is INTEGER CENTS (e.g. 799).
   * Dividing by 100 gives the dollar amount → "7.99".
   *
   * ALWAYS use {{ formattedTotalPrice }} in the template.
   * NEVER use {{ totalprice }} directly in the template — that shows raw cents.
   */
  get formattedTotalPrice(): string {
    return (this.totalprice / 100).toFixed(2);
  }

  /**
   * Per-item price formatted for display.
   *
   * item.price is a dollar float (e.g. 7.99) from the cart payload.
   * item.price_cents is for Stripe only — never display it.
   *
   * ALWAYS use {{ getItemDisplayPrice(item) }} in the template for per-item prices.
   * NEVER use {{ item.price_cents }} or {{ item.price }} directly in the template.
   */
  getItemDisplayPrice(item: any): string {
    const price = parseFloat(item?.price);
    return (isNaN(price) ? 0 : price).toFixed(2);
  }

  selectItem(index: number): void {
    if (this.selectedItemIndex === index) return;
    this.selectedItemIndex = index;
    this.showGiftAnim = false;
    this.cdRef.detectChanges();
    setTimeout(() => { this.showGiftAnim = true; this.cdRef.detectChanges(); }, 60);
  }

  /* ════════════════════════════════════════════════
     IMAGE HELPERS
  ════════════════════════════════════════════════ */

  /**
   * Splits a semicolon-delimited image string into a clean array of URLs.
   * Filters out nulls, empty strings, and the literal string "null".
   */
  splitPetImgs(petimgStr: string | null | undefined): string[] {
    if (!petimgStr || petimgStr === 'null') return [];
    return petimgStr.split(';').filter(s => s && s !== 'null');
  }

  /**
   * Returns true if the given value is a non-empty, non-null URL string.
   */
  private isValidUrl(val: string | null | undefined): boolean {
    return !!val && val !== 'null' && val.trim().length > 0;
  }

  /**
   * Resolves the preview image for the currently selected cart item.
   *
   * Priority order:
   *
   *  For POD orders:
   *    1. podPreviewUrl (blob URL from IndexedDB)
   *
   *  For standard orders, by subject_type:
   *
   *   subject_type === 'yourself'  (person-only portrait):
   *    1. urls.personimg
   *    2. urls.petimg1 (fallback if personimg is missing)
   *
   *   subject_type === 'both'  (pet + person):
   *    1. urls.petimg1  (pet photo takes hero slot)
   *    2. urls.petimg2
   *    3. urls.personimg
   *
   *   subject_type === 'pet' / anything else (pet-only, default):
   *    1. urls.petimg1
   *    2. urls.petimg2
   *    3. urls.petimg3
   *    4. urls.petimg4
   *
   * Returns empty string if nothing resolves — the template renders a placeholder.
   */
  getPreviewImgSrc(): string {
    // ── POD order ──────────────────────────────────────────────────────────
    if (this.isPodOrder) {
      return this.podPreviewUrl ?? '';
    }

    const item = this.selectedItem;
    if (!item) return '';

    const urls        = item.urls ?? {};
    const subjectType = (item.subject_type ?? '').toLowerCase();

    // ── Myself / person-only portrait ──────────────────────────────────────
    if (subjectType === 'yourself') {
      if (this.isValidUrl(urls.personimg))           return urls.personimg;
      // graceful fallback: show pet slot if person image absent
      const petFallback = this.splitPetImgs(urls.petimg1)[0];
      if (petFallback)                               return petFallback;
      return '';
    }

    // ── Pet + myself / Family & Couple ─────────────────────────────────────
    if (subjectType === 'both' || subjectType === 'family') {
      if (this.isValidUrl(urls.personimg)) return urls.personimg;
      for (const slot of ['petimg1', 'petimg2', 'petimg3', 'petimg4']) {
        const first = this.splitPetImgs(urls[slot])[0];
        if (first) return first;
      }
      return '';
    }

    // ── Pet-only (default) ─────────────────────────────────────────────────
    const petSlots = ['petimg1', 'petimg2', 'petimg3', 'petimg4'];
    for (const slot of petSlots) {
      const first = this.splitPetImgs(urls[slot])[0];
      if (first) return first;
    }

    return '';
  }

  /**
   * Returns the person image URL for the selected item, if one exists.
   * Used in the template for the secondary "person" thumbnail in 'both' orders.
   * Returns empty string when not applicable.
   */
  getPersonImgSrc(): string {
    if (this.isPodOrder) return '';
    const item = this.selectedItem;
    if (!item) return '';
    const urls = item.urls ?? {};
    return this.isValidUrl(urls.personimg) ? urls.personimg : '';
  }

  /**
   * Builds a human-readable alt text for the hero preview image.
   *
   * Examples:
   *   "Whiskers portrait"
   *   "Custom Pet & Me Portrait preview"
   *   "Custom Myself Portrait preview"
   *   "Canvas print preview"
   */
  getPreviewAltText(): string {
    if (this.isPodOrder) return 'Canvas print preview';

    const item = this.selectedItem;
    if (!item) return 'Portrait preview';

    const subjectType = (item.subject_type ?? '').toLowerCase();
    const petName     = item.petname && item.petname !== 'null' ? item.petname : null;

    if (subjectType === 'yourself') return 'Custom Myself Portrait preview';
    if (subjectType === 'both')     return petName ? `${petName} & me portrait` : 'Custom Pet & Me Portrait preview';
    if (petName)                    return `${petName} portrait`;

    return item.name ?? 'Portrait preview';
  }

  /* ════════════════════════════════════════════════
     canDeactivate
  ════════════════════════════════════════════════ */
  canDeactivate(): boolean | Promise<boolean> {
    if (this.leaveConfirmed)     return true;
    if (this.isProcessing)       return false;
    if (!this.hasUnsavedChanges) return true;
    return new Promise<boolean>(resolve => {
      this.leaveResolve   = resolve;
      this.showLeaveModal = true;
      this.cdRef.detectChanges();
    });
  }

  /* ════════════════════════════════════════════════
     INTERNAL NAVIGATION INTERCEPTOR
  ════════════════════════════════════════════════ */
  private subscribeToRouterEvents(): void {
    this.currentUrl = this.router.url;
    this.navSub = this.router.events.pipe(
      filter(e => e instanceof NavigationStart)
    ).subscribe((e: NavigationStart) => {
      if (this.guardActive || this.leaveConfirmed || !this.hasUnsavedChanges) return;
      if (this.isProcessing) {
        this.guardActive = true;
        this.router.navigateByUrl(this.currentUrl).finally(() => { this.guardActive = false; });
        return;
      }
      this.pendingNavUrl = e.url;
      this.guardActive   = true;
      this.router.navigateByUrl(this.currentUrl).finally(() => {
        this.guardActive = false;
        this.ngZone.run(() => { this.showLeaveModal = true; this.cdRef.detectChanges(); });
      });
    });
  }

  /* ════════════════════════════════════════════════
     MODAL ACTIONS
  ════════════════════════════════════════════════ */
  onLeaveStay(): void {
    this.showLeaveModal = false;
    this.pendingNavUrl  = null;
    this.leaveResolve?.(false);
    this.leaveResolve   = null;
    this.cdRef.detectChanges();
  }

  async onLeaveConfirm(): Promise<void> {
    this.leaveConfirmed    = true;
    this.hasUnsavedChanges = false;
    this.showLeaveModal    = false;
    this.cdRef.detectChanges();
    this.navSub?.unsubscribe();
    this.navSub = null;
    if (this.tempOrderKey) {
      this.stripeSvc.cancelTempOrder(this.tempOrderKey)
        .catch(err => console.warn('Temp order cleanup failed', err));
    }
    this.leaveResolve?.(true);
    this.leaveResolve = null;
    const dest = this.pendingNavUrl ?? '/';
    this.pendingNavUrl = null;
    await this.router.navigateByUrl(dest);
  }

  dismissCancelNotice(): void { this.paymentStatus = 'idle'; this.cdRef.detectChanges(); }

  /* ════════════════════════════════════════════════
     POD IMAGE PREVIEW
  ════════════════════════════════════════════════ */
  private async loadPodPreviewFromIDB(): Promise<void> {
    this.podPreviewLoading = true;
    this.cdRef.detectChanges();
    try {
      const file = await this.podSessionService.loadImageWithMeta();
      if (file) {
        if (this.podPreviewUrl) URL.revokeObjectURL(this.podPreviewUrl);
        this.ngZone.run(() => {
          this.podPreviewUrl     = URL.createObjectURL(file);
          this.podPreviewLoading = false;
          this.cdRef.detectChanges();
        });
      } else {
        this.ngZone.run(() => { this.podPreviewLoading = false; this.cdRef.detectChanges(); });
      }
    } catch (err) {
      console.warn('[POD] Could not load preview from IndexedDB:', err);
      this.ngZone.run(() => { this.podPreviewLoading = false; this.cdRef.detectChanges(); });
    }
  }

  /* ════════════════════════════════════════════════
     LIFECYCLE — ngOnInit
  ════════════════════════════════════════════════ */
  async ngOnInit(): Promise<void> {
    this.subscribeToRouterEvents();

    this.paramsSub = this.route.queryParams.subscribe(async params => {

      const redirectStatus = params['redirect_status'] as string | undefined;
      if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
        this.setProviderCancel();
      }

      this.isPodOrder = params['type'] === 'pod';
      this.podOrderId = params['pod_order_id'] ?? '';

      if (this.isPodOrder && !this.podOrderId) {
        this.toast.showToast('error', 'Payment', 'Invalid print-on-demand session. Please restart checkout.');
        this.leaveConfirmed = true; this.hasUnsavedChanges = false;
        this.router.navigateByUrl('/');
        return;
      }

      if (this.isPodOrder) this.loadPodPreviewFromIDB();

      if (!params['items']) return;

      try {
        const parsedItems = JSON.parse(LZString.decompressFromEncodedURIComponent(params['items'])) || [];
        this.mycartdata = parsedItems.map((item: any) => {
          let updatedName = item.name;
          if (item.art_style !== 'Ready-Made') {
            if (item.subject_type === 'yourself') {
              updatedName = 'Custom Myself Portrait';
            } else if (item.subject_type === 'both') {
              updatedName = 'Custom Pet & Me Portrait';
            } else if (item.subject_type === 'family') {
              updatedName = 'Custom Family & Couple Portrait';
            } else {
              updatedName = 'Custom Pet Portrait';
            }
          }

          // ── GUARD: urls must be a plain object, not a JSON string ─────────
          // If the cart serialised urls as a string (e.g. JSON.stringify'd twice),
          // parse it here so that item.urls.petimg1 etc. always work correctly
          // both in the preview and in the order payload sent to the backend.
          let urls = item.urls;
          if (typeof urls === 'string') {
            try { urls = JSON.parse(urls); } catch { urls = {}; }
          }
          if (!urls || typeof urls !== 'object') urls = {};

          return { ...item, name: updatedName, urls };
        });

        // ── DECODE totalprice ─────────────────────────────────────────────────
        // Cart sends getTotalPriceInCents() — INTEGER CENTS (e.g. 799).
        //
        // FIX: the decoded value must be validated as a positive integer.
        // If it arrives as a float (e.g. 7.99) that means the cart sent
        // dollars instead of cents — detect and reject rather than silently
        // charging 100× the wrong amount.
        //
        // Stored as-is; passed directly to Stripe without any conversion.
        // For display use formattedTotalPrice (totalprice / 100).
        // ─────────────────────────────────────────────────────────────────────
        const decoded  = LZString.decompressFromEncodedURIComponent(params['totalprice']);
        const rawPrice = +JSON.parse(decoded);

        // Guard 1: must be a finite non-negative number.
        if (!isFinite(rawPrice) || rawPrice < 0) {
          this.toast.showToast('error', 'Payment', 'Invalid order amount. Please restart checkout.');
          this.leaveConfirmed = true; this.hasUnsavedChanges = false;
          this.router.navigateByUrl('/');
          return;
        }

        // Guard 2: must be an integer (cents, not dollars).
        // If rawPrice is a decimal like 7.99 it means the cart accidentally
        // sent the dollar float — reject it to avoid a 100× overcharge.
        if (!Number.isInteger(rawPrice)) {
          console.error(`[Payment] totalprice arrived as a decimal (${rawPrice}). Expected integer cents. Rejecting.`);
          this.toast.showToast('error', 'Payment', 'Invalid order amount. Please restart checkout.');
          this.leaveConfirmed = true; this.hasUnsavedChanges = false;
          this.router.navigateByUrl('/');
          return;
        }

        this.totalprice = rawPrice; // INTEGER CENTS — passed to Stripe as-is

        this.email    = JSON.parse(LZString.decompressFromEncodedURIComponent(params['email']));
        this.username = JSON.parse(LZString.decompressFromEncodedURIComponent(params['username']));
        this.userid   = JSON.parse(LZString.decompressFromEncodedURIComponent(params['userid']));

        if (params['promo_code']) {
          try {
            this.promoCode = JSON.parse(LZString.decompressFromEncodedURIComponent(params['promo_code']));
          } catch (e) {
            console.warn('Failed to parse promo_code query param:', e);
          }
        }

        const parsedUserId = parseInt(this.userid, 10);
        if (!parsedUserId || parsedUserId <= 0) {
          this.toast.showToast('error', 'Payment', 'Session expired. Please log in and try again.');
          this.leaveConfirmed = true; this.hasUnsavedChanges = false;
          this.router.navigateByUrl('/Login');
          return;
        }

        this.selectedItemIndex = 0;

      } catch (parseError) {
        console.error('Failed to parse payment session params', parseError);
        this.toast.showToast('error', 'Payment', 'Invalid or expired payment session. Please restart checkout.');
        this.leaveConfirmed = true; this.hasUnsavedChanges = false;
        this.router.navigateByUrl('/');
        return;
      }

      this.cdRef.detectChanges();

      try {
        // parsedUserId was already computed and validated in the block above.
        // Re-parse from this.userid (which hasn't changed) rather than
        // re-declaring the variable — avoids a redundant parseInt call.
        const parsedUserId = parseInt(this.userid, 10);

        // ── ZERO AMOUNT & PROMO CODE OPTION B CHECK ─────────────────────────────
        if (!this.totalprice || this.totalprice <= 0) {
          if (this.promoCode && this.promoCode.trim().length > 0) {
            // Option B: Process 100% Discount Free Order directly without Stripe
            try {
              const freeResult = await this.stripeSvc.completeFreeOrder({
                totalprice:   0,
                username:     this.username,
                email:        this.email,
                userid:       this.userid,
                order:        this.getOrderData(parsedUserId),
                order_type:   this.isPodOrder ? 'pod' : 'standard',
                pod_order_id: this.isPodOrder ? this.podOrderId : null,
                promo_code:   this.promoCode,
              });

              this.toast.showToast('success', 'Free Order Placed!', '🎉 100% Promo Code Applied! Your order is placed for FREE.');
              this.leaveConfirmed = true;
              this.hasUnsavedChanges = false;
              this.router.navigate(['/OrderComplete'], { 
                queryParams: { 
                  order_id: freeResult.order_id || 'FREE', 
                  payment_intent: 'pi_free_promo_applied' 
                } 
              });
              return;
            } catch (freeErr) {
              console.error('Free order completion failed:', freeErr);
              this.toast.showToast('error', 'Order Error', 'Failed to process 100% promo code free order. Please try again.');
              this.leaveConfirmed = true; 
              this.hasUnsavedChanges = false;
              this.router.navigateByUrl('/Mycart');
              return;
            }
          } else {
            // No promo code attached — manual $0.00 attempt is strictly discarded
            this.toast.showToast('error', 'Payment Aborted', 'Invalid payment amount ($0.00). Zero amount is only allowed with a valid 100% promo code.');
            this.leaveConfirmed = true; 
            this.hasUnsavedChanges = false;
            this.router.navigateByUrl('/Mycart');
            return;
          }
        }

        // ── STRIPE INIT ───────────────────────────────────────────────────────
        // totalprice is INTEGER CENTS — pass directly to Stripe.
        // The backend must use this integer as the PaymentIntent `amount`
        // WITHOUT any multiplication. 799 cents = AUD $7.99 charged.
        // ─────────────────────────────────────────────────────────────────────
        const result = await this.stripeSvc.initStripe(this.totalprice, {
          totalprice:   this.totalprice,   // INTEGER CENTS — Stripe amount
          username:     this.username,
          email:        this.email,
          userid:       this.userid,
          order:        this.getOrderData(parsedUserId),
          order_type:   this.isPodOrder ? 'pod' : 'standard',
          pod_order_id: this.isPodOrder ? this.podOrderId : null,
          promo_code:   this.promoCode || null,
        });

        this.tempOrderKey = result.tempOrderKey;

        this.paymentIntentId = typeof result.clientSecret === 'string'
          ? result.clientSecret.split('_secret_')[0]
          : '';

        this.pendingStripeMount = () => this.mountStripeElements();

        if (this.stripeAlreadyMounted) {
          requestAnimationFrame(() => {
            this.ngZone.run(() => { this.pendingStripeMount?.(); this.pendingStripeMount = null; });
          });
        }
      } catch (error) {
        console.error('Stripe initialization failed', error);
        this.dismissSkeleton();
        this.ngZone.run(() => {
          this.paymentMessage    = 'Payment gateway failed to load — please refresh and try again.';
          this.hasUnsavedChanges = false;
          this.cdRef.detectChanges();
        });
        this.toast.showToast('error', 'Stripe', 'Initialization failed. Please refresh.');
      }
    });
  }

  /* ════════════════════════════════════════════════
     LIFECYCLE — ngAfterViewInit
  ════════════════════════════════════════════════ */
  ngAfterViewInit(): void {
    this.stripeAlreadyMounted = true;
    const skeleton = this.elRef.nativeElement.querySelector('.skeleton-shell') as HTMLElement | null;
    if (skeleton) { this.skeletonEl = skeleton; document.body.appendChild(skeleton); }
    if (this.pendingStripeMount) {
      requestAnimationFrame(() => {
        this.ngZone.run(() => { this.pendingStripeMount?.(); this.pendingStripeMount = null; });
      });
    }
  }

  /* ════════════════════════════════════════════════
     SKELETON DISMISSAL
  ════════════════════════════════════════════════ */
  private dismissSkeleton(): void {
    const el = this.skeletonEl;
    if (el) {
      el.classList.add('skeleton-shell--exit');
      setTimeout(() => {
        el.remove(); this.skeletonEl = null;
        this.ngZone.run(() => { this.isLoaded = true; this.cdRef.detectChanges(); });
      }, 380);
    } else {
      this.ngZone.run(() => { this.isLoaded = true; this.cdRef.detectChanges(); });
    }
  }

  /* ════════════════════════════════════════════════
     RETURN URL BUILDER
  ════════════════════════════════════════════════ */
  private buildReturnUrl(): string {
    const base = typeof window !== 'undefined' ? `${window.location.origin}/OrderComplete` : this.RETURN_URL;
    if (this.isPodOrder && this.podOrderId) {
      return `${base}?type=pod&pod_order_id=${encodeURIComponent(this.podOrderId)}`;
    }
    return base;
  }

  /* ════════════════════════════════════════════════
     STRIPE ELEMENT MOUNTING
  ════════════════════════════════════════════════ */
  private mountStripeElements(): void {
    if (!document.querySelector('#payment-element')) {
      console.warn('PaymentComponent: #payment-element not found — mount skipped');
      return;
    }
    const returnUrl = this.buildReturnUrl();

    this.stripeSvc.mountPaymentElement(
      '#payment-element',
      (complete: boolean) => {
        this.ngZone.run(() => {
          this.isPaymentReady = complete;
          if (!complete) this.paymentMessage = '';
          this.cdRef.detectChanges();
        });
      },
      () => {
        this.ngZone.run(() => {
          this.isProcessing   = false;
          this.paymentMessage = 'Payment details incomplete';
          this.cdRef.detectChanges();
        });
      }
    );

    this.stripeSvc.mountExpressCheckout(
      '#express-checkout-element',
      returnUrl,
      () => this.ngZone.run(() => { this.isProcessing = false; this.setProviderCancel(); this.cdRef.detectChanges(); }),
      () => this.ngZone.run(() => {
        this.isProcessing      = true;
        this.paymentStatus     = 'processing';
        this.hasUnsavedChanges = false;
        this.paymentMessage    = '';
        this.cdRef.detectChanges();
      })
    );

    requestAnimationFrame(() => this.dismissSkeleton());
  }

  /* ════════════════════════════════════════════════
     LIFECYCLE — ngOnDestroy
  ════════════════════════════════════════════════ */
  ngOnDestroy(): void {
    this.navSub?.unsubscribe();    this.navSub    = null;
    this.paramsSub?.unsubscribe(); this.paramsSub = null;
    this.skeletonEl?.remove();     this.skeletonEl = null;
    if (this.podPreviewUrl) { URL.revokeObjectURL(this.podPreviewUrl); this.podPreviewUrl = null; }
    if (this.leaveResolve)  { this.leaveResolve(true); this.leaveResolve = null; }
  }

  /* ════════════════════════════════════════════════
     FORM SUBMIT
  ════════════════════════════════════════════════ */
  async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.isProcessing)   return;
    if (!this.isPaymentReady) {
      this.paymentMessage = 'Please complete all payment details';
      this.cdRef.detectChanges();
      return;
    }

    this.isProcessing      = true;
    this.paymentStatus     = 'processing';
    this.paymentMessage    = '';
    this.cancelNoticeTitle = '';
    this.cancelNoticeSub   = '';
    this.cdRef.detectChanges();

    try {
      const { error } = await this.stripeSvc.confirmPayment(this.buildReturnUrl());

      if (error) {
        this.ngZone.run(() => {
          this.isProcessing = false;
          this.handleStripeError(error);
          this.cdRef.detectChanges();
        });
        return;
      }

      this.ngZone.run(() => {
        this.isProcessing      = false;
        this.isPaymentReady    = false;
        this.hasUnsavedChanges = false;
        this.leaveConfirmed    = true;
        this.paymentStatus     = 'success';
        this.paymentMessage    = 'Payment successful!';
        this.cdRef.detectChanges();
      });

      if (this.isPodOrder && this.podOrderId) {
        await this.handlePostPaymentStatusAdvance();
        return;
      }

      this.navigateToOrderComplete();

    } catch {
      this.ngZone.run(() => {
        this.isProcessing      = false;
        this.paymentStatus     = 'provider-error';
        this.cancelNoticeTitle = 'Unexpected error';
        this.cancelNoticeSub   = 'Something went wrong — please try again or use a different payment method.';
        this.cdRef.detectChanges();
      });
    }
  }

  /* ════════════════════════════════════════════════
     POD — POST-PAYMENT STATUS ADVANCE
  ════════════════════════════════════════════════ */
  async handlePostPaymentStatusAdvance(): Promise<void> {
    this.ngZone.run(() => {
      this.podUploadStatus   = 'uploading';
      this.podUploadProgress = 10;
      this.podUploadError    = '';
      this.cdRef.detectChanges();
    });

    try {
      this.ngZone.run(() => { this.podUploadProgress = 40; this.cdRef.detectChanges(); });

      await this.podService.confirmPodOrder(this.podOrderId).toPromise();
      console.log('[POD] Status advanced to Order Generated:', this.podOrderId);

      this.ngZone.run(() => { this.podUploadProgress = 80; this.cdRef.detectChanges(); });

      await this.podSessionService.clearAll();

      if (this.podPreviewUrl) {
        URL.revokeObjectURL(this.podPreviewUrl);
        this.podPreviewUrl = null;
      }

      this.ngZone.run(() => {
        this.podUploadProgress = 100;
        this.podUploadStatus   = 'done';
        this.cdRef.detectChanges();
      });

      await new Promise(r => setTimeout(r, 900));
      this.navigateToOrderComplete();

    } catch (err: any) {
      console.error('[POD] Post-payment status advance failed:', err);
      this.ngZone.run(() => {
        this.podUploadStatus = 'failed';
        this.podUploadError  = err?.message ?? 'Could not confirm your order. Please contact support.';
        this.cdRef.detectChanges();
      });
    }
  }

  async retryPodUpload(): Promise<void> {
    await this.handlePostPaymentStatusAdvance();
  }

  skipPodUpload(): void {
    this.podSessionService.clearAll().catch(() => {/* ignore */});
    if (this.podPreviewUrl) { URL.revokeObjectURL(this.podPreviewUrl); this.podPreviewUrl = null; }
    this.podUploadStatus = 'idle';
    this.navigateToOrderComplete();
  }

  /* ════════════════════════════════════════════════
     NAVIGATION
  ════════════════════════════════════════════════ */
  private navigateToOrderComplete(): void {
    const params = new URLSearchParams();

    if (this.paymentIntentId) {
      params.set('payment_intent', this.paymentIntentId);
    }
    if (this.isPodOrder && this.podOrderId) {
      params.set('type', 'pod');
      params.set('pod_order_id', this.podOrderId);
    }

    const qs  = params.toString();
    const url = qs ? `/OrderComplete?${qs}` : '/OrderComplete';
    this.router.navigateByUrl(url);
  }

  /* ════════════════════════════════════════════════
     STRIPE ERROR CLASSIFIER
  ════════════════════════════════════════════════ */
  private handleStripeError(error: { code?: string; message?: string }): void {
    const code = error.code ?? '';
    const isSoftCancel =
      code === 'payment_intent_unexpected_state' ||
      code === 'payment_method_provider_decline' ||
      code === 'payment_method_provider_timeout' ||
      code === 'payment_intent_action_required'  ||
      code === 'canceled';
    const mapped = STRIPE_ERROR_MAP[code];

    if (isSoftCancel || mapped) {
      this.paymentStatus     = 'provider-error';
      this.cancelNoticeTitle = mapped?.title ?? 'Payment method unavailable';
      this.cancelNoticeSub   = mapped?.sub   ?? 'This payment method is unavailable. Try card or another method.';
      this.paymentMessage    = '';
      return;
    }

    this.paymentStatus  = 'idle';
    this.paymentMessage = error.message ?? 'Payment failed — please try again.';
  }

  private setProviderCancel(): void {
    this.paymentStatus     = 'cancelled';
    this.cancelNoticeTitle = 'Payment cancelled';
    this.cancelNoticeSub   = 'No charge was made. You can try another payment method below.';
    this.paymentMessage    = '';
  }

  /* ════════════════════════════════════════════════
     PORTRAIT ANIMATION
  ════════════════════════════════════════════════ */
  replayGiftAnim(): void {
    this.showGiftAnim = false;
    this.cdRef.detectChanges();
    setTimeout(() => { this.showGiftAnim = true; this.cdRef.detectChanges(); }, 60);
  }

  /* ════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════ */
  isCustomPortrait(): boolean { return this.selectedItem?.name === 'Custom Portrait Arts'; }
  isPodItem():        boolean { return this.isPodOrder || this.selectedItem?.subject_type === 'pod'; }

  getArtStyle():  string  { return this.selectedItem?.art_style ?? ''; }
  isCanvasItem(): boolean { return this.selectedItem?.art_style === 'Canvas'; }

  getOrderData(user_id: number): string {
    // Each item in mycartdata already carries its urls object (petimg1..4,
    // personimg, custombackgroundimg) — they travel as part of the items array
    // and are read by the backend from items[n].urls.*
    //
    // item_urls is a separate top-level field for final artwork URLs (added
    // later by the admin). A new pending order has none yet → null, not [].
    //
    // user_id must be a number, not a string — the DB schema expects an integer.
    return JSON.stringify({
      items:        this.mycartdata,   // includes urls on every item
      item_urls:    null,              // no final artwork yet on a new order
      start_date:   new Date().toISOString(),
      user_id,                         // number, not String(user_id)
      Status:       'pending',
      order_type:   this.isPodOrder ? 'pod' : 'standard',
      pod_order_id: this.isPodOrder ? this.podOrderId : null,
      promo_code:   this.promoCode || null,
    });
  }
}