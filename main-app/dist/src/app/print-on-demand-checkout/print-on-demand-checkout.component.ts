import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import LZString from 'lz-string';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  CheckoutForm,
  COUNTRIES,
  DEFAULT_ITEM_TYPE,
  DELIVERY_OPTIONS,
  MAX_IMAGE_FILE_SIZE,
  OrderItem,
} from './util/checkout.types';
import { PODService }        from '../Service/PrintOnDemand/pod.service';
import { ToastService }      from '../Service/common/toast.service';
import { ProductService }    from '../Service/ProductPage/product.service';
import { LoadingService }    from '../Service/Loader/loading.service';
import { AuthService }       from '../Service/User/auth.service';
import { PodSessionService } from '../Service/PrintOnDemand/pod-session.service';
import { MyCartService } from '../Service/MyCartPage/my-cart.service';

@Component({
  selector: 'app-print-on-demand-checkout',
  standalone: false,
  templateUrl: './print-on-demand-checkout.component.html',
  styleUrl: './print-on-demand-checkout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintOnDemandCheckoutComponent implements OnChanges, OnInit {


  @HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent): void {
  // Only auto-close on mobile (≤720px) when summary is open
  if (window.innerWidth > 720 || !this.summaryOpen) return;

  const target = event.target as HTMLElement;
  const summaryCol = target.closest('.summary-col');
  if (!summaryCol) {
    this.summaryOpen = false;
    this.cdRef.markForCheck();
  }
}

  // ── Inputs ───────────────────────────────────────────────────────────────
  @Input() open = false;
  @Input() items: OrderItem[] = [];
  @Input() selectedFile: File | null = null;
  @Input() userId = '';
  @Input() username = '';
  @Input() initialForm: any | null = null;

  // ── Outputs ──────────────────────────────────────────────────────────────
  @Output() closed    = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<{ form: CheckoutForm; total: number }>();

  // ── Constants ────────────────────────────────────────────────────────────
  readonly deliveryOptions = DELIVERY_OPTIONS;
  readonly countries       = COUNTRIES;
  readonly MAX_FILE_SIZE   = MAX_IMAGE_FILE_SIZE;

  // ── Country → dial code map ──────────────────────────────────────────────
  readonly DIAL_CODES: Record<string, string> = {
    'Afghanistan': '+93',  'Albania': '+355',  'Algeria': '+213',
    'Argentina':   '+54',  'Australia': '+61', 'Austria': '+43',
    'Bangladesh':  '+880', 'Belgium': '+32',   'Brazil': '+55',
    'Canada':      '+1',   'Chile': '+56',     'China': '+86',
    'Colombia':    '+57',  'Croatia': '+385',  'Czech Republic': '+420',
    'Denmark':     '+45',  'Egypt': '+20',     'Finland': '+358',
    'France':      '+33',  'Germany': '+49',   'Ghana': '+233',
    'Greece':      '+30',  'Hong Kong': '+852','Hungary': '+36',
    'India':       '+91',  'Indonesia': '+62', 'Iran': '+98',
    'Iraq':        '+964', 'Ireland': '+353',  'Israel': '+972',
    'Italy':       '+39',  'Japan': '+81',     'Jordan': '+962',
    'Kenya':       '+254', 'South Korea': '+82','Kuwait': '+965',
    'Lebanon':     '+961', 'Malaysia': '+60',  'Mexico': '+52',
    'Morocco':     '+212', 'Netherlands': '+31','New Zealand': '+64',
    'Nigeria':     '+234', 'Norway': '+47',    'Pakistan': '+92',
    'Peru':        '+51',  'Philippines': '+63','Poland': '+48',
    'Portugal':    '+351', 'Qatar': '+974',    'Romania': '+40',
    'Russia':      '+7',   'Saudi Arabia': '+966','Singapore': '+65',
    'South Africa':'+27',  'Spain': '+34',     'Sri Lanka': '+94',
    'Sweden':      '+46',  'Switzerland': '+41','Taiwan': '+886',
    'Thailand':    '+66',  'Turkey': '+90',    'Ukraine': '+380',
    'United Arab Emirates': '+971', 'United Kingdom': '+44',
    'United States': '+1', 'Vietnam': '+84',   'Zimbabwe': '+263',
  };

  private readonly _sortedDialCodes: string[] = [
    ...new Set(Object.values(this.DIAL_CODES))
  ].sort((a, b) => b.length - a.length);

  private _extractDialCode(fullPhone: string): { code: string; local: string } | null {
    if (!fullPhone.startsWith('+')) return null;
    for (const code of this._sortedDialCodes) {
      if (fullPhone.startsWith(code)) {
        return { code, local: fullPhone.slice(code.length).trim() };
      }
    }
    return null;
  }

  // ── Step state ───────────────────────────────────────────────────────────
  step = 1;
  readonly STEPS = [
    { n: 1, label: 'Contact' },
    { n: 2, label: 'Address' },
    { n: 3, label: 'Delivery' },
  ];

  // ── Phone ────────────────────────────────────────────────────────────────
  phoneCode = '+61';
  get fullPhone(): string { return `${this.phoneCode}${this.form.phone.trim()}`; }

  // ── Form model ───────────────────────────────────────────────────────────
  form: CheckoutForm = {
    email: '', phone: '', firstName: '', lastName: '',
    address: '', apartment: '', city: '', state: '',
    postcode: '', country: 'Australia', delivery: 'standard',
  };

  // ── UI flags ─────────────────────────────────────────────────────────────
  touched      = false;
  isSubmitting = false;
  summaryOpen  = true;

  // ── Upload progress label shown in the UI ────────────────────────────────
  // Lets the template show a contextual message during the multi-step proceed().
  uploadStepLabel = '';

  // ── Promo Code ───────────────────────────────────────────────────────────
  promoCode = '';
  appliedPromoCode: any = null;
  validatingPromo = false;
  promoError: string | null = null;

  // ── Auth ─────────────────────────────────────────────────────────────────
  private resolvedUserId   = '';
  private resolvedUsername = '';
  isLoggedIn = false;

  // ── Image state ──────────────────────────────────────────────────────────
  internalFile:     File | null    = null;
  previewUrl:       SafeUrl | null = null;
  uploadProgress:   number         = 0;
  uploadedImageUrl: string | null  = null;
  private objectUrl: string | null = null;

  get hasImage(): boolean { return this.internalFile !== null; }

  // ── Address autocomplete ─────────────────────────────────────────────────
  addressSuggestions: any[] = [];
  addressLoading            = false;
  addressConfirmed          = false;
  lastAddressQuery          = '';
  private searchTimer:      any;
  private addressAbortCtrl: AbortController | null = null;

  // ── Validation ───────────────────────────────────────────────────────────
  get step1Valid(): boolean {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email);
    const digits  = this.form.phone.replace(/\D/g, '');
    return emailOk && digits.length >= 5 && digits.length <= 15;
  }

  get step2Valid(): boolean {
    const f = this.form;
    const required = [f.firstName, f.lastName, f.address, f.city, f.state, f.postcode, f.country];
    return required.every(v => v.trim().length > 0) &&
      this.addressConfirmed &&
      /^\d{4}$/.test(f.postcode.trim());
  }

  get currentStepValid(): boolean {
    if (this.step === 1) return this.step1Valid;
    if (this.step === 2) return this.step2Valid;
    return true;
  }

  // ── Order summary ─────────────────────────────────────────────────────────
  get subtotal():      number { return this.items.reduce((s, i) => s + i.price * i.qty, 0); }
  get deliveryPrice(): number { return this.deliveryOptions.find(o => o.value === this.form.delivery)?.price ?? 0; }
  get total():         number { 
    const discountedSubtotal = Math.max(0, this.subtotal - this.promoDiscountAmount);
    return Math.round((discountedSubtotal + this.deliveryPrice) * 100) / 100;
  }
  get formattedTotal():string { return this.total.toFixed(2); }

  constructor(
    private podService:        PODService,
    private productService:    ProductService,
    private loadingService:    LoadingService,
    private toast:             ToastService,
    private router:            Router,
    private cdRef:             ChangeDetectorRef,
    private ngZone:            NgZone,
    private sanitizer:         DomSanitizer,
    private authService:       AuthService,
    private podSessionService: PodSessionService,
    private myCartService:     MyCartService,
  ) {}

  // ── ngOnInit ─────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.authService.checkAuth().subscribe(response => {
      if (response.isAuthenticated && response.user) {
        this.isLoggedIn      = true;
        this.resolvedUserId  = String(response.user.ID ?? response.user.id ?? '');
        this.resolvedUsername = response.user.Name ?? response.user.username ?? '';
      } else {
        this.isLoggedIn     = false;
        this.resolvedUserId = '';
      }
      this.cdRef.markForCheck();
    });
  }

  toggleSummary(): void { this.summaryOpen = !this.summaryOpen; this.cdRef.markForCheck(); }

  // ── File picker ──────────────────────────────────────────────────────────
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > this.MAX_FILE_SIZE) {
      this.toast.showToast('error', 'File Too Large',
        `"${file.name}" exceeds 10 MB. Please choose a smaller image.`);
      return;
    }

    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl        = URL.createObjectURL(file);
    this.previewUrl       = this.sanitizer.bypassSecurityTrustUrl(this.objectUrl);
    this.internalFile     = file;
    this.uploadedImageUrl = null;
    this.uploadProgress   = 0;
    this.cdRef.detectChanges();
  }

  removeImage(): void {
    this.internalFile     = null;
    this.previewUrl       = null;
    this.uploadedImageUrl = null;
    this.uploadProgress   = 0;
    if (this.objectUrl) { URL.revokeObjectURL(this.objectUrl); this.objectUrl = null; }
    this.cdRef.markForCheck();
  }

  private scrollToTop(): void {
    setTimeout(() => {
      document.querySelector('.form-section')?.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelector('.panel-body')?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  }

  // ── Navigation ───────────────────────────────────────────────────────────
  next(): void {
    this.touched = true;
    if (!this.currentStepValid) { this.cdRef.markForCheck(); return; }
    this.touched = false;
    this.step++;
    this.cdRef.markForCheck();
    this.scrollToTop();
  }

  back(): void {
    this.touched = false;
    this.step--;
    this.cdRef.markForCheck();
    this.scrollToTop();
  }

  jumpToStep(target: number): void {
    if (target === this.step) return;
    if (target < this.step) {
      this.touched = false;
      this.step = target;
      this.cdRef.markForCheck();
      this.scrollToTop();
      return;
    }
    this.touched = true;
    if (this.step === 1 && target >= 2) {
      if (!this.step1Valid) { this.cdRef.markForCheck(); return; }
      this.step = 2;
      this.touched = false;
      this.scrollToTop();
    }
    if (this.step === 2 && target === 3) {
      if (!this.step2Valid) { this.touched = true; this.cdRef.markForCheck(); return; }
      this.step = 3;
      this.touched = false;
      this.scrollToTop();
    }
    this.cdRef.markForCheck();
  }

  // ── Proceed to payment ────────────────────────────────────────────────────
  //
  // ✅ NEW FLOW (mirrors product page):
  //   1. Upload image to the file server using ProductService.uploadfiles()
  //   2. Get the absolute server URL back
  //   3. Save image blob to IndexedDB (for payment-page preview only)
  //   4. Create the pending order with the real imageURL (never null)
  //   5. Save full session including imageUrl
  //   6. Navigate to /Payment
  //
  // The payment component no longer needs to upload anything — it just
  // advances the status from Pending → Order Generated.
  //
  async proceed(): Promise<void> {
    const effectiveUserId = this.resolvedUserId || this.userId;
    const parsedId        = parseInt(effectiveUserId, 10);

    if (!parsedId || parsedId <= 0) {
      this.toast.showToast('error', 'Login Required', 'Please log in to place a Print-on-Demand order.');
      this.router.navigate(['/Login']);
      return;
    }

    if (!this.hasImage) {
      this.toast.showToast('error', 'Image Required', 'Please upload your image before placing a Print-on-Demand order.');
      return;
    }

    this.touched = true;
    if (!this.currentStepValid) return;
    if (this.isSubmitting)      return;

    this.isSubmitting   = true;
    this.uploadProgress = 0;
    this.cdRef.detectChanges();

    // Snapshot prices before any awaits (getters depend on mutable state)
    const snapshotTotal    = this.total;
    const snapshotDelivery = this.deliveryPrice;
    const snapshotSubtotal = this.subtotal;

    console.log('[POD Checkout] Price snapshot — subtotal:', snapshotSubtotal,
      'delivery:', snapshotDelivery, 'total:', snapshotTotal);

    try {
      // ── Step 1: Upload image to server (same pattern as product page) ────
      this.uploadStepLabel = 'Uploading your image…';
      this.cdRef.detectChanges();

      const serverImageUrl = await this.uploadImageToServer(this.internalFile!);
      console.log('[POD Checkout] Image uploaded to server:', serverImageUrl);

      // ── Step 2: Save blob to IndexedDB for payment-page preview ──────────
      this.uploadStepLabel = 'Saving session…';
      this.uploadProgress  = 85;
      this.cdRef.detectChanges();

      // ── Step 3: Build shipping notes ─────────────────────────────────────
      const f           = this.form;
      const addressLine = [f.address, f.apartment].filter(Boolean).join(', ');
      const cityLine    = [f.city, f.state, f.postcode].filter(Boolean).join(', ');
      const shippingNotes = [
        `Phone: ${this.fullPhone}`,
        `Address: ${addressLine}`,
        `City: ${cityLine}`,
        `Country: ${f.country}`,
        `Delivery: ${this.deliveryOptions.find(o => o.value === f.delivery)?.label ?? f.delivery}`,
      ].join('\n');

      const userName = `${f.firstName} ${f.lastName}`.trim();

      // ── Step 4: Create pending order with the real imageURL ───────────────
      // ✅ imageURL is now a proper server URL — never null in the DB.
      this.uploadStepLabel = 'Creating your order…';
      this.cdRef.detectChanges();

      const podRes = await firstValueFrom(
        this.podService.createPendingOrder({
          userName,
          email:              f.email,
          imageURL:           serverImageUrl,   // ✅ real URL, not null
          price:              snapshotTotal,
          shipping_charge:    snapshotDelivery,
          estimated_delivery: '5–10 business days',
          itemType:           DEFAULT_ITEM_TYPE,
          notes:              shippingNotes,
        })
      );

      const podOrderId: string = podRes?.data?.orderID ?? '';
      if (!podOrderId) throw new Error('Could not reserve your order slot. Please try again.');

      // ── Step 5: Save full session (metadata + blob) ───────────────────────
      await this.podSessionService.saveAll(
        {
          podOrderId,
          form:          { ...f, phone: this.fullPhone },
          items:         this.items,
          total:         snapshotTotal,
          deliveryPrice: snapshotDelivery,
          userId:        parsedId,
          timestamp:     Date.now(),
          imageUrl:      serverImageUrl,    // ✅ persisted for payment component reference
          fileName:      this.internalFile!.name,
          fileSize:      this.internalFile!.size,
          fileType:      this.internalFile!.type,
        },
        this.internalFile!,               // blob saved to IDB for preview
      );

      this.uploadProgress  = 100;
      this.uploadStepLabel = '';
      this.cdRef.detectChanges();

      // ── Step 6: Emit + navigate to /Payment ──────────────────────────────
      const originalPhone = this.form.phone;
      this.form.phone     = this.fullPhone;
      this.submitted.emit({ form: this.form, total: snapshotTotal });
      this.form.phone     = originalPhone;

      const compress = (val: any) => LZString.compressToEncodedURIComponent(JSON.stringify(val));

      const cartItems = this.items.map(i => ({
        name:         i.label,
        price:        i.price,
        qty:          i.qty,
        art_style:    DEFAULT_ITEM_TYPE,
        subject_type: 'pod',
        urls:         { petimg1: '' },
      }));

      const totalCents = Math.round(snapshotTotal * 100);

      const queryParams: any = {
        items:        compress(cartItems),
        totalprice:   compress(totalCents),
        email:        compress(f.email),
        username:     compress(userName),
        userid:       compress(parsedId),
        type:         'pod',
        pod_order_id: podOrderId,
      };

      if (this.appliedPromoCode) {
        queryParams.promo_code = compress(this.appliedPromoCode.code);
      }

      await this.router.navigate(['/Payment'], { queryParams });

    } catch (err: any) {
      console.error('[POD Checkout] proceed error:', err);
      this.toast.showToast('error', 'Checkout Failed', err.message || 'Something went wrong — please try again.');
      this.isSubmitting   = false;
      this.uploadProgress = 0;
      this.uploadStepLabel = '';
      this.cdRef.detectChanges();
    }
  }

  // ── Upload helper — mirrors ProductService usage in product-page.component ──
  //
  // Uses ProductService.uploadfiles() exactly as the product page does:
  //   - FormData with field name 'files'
  //   - Progress events (HttpEventType.UploadProgress + Response)
  //   - getfilebaseurl() to build the absolute URL
  //
  // Maps upload progress into the 0–80% band of the overall progress bar so
  // the remaining 20% can be used for order creation + session save.
  //
  private uploadImageToServer(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      this.productService.uploadfiles([file]).subscribe({
        next: ({ progress, response }) => {
          this.ngZone.run(() => {
            // Map 0–100 upload progress into 0–80% of the overall bar
            this.uploadProgress = Math.min(Math.round(progress * 0.8), 80);
            this.loadingService.setProgress(progress);
            this.cdRef.detectChanges();

            if (progress === 100 && response) {
              const base     = this.productService.getfilebaseurl();
              const filename = response.files?.[0] ?? '';

              if (!filename) {
                reject(new Error('Upload succeeded but no file URL was returned.'));
                return;
              }

              // Normalise slashes — same fix as product page uses for cart URLs
              const serverUrl =
                base.replace(/\/$/, '') + '/' + filename.replace(/^\//, '');

              resolve(serverUrl);
            }
          });
        },
        error: (err) => reject(
          new Error(err?.message ?? 'File upload failed. Please check your connection and try again.')
        ),
      });
    });
  }

  // ── Promo Code Operations ────────────────────────────────────────────────
  applyPromoCode(): void {
    if (this.validatingPromo || this.appliedPromoCode) return;

    // ── Require login before allowing promo code use ──────────────────────
    if (!this.isLoggedIn) {
      this.promoError = 'Please log in to apply a promo code.';
      this.toast.showToast('info', 'Login Required', 'Sign in to unlock promo code discounts.');
      this.cdRef.markForCheck();
      return;
    }

    this.promoError = null;
    const code = this.promoCode.trim();
    if (!code) return;

    this.validatingPromo = true;
    this.cdRef.markForCheck();

    this.myCartService.validatePromoCode(code).subscribe({
      next: (response) => {
        this.validatingPromo = false;
        if (response.success && response.promoCode) {
          this.appliedPromoCode = response.promoCode;
          this.promoError = null;
          this.toast.showToast(
            'success',
            'Promo Code',
            `Code "${response.promoCode.code}" applied! Saving AUD $${this.promoDiscountAmount.toFixed(2)}.`
          );
        } else {
          this.promoError = 'Failed to validate promo code.';
        }
        this.cdRef.markForCheck();
      },
      error: (err) => {
        this.validatingPromo = false;
        console.error('Promo validation error:', err);
        this.promoError = err.error?.message || 'Invalid or expired promo code';
        this.toast.showToast('error', 'Promo Code', this.promoError!);
        this.cdRef.markForCheck();
      }
    });
  }

  removePromoCode(): void {
    this.appliedPromoCode = null;
    this.promoCode = '';
    this.promoError = null;
    this.validatingPromo = false;
    this.cdRef.markForCheck();
    this.toast.showToast('info', 'Promo Code', 'Promo code removed.');
  }

  get promoDiscountAmount(): number {
    if (!this.appliedPromoCode) return 0;
    const sub = this.subtotal;
    if (this.appliedPromoCode.discount_type === 'Percentage') {
      const pct = parseFloat(this.appliedPromoCode.discount_value);
      return sub * (pct / 100);
    } else {
      const fixed = parseFloat(this.appliedPromoCode.discount_value);
      return Math.min(sub, fixed);
    }
  }

  // ── Close ────────────────────────────────────────────────────────────────
  close(): void { this.closed.emit(); }

  @HostListener('document:keydown.escape')
  onEsc(): void { if (this.open) this.close(); }

  // ── Reset on re-open ──────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.step               = 1;
      this.touched            = false;
      this.isSubmitting       = false;
      this.addressConfirmed   = false;
      this.addressSuggestions = [];
      this.summaryOpen        = true;
      this.uploadStepLabel    = '';
      this.promoCode          = '';
      this.appliedPromoCode   = null;
      this.validatingPromo    = false;
      this.promoError         = null;

      if (this.selectedFile && !this.internalFile) {
        if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
        this.internalFile = this.selectedFile;
        this.objectUrl    = URL.createObjectURL(this.selectedFile);
        this.previewUrl   = this.sanitizer.bypassSecurityTrustUrl(this.objectUrl);
      }

      if (this.initialForm) {
        this.form = { ...this.form, ...this.initialForm };
        if (this.form.phone?.startsWith('+')) {
          const extracted = this._extractDialCode(this.form.phone);
          if (extracted) { this.phoneCode = extracted.code; this.form.phone = extracted.local; }
          else             { this.phoneCode = this.DIAL_CODES[this.form.country] ?? '+61'; }
        } else {
          this.phoneCode = this.DIAL_CODES[this.form.country] ?? '+61';
        }
        if (this.initialForm.address?.trim().length > 0) this.addressConfirmed = true;
      } else {
        this.phoneCode = this.DIAL_CODES[this.form.country] ?? '+61';
      }

      this.uploadedImageUrl = null;
      this.uploadProgress   = 0;
      this.cdRef.markForCheck();
    }
  }

  // ── Field error helpers ───────────────────────────────────────────────────
  fieldError(value: string, minLen = 1): boolean { return this.touched && value.trim().length < minLen; }
  emailError():    boolean { return this.touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email); }
  phoneError(): boolean {
    if (!this.touched) return false;
    const d = this.form.phone.replace(/\D/g, '');
    if (this.phoneCode === '+65') {
      return d.length !== 8;
    } else if (this.phoneCode === '+64') {
      return d.length < 8 || d.length > 10;
    }
    // Australia: 9 to 10 digits
    return d.length < 9 || d.length > 10;
  }

  addressError():  boolean { return this.touched && (!this.form.address.trim() || (!this.addressConfirmed && !!this.form.address.trim())); }
  postcodeError(): boolean {
    const pc = this.form.postcode.trim();
    if (!this.touched) return false;
    if (this.form.country === 'Singapore') {
      return !/^\d{6}$/.test(pc);
    }
    return !/^\d{4}$/.test(pc);
  }

  // ── Input sanitisers ─────────────────────────────────────────────────────
  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value.trim();
    const cleanDigits = rawVal.replace(/\D/g, '');

    // Auto-detect and strip country code if pasted/autofilled with country prefix
    if (rawVal.startsWith('+61') || rawVal.startsWith('0061') || (cleanDigits.startsWith('61') && cleanDigits.length >= 10)) {
      this.phoneCode = '+61';
      this.form.country = 'Australia';
      const local = cleanDigits.replace(/^(?:0061|61)/, '');
      this.form.phone = local.slice(0, 10);
    } else if (rawVal.startsWith('+64') || rawVal.startsWith('0064') || (cleanDigits.startsWith('64') && cleanDigits.length >= 10)) {
      this.phoneCode = '+64';
      this.form.country = 'New Zealand';
      const local = cleanDigits.replace(/^(?:0064|64)/, '');
      this.form.phone = local.slice(0, 10);
    } else if (rawVal.startsWith('+65') || rawVal.startsWith('0065') || (cleanDigits.startsWith('65') && cleanDigits.length >= 9)) {
      this.phoneCode = '+65';
      this.form.country = 'Singapore';
      const local = cleanDigits.replace(/^(?:0065|65)/, '');
      this.form.phone = local.slice(0, 8);
    } else {
      const maxLen = this.phoneCode === '+65' ? 8 : 10;
      this.form.phone = cleanDigits.slice(0, maxLen);
    }

    input.value = this.phoneFormatted;
    this.cdRef.markForCheck();
  }

  get phoneFormatted(): string {
    const d = this.form.phone.replace(/\D/g, '');
    if (!d) return '';
    if (this.phoneCode === '+65') {
      if (d.length <= 4) return d;
      return `${d.slice(0, 4)}-${d.slice(4, 8)}`;
    } else if (this.phoneCode === '+64') {
      if (d.length <= 3) return d;
      if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
      return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 10)}`;
    } else {
      if (d.length <= 4) return d;
      if (d.length <= 7) return `${d.slice(0, 4)}-${d.slice(4)}`;
      return `${d.slice(0, 4)}-${d.slice(4, 7)}-${d.slice(7, 10)}`;
    }
  }

  onPhoneCodeChange(code: string): void {
    this.phoneCode = code;
    const countryMap: Record<string, string> = {
      '+61': 'Australia',
      '+64': 'New Zealand',
      '+65': 'Singapore'
    };
    if (countryMap[code]) {
      this.form.country = countryMap[code];
    }
    this.cdRef.markForCheck();
  }

  onPostcodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const maxLen = this.form.country === 'Singapore' ? 6 : 4;
    const clean = input.value.replace(/\D/g, '').slice(0, maxLen);
    if (input.value !== clean) { input.value = clean; this.form.postcode = clean; }
  }

  onNameInput(event: Event, field: 'firstName' | 'lastName'): void {
    const input = event.target as HTMLInputElement;
    const clean = input.value.replace(/[^a-zA-ZÀ-ÿ \-']/g, '');
    if (input.value !== clean) { input.value = clean; this.form[field] = clean; }
    this.cdRef.markForCheck();
  }

  onCountryChange(country: string): void {
    this.form.country = country;
    this.phoneCode    = this.DIAL_CODES[country] ?? '+61';
    this.cdRef.markForCheck();
  }

  @Input() googleApiKey = '';

  private googleAutocompleteService: any = null;
  private googlePlacesService: any = null;
  isGooglePlacesActive = false;

  private initGooglePlacesApi(): void {
    (window as any).gm_authFailure = () => {
      this.ngZone.run(() => {
        this.isGooglePlacesActive = false;
        this.googleAutocompleteService = null;
        this.cdRef.markForCheck();
      });
    };

    const g = (window as any).google;
    if (g && g.maps && g.maps.places) {
      this.isGooglePlacesActive = true;
      if (!this.googleAutocompleteService && g.maps.places.AutocompleteService) {
        try {
          this.googleAutocompleteService = new g.maps.places.AutocompleteService();
        } catch (e) {
          console.warn('Google Places AutocompleteService init error:', e);
        }
      }
      return;
    }

    if (this.googleApiKey && !document.getElementById('google-maps-js-sdk')) {
      const script = document.createElement('script');
      script.id = 'google-maps-js-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.googleApiKey}&libraries=places&loading=async`;
      script.async = true;
      script.onload = () => {
        const loadedG = (window as any).google;
        if (loadedG && loadedG.maps && loadedG.maps.places) {
          this.ngZone.run(() => {
            this.isGooglePlacesActive = true;
            try {
              if (loadedG.maps.places.AutocompleteService) {
                this.googleAutocompleteService = new loadedG.maps.places.AutocompleteService();
              }
            } catch (e) {
              console.warn('Google Places init error:', e);
            }
            this.cdRef.markForCheck();
          });
        }
      };
      script.onerror = () => {
        this.ngZone.run(() => {
          this.isGooglePlacesActive = false;
          this.cdRef.markForCheck();
        });
      };
      document.head.appendChild(script);
    }
  }

  // ── Address autocomplete ──────────────────────────────────────────────────
  onAddressType(value: string): void {
    this.form.address     = value;
    this.lastAddressQuery = value;
    this.addressConfirmed = false;
    this.cdRef.markForCheck();
    this.addressSuggestions = [];
    clearTimeout(this.searchTimer);
    this.addressAbortCtrl?.abort();

    const dualNumMatch = value.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)?\s*([a-zA-Z0-9\-]+)\s*[\/,\s]+\s*(\d+(?:-\d+)?[a-zA-Z]?)\s*/i);
    const slashMatch = value.match(/^([a-zA-Z0-9\-]+)\s*\/\s*(\d+(?:-\d+)?[a-zA-Z]?)/i);
    const prefixMatch = value.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)\s*([a-zA-Z0-9\-]+)/i);

    let typedUnit = '';
    if (dualNumMatch) typedUnit = dualNumMatch[1];
    else if (slashMatch) typedUnit = slashMatch[1];
    else if (prefixMatch) typedUnit = prefixMatch[1];

    if (typedUnit) {
      this.form.apartment = /^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)/i.test(typedUnit) ? typedUnit : `Unit ${typedUnit}`;
    }

    if (value.trim().length < 3) { this.addressLoading = false; return; }
    this.addressLoading  = true;
    this.initGooglePlacesApi();
    this.searchTimer = setTimeout(() => this.searchAddress(value), 300);
  }

  useManualAddress(): void {
    if (!this.form.address.trim()) return;
    const q = this.form.address.trim();

    const dualNumMatch = q.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)?\s*([a-zA-Z0-9\-]+)\s*[\/,\s]+\s*(\d+(?:-\d+)?[a-zA-Z]?)\s*/i);
    const slashMatch = q.match(/^([a-zA-Z0-9\-]+)\s*\/\s*(\d+(?:-\d+)?[a-zA-Z]?)/i);
    const prefixMatch = q.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)\s*([a-zA-Z0-9\-]+)/i);

    let unit = '';
    if (dualNumMatch) unit = dualNumMatch[1];
    else if (slashMatch) unit = slashMatch[1];
    else if (prefixMatch) unit = prefixMatch[1];

    if (unit) {
      this.form.apartment = /^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)/i.test(unit) ? unit : `Unit ${unit}`;
    } else {
      this.form.apartment = '';
    }

    const zipMatch = q.match(/\b(\d{4,6})\b/);
    const stateMatch = q.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i);
    if (zipMatch) this.form.postcode = zipMatch[1];
    if (stateMatch) this.form.state = stateMatch[1].toUpperCase();

    this.addressSuggestions = [];
    this.addressLoading     = false;
    this.addressConfirmed   = true;
    this.cdRef.markForCheck();
  }

  private searchAddress(query: string): void {
    this.lastAddressQuery = query;
    this.addressAbortCtrl = new AbortController();
    const g = (window as any).google;

    if (g && g.maps && g.maps.places) {
      if (!this.googleAutocompleteService) {
        try {
          if (g.maps.places.AutocompleteService) {
            this.googleAutocompleteService = new g.maps.places.AutocompleteService();
          }
        } catch (e) {
          this.searchAddressFallback(query);
          return;
        }
      }
      this.isGooglePlacesActive = true;

      // Extract street address portion if user entered unit prefix (e.g., "Unit 4/12 Smith St" -> "12 Smith St")
      const cleanInput = query.replace(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)?\s*[a-zA-Z0-9\-]+\s*[\/,\s]\s*/i, '').trim();
      const searchQuery = (cleanInput && cleanInput.length >= 3) ? cleanInput : query;

      const request: any = {
        input: searchQuery
      };

      const selectedCountryCode = this.getCountryCode(this.form.country);
      if (selectedCountryCode) {
        request.componentRestrictions = { country: [selectedCountryCode] };
      }

      try {
        if (this.googleAutocompleteService && this.googleAutocompleteService.getPlacePredictions) {
          this.googleAutocompleteService.getPlacePredictions(
            request,
            (predictions: any[], status: any) => {
              this.ngZone.run(() => {
                if (status === g.maps.places.PlacesServiceStatus.OK && predictions && predictions.length) {
                  this.addressSuggestions = predictions.map((p: any) => ({
                    isGoogle: true,
                    place_id: p.place_id,
                    display_name: p.description,
                    main_text: p.structured_formatting?.main_text || p.description,
                    secondary_text: p.structured_formatting?.secondary_text || ''
                  }));
                  this.addressLoading = false;
                  this.cdRef.markForCheck();
                } else {
                  this.searchAddressFallback(query);
                }
              });
            }
          );
          return;
        } else {
          this.searchAddressFallback(query);
          return;
        }
      } catch (e) {
        this.searchAddressFallback(query);
        return;
      }
    }

    this.searchAddressFallback(query);
  }

  private searchAddressFallback(query: string): void {
    const signal = this.addressAbortCtrl?.signal;
    const countryCode = this.getCountryCode(this.form.country) || 'au';
    const cleanInput = query.replace(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)?\s*[a-zA-Z0-9\-]+\s*[\/,\s]\s*/i, '').trim();
    const searchQuery = (cleanInput && cleanInput.length >= 3) ? cleanInput : query;

    const base = 'https://nominatim.openstreetmap.org/search';
    const url = `${base}?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=6&countrycodes=${countryCode}`;

    fetch(url, { signal, headers: { 'Accept-Language': 'en', 'User-Agent': 'PurrfectPalStudio/1.0' } })
      .then(r => r.json())
      .then(results => {
        this.ngZone.run(() => {
          this.addressSuggestions = (results || []).map((r: any) => {
            const a = r.address || {};
            const firstPart = (r.display_name || '').split(',')[0].trim();
            const road = a.road || a.pedestrian || a.street || firstPart.replace(/^(?:\d+[a-zA-Z]?\s*[\/,\s]+\s*)?\d+\s*/, '').trim() || firstPart;

            const dualNumMatch = query.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)?\s*([a-zA-Z0-9\-]+)\s*[\/,\s]+\s*(\d+(?:-\d+)?[a-zA-Z]?)\s*/i);
            const slashMatch = query.match(/^([a-zA-Z0-9\-]+)\s*\/\s*(\d+(?:-\d+)?[a-zA-Z]?)/i);

            let unitNum = '';
            let houseNum = a.house_number || '';

            if (dualNumMatch) {
              unitNum = dualNumMatch[1];
              houseNum = dualNumMatch[2];
            } else if (slashMatch) {
              unitNum = slashMatch[1];
              houseNum = slashMatch[2];
            } else {
              unitNum = query.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)\s*([a-zA-Z0-9\-]+)/i)?.[1] || '';
              if (!houseNum) houseNum = query.match(/\b(\d+(?:-\d+)?)\b/)?.[1] || '';
            }

            let mainText = road;
            if (houseNum && !mainText.startsWith(houseNum)) {
              mainText = `${houseNum} ${mainText}`;
            }
            if (unitNum && !mainText.startsWith(unitNum)) {
              mainText = `${unitNum}/${mainText}`;
            }

            return {
              isGoogle: false,
              place_id: r.place_id,
              display_name: r.display_name,
              main_text: mainText || firstPart,
              secondary_text: r.display_name?.split(',').slice(1).join(',').trim() || '',
              address: r.address
            };
          });
          this.addressLoading = false;
          this.cdRef.markForCheck();
        });
      })
      .catch(err => {
        if ((err as DOMException).name === 'AbortError') return;
        this.ngZone.run(() => {
          this.addressLoading = false;
          this.cdRef.markForCheck();
        });
      });
  }

  pickSuggestion(place: any, typedQuery: string): void {
    const g = (window as any).google;
    const q = typedQuery || this.lastAddressQuery || this.form.address || '';
    const selectedMainText = place.main_text || place.display_name?.split(',')[0] || place.display_name || '';

    const dualNumMatch = q.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)?\s*([a-zA-Z0-9\-]+)\s*[\/,\s]+\s*(\d+(?:-\d+)?[a-zA-Z]?)\s*/i);
    const slashMatch = q.match(/^([a-zA-Z0-9\-]+)\s*\/\s*(\d+(?:-\d+)?[a-zA-Z]?)/i);
    const prefixMatch = q.match(/^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)\s*([a-zA-Z0-9\-]+)/i);

    let initialUnit = '';
    let initialHouse = '';
    if (dualNumMatch) {
      initialUnit = dualNumMatch[1];
      initialHouse = dualNumMatch[2];
    } else if (slashMatch) {
      initialUnit = slashMatch[1];
      initialHouse = slashMatch[2];
    } else if (prefixMatch) {
      initialUnit = prefixMatch[1];
    }

    // 1. Immediately update input field text and clear/update apartment so previous data is not retained!
    if (initialUnit) {
      const formattedUnit = /^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)/i.test(initialUnit) ? initialUnit : `Unit ${initialUnit}`;
      this.form.apartment = formattedUnit;

      let combinedAddr = selectedMainText;
      if (initialHouse && !combinedAddr.includes(initialHouse)) {
        combinedAddr = `${initialHouse} ${combinedAddr.replace(/^(?:\d+(?:-\d+)?[a-zA-Z]?\s*)?/, '')}`;
      }

      if (q.includes('/')) {
        this.form.address = `${initialUnit}/${combinedAddr}`.trim();
      } else if (!combinedAddr.toLowerCase().includes(initialUnit.toLowerCase())) {
        this.form.address = `${formattedUnit}, ${combinedAddr}`.trim();
      } else {
        this.form.address = combinedAddr.trim();
      }
    } else {
      this.form.apartment = ''; // Clear old apartment data
      this.form.address = selectedMainText.trim();
    }

    // Extract suburb, state, postcode immediately from secondary_text if available
    if (place.secondary_text) {
      const secParts = place.secondary_text.split(',');
      const locPart = secParts[0]?.trim() || '';
      if (locPart) {
        const zipMatch = locPart.match(/\b(\d{4,6})\b/);
        const stateMatch = locPart.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i);
        const cityCandidate = locPart.replace(/\b(\d{4,6})\b/, '').replace(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i, '').trim();
        if (cityCandidate) this.form.city = cityCandidate;
        if (stateMatch) this.form.state = stateMatch[1].toUpperCase();
        if (zipMatch) this.form.postcode = zipMatch[1];
      }
    }

    this.addressConfirmed = true;
    this.addressSuggestions = [];
    this.cdRef.markForCheck();

    // 2. Fetch full Google Places details asynchronously to populate city, state, postcode, country
    if (place.isGoogle && g && g.maps && g.maps.places) {
      if (!this.googlePlacesService) {
        const dummyDiv = document.createElement('div');
        this.googlePlacesService = new g.maps.places.PlacesService(dummyDiv);
      }
      this.addressLoading = true;
      this.cdRef.markForCheck();

      this.googlePlacesService.getDetails(
        { placeId: place.place_id, fields: ['address_components', 'formatted_address'] },
        (details: any, status: any) => {
          this.ngZone.run(() => {
            this.addressLoading = false;
            if (status === g.maps.places.PlacesServiceStatus.OK && details) {
              const comps = details.address_components || [];
              let subpremise = '';
              let streetNumber = '';
              let route = '';
              let city = '';
              let state = '';
              let postcode = '';
              let country = '';

              for (const c of comps) {
                const types = c.types || [];
                if (types.includes('subpremise')) subpremise = c.long_name;
                else if (types.includes('premise') && !subpremise) subpremise = c.long_name;
                else if (types.includes('street_number')) streetNumber = c.long_name;
                else if (types.includes('route')) route = c.long_name;
                else if (types.includes('locality') || types.includes('sublocality')) city = c.long_name;
                else if (types.includes('administrative_area_level_1')) state = c.short_name || c.long_name;
                else if (types.includes('postal_code')) postcode = c.long_name;
                else if (types.includes('country')) country = c.long_name;
              }

              const unitNumber = subpremise || initialUnit;
              if (!streetNumber && initialHouse) streetNumber = initialHouse;

              const streetAddress = `${streetNumber} ${route}`.trim() || details.formatted_address.split(',')[0];

              if (unitNumber) {
                const formattedUnit = /^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)/i.test(unitNumber)
                  ? unitNumber
                  : `Unit ${unitNumber}`;
                this.form.apartment = formattedUnit;

                if (q.includes('/')) {
                  this.form.address = `${unitNumber}/${streetAddress}`.trim();
                } else if (!streetAddress.toLowerCase().includes(unitNumber.toLowerCase())) {
                  this.form.address = `${formattedUnit}, ${streetAddress}`.trim();
                } else {
                  this.form.address = streetAddress.trim();
                }
              } else {
                this.form.apartment = ''; // Clear old apartment data
                this.form.address = streetAddress.trim();
              }

              if (city) this.form.city = city;
              if (state) this.form.state = this.normalizeState(state, country);
              if (postcode) this.form.postcode = postcode;
              if (country) {
                this.form.country = country;
                this.phoneCode = this.DIAL_CODES[country] ?? this.phoneCode;
              }
              this.addressConfirmed = true;
            }
            this.addressSuggestions = [];
            this.cdRef.markForCheck();
          });
        }
      );
      return;
    }

    const a = place.address || {};
    let unit = a.subpremise || a.unit || a.flat || a.apartment || initialUnit;
    let houseNumber = a.house_number || a.street_number || initialHouse;

    if (!houseNumber && q) {
      const numMatch = q.match(/(?:unit|apt|suite|flat|\/)?\s*\d*[\s,]+(\d+(?:-\d+)?[a-zA-Z]?)\s+/i) || q.match(/\b(\d+(?:-\d+)?[a-zA-Z]?)\b/);
      if (numMatch && numMatch[1] !== unit) {
        houseNumber = numMatch[1];
      }
    }

    const firstPart = (place.display_name || '').split(',')[0].trim();
    const road = a.road || a.pedestrian || a.street || firstPart.replace(/^(?:\d+[a-zA-Z]?\s*[\/,\s]+\s*)?\d+\s*/, '').trim() || firstPart;
    const baseAddress = `${houseNumber} ${road}`.trim() || road || q;

    if (unit) {
      const formattedUnit = /^(?:unit|apt|apartment|suite|flat|shop|level|floor|\#)/i.test(unit) ? unit : `Unit ${unit}`;
      this.form.apartment = formattedUnit;
      if (q.includes('/')) {
        this.form.address = `${unit}/${baseAddress}`.trim();
      } else if (!baseAddress.toLowerCase().includes(unit.toLowerCase())) {
        this.form.address = `${formattedUnit}, ${baseAddress}`.trim();
      } else {
        this.form.address = baseAddress.trim();
      }
    } else {
      this.form.apartment = ''; // Clear old apartment data
      this.form.address = baseAddress.trim();
    }

    const suburbOrCity = a.suburb || a.locality || a.neighbourhood || a.city_district || a.city || a.town || a.village || '';
    if (suburbOrCity) this.form.city = suburbOrCity;

    const rawState = a.state || a.region || '';
    if (rawState) {
      this.form.state = this.normalizeState(rawState, this.form.country);
    } else if (a.county && (a.county.includes('Sydney') || a.county.includes('George'))) {
      this.form.state = 'NSW';
    }

    const rawPostcode = a.postcode || q.match(/\b\d{4,6}\b/)?.[0] || place.display_name?.match(/\b\d{4,6}\b/)?.[0] || '';
    if (rawPostcode) this.form.postcode = rawPostcode;

    if (a.country) {
      this.form.country = a.country;
      this.phoneCode = this.DIAL_CODES[a.country] ?? this.phoneCode;
    }

    this.addressConfirmed   = true;
    this.addressSuggestions = [];
    this.cdRef.markForCheck();
  }

  private normalizeState(rawState: string, country: string): string {
    if (!rawState) return '';
    const clean = rawState.trim();
    if (clean === 'St George' || clean === 'Saint George') return 'NSW';

    const map: Record<string, string> = {
      'New South Wales': 'NSW',
      'Victoria': 'VIC',
      'Queensland': 'QLD',
      'Western Australia': 'WA',
      'South Australia': 'SA',
      'Tasmania': 'TAS',
      'Australian Capital Territory': 'ACT',
      'Northern Territory': 'NT',
      'Auckland': 'AKL',
      'Wellington': 'WLG',
      'Canterbury': 'CAN'
    };
    return map[clean] || (clean.length <= 4 ? clean.toUpperCase() : '');
  }

  private getCountryCode(countryName: string): string {
    const map: Record<string, string> = {
      'Australia': 'au',
      'New Zealand': 'nz',
      'Singapore': 'sg'
    };
    return map[countryName] || 'au';
  }

  clearSuggestions(): void {
    setTimeout(() => { this.addressSuggestions = []; this.cdRef.markForCheck(); }, 150);
  }
}