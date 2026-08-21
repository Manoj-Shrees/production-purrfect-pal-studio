// ═══════════════════════════════════════════════════════════════
// order-tracking.component.ts
//
// Changes in this revision:
//
// Ready-Made auto-complete:
//   isReadyMadeItem getter — true when current item art_style is 'Ready-Made'.
//   autoCompleteReadyMadeItems() — fires after initial load and after every
//     _refreshOrderFromApi() call. For each Ready-Made item that is not yet
//     'completed', it:
//       1. Updates itemStatusMap + orderlist.items[idx].status locally so the
//          template reacts immediately (no flicker).
//       2. Calls orderCompleteService.updateItemStatus() to persist to backend.
//       3. Re-syncs the URL params + restarts canvas animations.
//
// FIX (Bug #3 / #4): _refreshOrderFromApi and autoCompleteReadyMadeItems
//   subscriptions now use takeUntil(destroy$) to prevent detectChanges()
//   calls on a destroyed view.
//
// FIX (Bug #5): Added artworkPreviewUrl / artworkDownloadUrl getters that
//   fall back to item.urls.petimg1 (first semicolon-segment) for Ready-Made
//   items whose order-level item_urls[] is empty. canDownloadArtwork now
//   delegates to artworkDownloadUrl so the download button renders correctly.
//
// FIX (Bug #6): hasCompletedArtwork no longer requires isOrderCompleted for
//   Ready-Made items. A Ready-Made item is customer-approved the moment its
//   item status is 'completed' — the order itself stays 'ongoing' until the
//   admin finalises it via PUT /order/complete, so gating download on
//   isOrderCompleted was preventing customers from ever downloading.
// ═══════════════════════════════════════════════════════════════

import {
  ChangeDetectorRef, Component, ElementRef, HostListener,
  ViewChild, OnInit, OnDestroy, AfterViewInit, AfterViewChecked,
  signal, NgZone
} from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { BehaviorSubject, combineLatest, filter, Subject, takeUntil } from 'rxjs';
import LZString from 'lz-string';

import { SocketService } from '../Service/socket/socket.service';
import { ProductService } from '../Service/ProductPage/product.service';
import { UsersService } from '../Service/User/users.service';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';
import { AuthService } from '../Service/User/auth.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';
import { OrderService } from '../Service/OrderPage/order.service';

@Component({
  selector: 'app-order-tracking',
  standalone: false,
  templateUrl: './order-tracking.component.html',
  styleUrls: ['./order-tracking.component.css']
})
export class OrderTrackingComponent implements OnInit, OnDestroy, AfterViewInit, AfterViewChecked {

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('chatContent') chatContent!: ElementRef<HTMLDivElement>;
  @ViewChild('zoomPreview') zoomPreview!: ElementRef<HTMLDivElement>;

  readonly REVISION_LIMIT = 4;
  readonly SUPPORT_EMAIL = 'support@purrfectpal.studio';

  orderlist: any;
  orderId = '';
  userdata: any[] = [];
  messagedata: any[] = [];
  message = '';
  isSending = false;
  uploadInProgress = false;
  uploadProgress = 0;
  particles: number[] = [];
  filestoupload: File[] | null = null;
  isfileselected = false;
  previewImageUrl: string | null = null;
  istyping = false;
  typingSenderLabel = 'Artist';
  typingTimeout: any;
  typingExpireTimer: any;
  menuOpen = false;
  innerWidth = window.innerWidth;
  dropdownOpen = false;
  isChatVisible = false;
  private chatObserver?: IntersectionObserver;
  itemposition = signal<number>(0);
  dataofitems: any;
  itemStatusMap: Record<number, string> = {};
  artworkApproving = false;
  artworkRejecting = false;

  showRejectModal = false;
  rejectReason = '';

  lightboxOpen = false;
  lightboxEntry: any = null;

  private orderId$ = new BehaviorSubject<string>('');
  private userEmail$ = new BehaviorSubject<string>('');
  public previousLoaded = false;
  private scrollHandler!: () => void;
  private visibilityHandler!: () => void;
  private hideTimeout: any;
  private _hideZoomTimer: any;
  private _progressInterval: any;
  private destroy$ = new Subject<void>();
  private _ipoAnimFrames: Record<string, number> = {};
  private _apbAnimFrame = 0;
  private _apbRunning = false;
  private _connAnimFrames: Record<string, number> = {};
  private _connRunning: Record<string, boolean> = {};
  private _particleViewChecked = false;
  private _ipoCanvasesStarted = false;
  isOtherPartyOnline = false;
  private previousOrderId?: string;
  private socketSetupDone = false;

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  private isValidMessage(msg: any): boolean { return !!(msg?.text?.trim() || msg?.Url); }

  getSafeUrl(url: string | null | undefined): string {
    if (!url) return '';
    try { return encodeURI(url); } catch { return url; }
  }

  // ─────────────────────────────────────────────────────────────
  // FIX (Bug #7): Direct file download with filename support.
  // ─────────────────────────────────────────────────────────────
  downloadFile(url: string, filename = 'purrfectpal-artwork.png'): void {
    if (!url || url === 'null') return;

    fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('Network error');
        return response.blob();
      })
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      });
  }

  // ─────────────────────────────────────────────────────────────
  // REVISION & UPLOAD COUNTERS
  // ─────────────────────────────────────────────────────────────

  get uploadCount(): number {
    return this.orderlist?.items?.[this.itemposition()]?.upload_count ?? 0;
  }

  get revisionCount(): number {
    return this.orderlist?.items?.[this.itemposition()]?.revision_count ?? 0;
  }

  get rejectedHistory(): any[] {
    const hist = this.orderlist?.items?.[this.itemposition()]?.revision_history;
    return Array.isArray(hist) ? hist.filter((h: any) => h.status === 'rejected') : [];
  }

  get isRevisionLimitReached(): boolean { return this.revisionCount >= this.REVISION_LIMIT; }

  get revisionsRemaining(): number { return Math.max(0, this.REVISION_LIMIT - this.revisionCount); }

  // ─────────────────────────────────────────────────────────────
  // READY-MADE HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * True when the currently-selected item has art_style === 'Ready-Made'.
   * Used in the template to skip the approval/active/pending panels and
   * show the artwork directly with an instant download button.
   */
  get isReadyMadeItem(): boolean {
    return this.orderlist?.items?.[this.itemposition()]?.art_style === 'Ready-Made';
  }

  /**
   * Auto-completes every Ready-Made item in the current order that has not
   * already been marked 'completed'. Updates local state immediately for a
   * seamless UI, then persists to the backend via updateItemStatus.
   * Called after initial order data parse and after every _refreshOrderFromApi().
   *
   * FIX (Bug #4): subscribe wrapped with takeUntil(destroy$) to prevent
   * detectChanges on a destroyed view.
   */
  private autoCompleteReadyMadeItems(): void {
    if (!this.orderId || !this.orderlist?.items) return;

    const DONE = new Set(['completed', 'complete', 'done']);
    let anyChanged = false;

    this.orderlist.items.forEach((item: any, idx: number) => {
      if (item.art_style !== 'Ready-Made') return;
      if (DONE.has(this.getItemStatus(idx))) return;

      // Update locally first — instant UI feedback
      this.itemStatusMap[idx] = 'completed';
      if (this.orderlist.items[idx]) this.orderlist.items[idx].status = 'completed';
      anyChanged = true;

      // Persist to backend
      // FIX (Bug #4): takeUntil(destroy$) guards against completion firing
      // after the component has been destroyed.
      this.orderCompleteService.updateItemStatus(this.orderId, idx, 'completed')
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            console.log(`[ReadyMade] Auto-completed item ${idx}`);
            this.ngZone.run(() => {
              this._syncUrlParams();
              this.cdRef.detectChanges();
              requestAnimationFrame(() => this._startPendingIpoCanvases());
            });
          },
          error: (err: any) => {
            console.warn(`[ReadyMade] Auto-complete failed for item ${idx}:`, err);
          }
        });
    });

    if (anyChanged) {
      this.cdRef.detectChanges();
      requestAnimationFrame(() => this._startPendingIpoCanvases());
    }
  }

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

  parseArtistNotes(raw?: string): {
    format?: string;
    photoQuality?: string;
    frameAndSize?: string;
    fontPreference?: string;
    subjectNames?: string[];
    extraNotes?: string[];
    rawNotes?: string;
  } {
    if (!raw || raw === 'null') return {};

    const res: {
      format?: string;
      photoQuality?: string;
      frameAndSize?: string;
      fontPreference?: string;
      subjectNames?: string[];
      extraNotes?: string[];
      rawNotes?: string;
    } = {};

    const fmtMatch = raw.match(/\[Format:\s*([^\]]+)\]/i);
    if (fmtMatch) res.format = fmtMatch[1].trim();

    const qualMatch = raw.match(/\[Uploaded Photo Quality:\s*([^\]]+)\]/i);
    if (qualMatch) res.photoQuality = qualMatch[1].trim();

    const frameMatch = raw.match(/\[Visualizer Frame:\s*([^\]]+)\]/i);
    if (frameMatch) res.frameAndSize = frameMatch[1].trim();

    const fontMatch = raw.match(/\[Font Preference:\s*([^\]]+)\]/i);
    if (fontMatch) res.fontPreference = fontMatch[1].trim();

    const subjMatch = raw.match(/\[Subject Names:\s*([^\]]+(?:\[[^\]]+\])*[^\]]*)\]/i);
    if (subjMatch) {
      const inner = subjMatch[1];
      const memberMatches = Array.from(inner.matchAll(/\[(Member|Pet|Owner)[^\]:]*:\s*([^\]]+)\]/gi));
      if (memberMatches.length > 0) {
        res.subjectNames = memberMatches.map(m => `${m[1].charAt(0).toUpperCase() + m[1].slice(1)}: ${m[2].trim()}`);
      } else {
        const cleanSubj = inner.replace(/[\[\]]/g, '').trim();
        if (cleanSubj && cleanSubj !== 'null') res.subjectNames = [cleanSubj];
      }
    }

    const extraMatch = raw.match(/\[Extra Notes:\s*([^\]]+)\]/i);
    if (extraMatch) {
      const extraStr = extraMatch[1].trim();
      res.extraNotes = extraStr.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (!res.format && !res.photoQuality && !res.frameAndSize && !res.fontPreference && !res.subjectNames && !res.extraNotes) {
      res.rawNotes = raw;
    }

    return res;
  }

  /**
   * True when the current item is customer-approved but the whole order has
   * NOT yet been explicitly finalised by the artist via PUT /order/complete.
   */
  get isItemApprovedPendingOrderCompletion(): boolean {
    const ITEM_DONE = ['completed', 'complete', 'done'];
    if (!ITEM_DONE.includes(this.currentItemStatus)) return false;
    if (this.isOrderCompleted) return false;
    const urls = this.orderlist?.item_urls;
    const entry = Array.isArray(urls) ? urls[this.itemposition()] : null;
    return !!(entry?.img_url);
  }

  // ─────────────────────────────────────────────────────────────
  // FIX (Bug #5): Artwork URL getters with Ready-Made fallback.
  //
  // Ready-Made orders store the product image in item.urls.petimg1 (a
  // semicolon-delimited list of server paths). The order-level item_urls[]
  // is often empty because the artwork was never "uploaded" by an artist.
  // These getters check item_urls first for custom portraits, then fall back
  // to item.urls.petimg1 for Ready-Made items so the preview and download
  // button always have a URL to work with.
  // ─────────────────────────────────────────────────────────────

  /** First artwork preview image URL for the current item. */
  get artworkPreviewUrl(): string {
    // 1. Order-level item_urls (custom portraits, artist-uploaded work)
    const urls = this.orderlist?.item_urls;
    if (Array.isArray(urls)) {
      const entry = urls[this.itemposition()];
      if (entry?.img_url) return entry.img_url;
    }
    // 2. Ready-Made fallback — product image is the artwork
    if (this.isReadyMadeItem) {
      const item = this.orderlist?.items?.[this.itemposition()];
      const petimg1 = item?.urls?.petimg1 as string | null | undefined;
      if (petimg1) return petimg1.split(';')[0].trim();
    }
    return '';
  }

  /** Preferred download URL for the current item (file > img > Ready-Made fallback). */
  get artworkDownloadUrl(): string {
    // 1. Order-level item_urls
    const urls = this.orderlist?.item_urls;
    if (Array.isArray(urls)) {
      const entry = urls[this.itemposition()];
      if (entry?.file_url) return entry.file_url;
      if (entry?.img_url) return entry.img_url;
    }
    // 2. Ready-Made fallback — second segment is typically the higher-res file
    if (this.isReadyMadeItem) {
      const item = this.orderlist?.items?.[this.itemposition()];
      const petimg1 = item?.urls?.petimg1 as string | null | undefined;
      if (petimg1) {
        const segs = petimg1.split(';').map((s: string) => s.trim()).filter(Boolean);
        // Use second segment (file copy) when available; fall back to first
        return segs[1] ?? segs[0] ?? '';
      }
    }
    return '';
  }

  /**
   * FIX (Bug #5): Delegates to artworkDownloadUrl so Ready-Made items whose
   * order-level item_urls is empty still show the download button once
   * the item is customer-approved.
   */
  get canDownloadArtwork(): boolean {
    const ITEM_DONE = ['completed', 'complete', 'done'];
    if (!ITEM_DONE.includes(this.currentItemStatus)) return false;
    return !!this.artworkDownloadUrl;
  }

  get isOrderCompleted(): boolean {
    const s = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    return s === 'completed' || s === 'complete' || s === 'done';
  }

  get allItemsApproved(): boolean {
    if (!this.orderlist?.items?.length) return false;
    const DONE = new Set(['completed', 'complete', 'done']);
    return this.orderlist.items.every((_: any, i: number) =>
      DONE.has(this.getItemStatus(i))
    );
  }

  // ─────────────────────────────────────────────────────────────
  // LIGHTBOX
  // ─────────────────────────────────────────────────────────────

  openLightbox(entry: any): void { this.lightboxEntry = entry; this.lightboxOpen = true; }
  closeLightbox(): void { this.lightboxOpen = false; this.lightboxEntry = null; }

  // ─────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────

  constructor(
    private ngZone: NgZone,
    private router: Router,
    private route: ActivatedRoute,
    private socketService: SocketService,
    private datePipe: DatePipe,
    private productservice: ProductService,
    private userservice: UsersService,
    private socialmedia: SociallinkService,
    private authservice: AuthService,
    private loggingService: LoggingService,
    private toast: ToastService,
    private cdRef: ChangeDetectorRef,
    private orderCompleteService: OrderService,
  ) { }

  ngOnInit(): void {
    this.scrollHandler = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('touchmove', this.scrollHandler, { passive: true });

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        const ae = this.orderlist?.artist_email;
        if (ae && this.socketSetupDone) this.socketService.checkOnlineStatus(ae);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.authservice.checkAuth().pipe(takeUntil(this.destroy$)).subscribe(res => {
      if (res?.isAuthenticated && res?.user) this.getuserdata(res.user.user_id);
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params: Params) => {
      if (!params['order']) return;

      let orderData: any;
      try {
        const decompressed = LZString.decompressFromEncodedURIComponent(params['order']);
        if (decompressed) {
          orderData = JSON.parse(decompressed);
        } else {
          orderData = JSON.parse(decodeURIComponent(params['order']));
        }
      } catch {
        try {
          orderData = JSON.parse(decodeURIComponent(params['order']));
        } catch {
          return;
        }
      }

      this.orderlist = orderData;
      this.orderId = String(this.orderlist?.Order_ID ?? '');
      this.itemStatusMap = {};
      this.orderId$.next(this.orderId);

      if (typeof this.orderlist.item_urls === 'string' && this.orderlist.item_urls !== 'null') {
        try { this.orderlist.item_urls = JSON.parse(this.orderlist.item_urls); }
        catch { this.orderlist.item_urls = null; }
      }
      if (!this.orderlist.item_urls || this.orderlist.item_urls === 'null' || !Array.isArray(this.orderlist.item_urls)) {
        this.orderlist.item_urls = new Array(this.orderlist.items?.length ?? 0).fill(null);
      }

      this.orderlist.items?.forEach((item: any, idx: number) => {
        if (typeof item.upload_count !== 'number') item.upload_count = Number(item.upload_count) || 0;
        if (typeof item.revision_count !== 'number') item.revision_count = Number(item.revision_count) || 0;
        if (typeof item.revision_history === 'string' && item.revision_history !== 'null') {
          try { item.revision_history = JSON.parse(item.revision_history); }
          catch { item.revision_history = []; }
        }
        if (!Array.isArray(item.revision_history)) item.revision_history = [];

        if (item.item_urls && (!this.orderlist.item_urls[idx] || !this.orderlist.item_urls[idx]?.img_url)) {
          let iu = item.item_urls;
          if (typeof iu === 'string') { try { iu = JSON.parse(iu); } catch { iu = null; } }
          if (Array.isArray(iu) && iu.length) this.orderlist.item_urls[idx] = iu[0];
          else if (iu && typeof iu === 'object') this.orderlist.item_urls[idx] = iu;
        }
      });

      // Auto-complete any Ready-Made items immediately on load
      this.autoCompleteReadyMadeItems();

      requestAnimationFrame(() => this._startPendingIpoCanvases());
      this._refreshOrderFromApi();
    });

    this.getdatafromitems();
  }

  ngAfterViewInit(): void {
    if (this.orderlist?.items) this._startPendingIpoCanvases();

    const chatEl = document.querySelector('.chat-window');
    if (chatEl) {
      this.chatObserver = new IntersectionObserver(([entry]) => {
        this.ngZone.run(() => { this.isChatVisible = entry.isIntersecting; this.cdRef.markForCheck(); });
      }, { threshold: 0.1 });
      this.chatObserver.observe(chatEl);
    }

    combineLatest([this.orderId$, this.userEmail$])
      .pipe(filter(([id, email]) => !!id && !!email), takeUntil(this.destroy$))
      .subscribe(([id, email]) => this.syncOrder(id, email));
  }

  ngAfterViewChecked(): void {
    if (!this._ipoCanvasesStarted) this._startPendingIpoCanvases();
    if (!this._particleViewChecked) this._initProgressParticles();
  }

  ngOnDestroy(): void {
    const myEmail = this.userdata?.[0]?.email;
    if (myEmail) this.socketService.setUserOffline(myEmail);
    this.destroy$.next(); this.destroy$.complete();
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('touchmove', this.scrollHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (this._hideZoomTimer) clearTimeout(this._hideZoomTimer);
    if (this._progressInterval) clearInterval(this._progressInterval);
    this.chatObserver?.disconnect();
    Object.values(this._ipoAnimFrames).forEach(id => cancelAnimationFrame(id));
    if (this._apbAnimFrame) cancelAnimationFrame(this._apbAnimFrame);
    Object.values(this._connAnimFrames).forEach(id => cancelAnimationFrame(id));
  }

  // ─────────────────────────────────────────────────────────────
  // REFRESH FROM API
  // FIX (Bug #3): subscribe now uses takeUntil(destroy$) to prevent
  // detectChanges() calls after the component is destroyed.
  // ─────────────────────────────────────────────────────────────
  private _refreshOrderFromApi(): void {
    if (!this.orderId) return;

    this.orderCompleteService.getorderbyid(this.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: any) => {
        if (!res || res?.error) return;

        const orderArr = res?.Order ?? res?.order ?? (Array.isArray(res) ? res : null);
        const fresh = Array.isArray(orderArr) && orderArr.length ? orderArr[0] : orderArr;
        if (!fresh?.Order_ID && !fresh?.order_id) return;

        const freshStatusRaw = (fresh.Status ?? fresh.status ?? '').toString().trim();
        const freshStatusLower = freshStatusRaw.toLowerCase();
        const isCompletedOrder = ['completed', 'complete', 'done'].includes(freshStatusLower);

        let freshUrls = fresh.item_urls ?? fresh.Item_Urls;
        if (typeof freshUrls === 'string' && freshUrls !== 'null') {
          try { freshUrls = JSON.parse(freshUrls); }
          catch { freshUrls = null; }
        }
        if (Array.isArray(freshUrls)) {
          if (!Array.isArray(this.orderlist.item_urls)) {
            this.orderlist.item_urls = new Array(this.orderlist.items?.length ?? 0).fill(null);
          }
          freshUrls.forEach((entry: any, idx: number) => {
            if (!entry?.img_url) return;
            const existing = this.orderlist.item_urls[idx];
            if (isCompletedOrder || !existing?.img_url) {
              this.orderlist.item_urls[idx] = entry;
            }
          });
        }

        let freshItems: any[] = [];
        try {
          const raw = fresh.items ?? fresh.Items;
          freshItems = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? []);
        } catch { freshItems = []; }

        freshItems.forEach((item: any, idx: number) => {
          if (!this.orderlist?.items?.[idx]) return;
          const local = this.orderlist.items[idx];
          if (!this.itemStatusMap[idx]) {
            const s = (item.status || item.Status || '').toLowerCase().trim();
            if (s) local.status = s;
          }
          if (typeof item.upload_count === 'number') local.upload_count = item.upload_count;
          if (typeof item.revision_count === 'number') local.revision_count = item.revision_count;
          let rh = item.revision_history ?? item.Revision_History;
          if (typeof rh === 'string' && rh !== 'null') { try { rh = JSON.parse(rh); } catch { rh = null; } }
          if (Array.isArray(rh) && rh.length > 0) local.revision_history = rh;
        });

        if (freshStatusRaw) this.orderlist.Status = freshStatusRaw;

        this.cdRef.detectChanges();
        requestAnimationFrame(() => this._startPendingIpoCanvases());

        // Auto-complete any Ready-Made items that the API refresh may have reset
        this.autoCompleteReadyMadeItems();
      });
  }

  getuserdata(id: string): void {
    this.userservice.getuserdetailbyid(id).subscribe(res => {
      this.userdata = res;
      this.userEmail$.next(this.userdata?.[0]?.email ?? '');
    });
  }

  getdatafromitems(): void {
    this.productservice.getdata().subscribe(res => { this.dataofitems = res; });
  }

  private syncOrder(orderId: string, email: string): void {
    if (!this.socketSetupDone) {
      this.socketService.connect(email);
      this.setupGlobalSocketListeners();
      this.socketSetupDone = true;
    } else {
      this.socketService.register(email);
    }

    if (this.previousOrderId !== orderId) {
      this.messagedata = []; this.previousLoaded = false; this.isOtherPartyOnline = false;
    }
    this.previousOrderId = orderId;
    this.socketService.joinOrder(orderId);
    const ae = this.orderlist?.artist_email;
    if (ae) setTimeout(() => this.socketService.checkOnlineStatus(ae), 150);
  }

  private setupGlobalSocketListeners(): void {
    this.socketService.onPreviousMessages().pipe(takeUntil(this.destroy$)).subscribe(msgs => {
      this.ngZone.run(() => {
        if (this.previousLoaded) return;
        this.messagedata = (msgs ? (Array.isArray(msgs) ? msgs : [msgs]) : [])
          .filter((m: any) => this.isValidMessage(m))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        this.previousLoaded = true;
        this.cdRef.detectChanges();
        this.scrollToBottom();
      });
    });

    this.socketService.onNewMessage().pipe(takeUntil(this.destroy$)).subscribe(msg => {
      if (!msg || !this.isValidMessage(msg)) return;
      this.ngZone.run(() => {
        if (String(msg.Order_ID) !== String(this.orderId)) return;
        const exists = this.messagedata.some(m => m.Message_ID === msg.Message_ID && msg.Message_ID != null);
        if (!exists) {
          this.messagedata = [...this.messagedata, msg]
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          this.cdRef.detectChanges();
          setTimeout(() => { this.cdRef.detectChanges(); this.scrollToBottom(); }, 0);

          if (msg.type === 'artwork_uploaded' || msg.artwork_uploaded || msg.type === 'order_completed') {
            this._refreshOrderFromApi();
          }
        }
      });
    });

    this.socketService.onTyping().pipe(takeUntil(this.destroy$)).subscribe(data => {
      const ok = (!data?.orderId || String(data.orderId) === String(this.orderId))
        && (!data?.email || data.email !== this.userdata?.[0]?.email);
      if (!ok) return;
      this.ngZone.run(() => {
        const role = (data?.role || '').toLowerCase();
        this.typingSenderLabel = role === 'admin' ? 'Admin' : (this.orderlist?.artist_name || 'Artist');
        this.istyping = true;
        this.cdRef.detectChanges();
        this.scrollToBottom();
      });
    });

    this.socketService.onStopTyping().pipe(takeUntil(this.destroy$)).subscribe(data => {
      const ok = (!data?.orderId || String(data.orderId) === String(this.orderId))
        && (!data?.email || data.email !== this.userdata?.[0]?.email);
      if (!ok) return;
      this.ngZone.run(() => { this.istyping = false; this.cdRef.detectChanges(); });
    });

    this.socketService.onUserStatusUpdate().pipe(takeUntil(this.destroy$)).subscribe(({ email, online }) => {
      this.ngZone.run(() => {
        if (email === this.orderlist?.artist_email) { this.isOtherPartyOnline = online; this.cdRef.detectChanges(); }
      });
    });

    this.socketService.onOnlineStatusResult().pipe(takeUntil(this.destroy$)).subscribe(({ email, online }) => {
      this.ngZone.run(() => {
        if (email === this.orderlist?.artist_email) { this.isOtherPartyOnline = online; this.cdRef.detectChanges(); }
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ARTWORK APPROVAL
  // ─────────────────────────────────────────────────────────────

  approveArtwork(): void {
    if (this.artworkApproving) return;
    const idx = this.itemposition();
    this.artworkApproving = true;
    this.cdRef.detectChanges();

    this.orderCompleteService.updateItemStatus(this.orderId, idx, 'completed')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.artworkApproving = false;
          if (res?.error) {
            this.toast.showToast('error', 'Approval Failed', res?.message ?? 'Something went wrong.');
            this.cdRef.detectChanges();
            return;
          }

          this.itemStatusMap[idx] = 'completed';
          if (this.orderlist?.items?.[idx]) this.orderlist.items[idx].status = 'completed';

          requestAnimationFrame(() => {
            const cid = 'ipo-tube-canvas-' + idx;
            const cv = document.getElementById(cid) as HTMLCanvasElement | null;
            if (cv) {
              cancelAnimationFrame(this._ipoAnimFrames[cid]);
              delete this._ipoAnimFrames[cid];
              this._startIpoParticles(cv, cid, 'completed');
            }
          });

          this.toast.showToast(
            'success',
            'Artwork Approved!',
            'Your portrait has been accepted. Waiting for the artist to finalise your order.'
          );
          this.cdRef.detectChanges();
          this._syncUrlParams();
          this._refreshOrderFromApi();
        },
        error: (err: any) => {
          this.artworkApproving = false;
          this.loggingService.error('approveArtwork failed:', err);
          this.toast.showToast('error', 'Approval Failed', 'Please try again.');
          this.cdRef.detectChanges();
        }
      });
  }

  rejectArtwork(): void {
    if (this.artworkRejecting) return;
    if (this.isRevisionLimitReached) {
      this.toast.showToast('error', 'Revision Limit Reached',
        `You have used all ${this.REVISION_LIMIT} revisions. Please contact us at ${this.SUPPORT_EMAIL} for further assistance.`);
      return;
    }
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  cancelReject(): void { this.showRejectModal = false; this.rejectReason = ''; }

  confirmReject(): void {
    if (this.isRevisionLimitReached) {
      this.toast.showToast('error', 'Revision Limit Reached',
        `You have used all ${this.REVISION_LIMIT} revisions. Please contact us at ${this.SUPPORT_EMAIL} for further assistance.`);
      this.showRejectModal = false;
      return;
    }

    const idx = this.itemposition();
    this.artworkRejecting = true;
    this.showRejectModal = false;
    this.cdRef.detectChanges();

    const currentUrls = this.orderlist?.item_urls?.[idx];
    let historyEntry: any = null;

    if (currentUrls?.img_url) {
      const item = this.orderlist.items[idx];
      if (!Array.isArray(item.revision_history)) item.revision_history = [];
      if (typeof item.revision_count !== 'number') item.revision_count = 0;
      if (typeof item.upload_count !== 'number') item.upload_count = 0;

      historyEntry = {
        upload_number: item.upload_count,
        img_url: currentUrls.img_url,
        file_url: currentUrls.file_url ?? null,
        submitted_at: currentUrls.submitted_at ?? new Date().toISOString(),
        rejected_at: new Date().toISOString(),
        rejection_reason: this.rejectReason.trim() || null,
        status: 'rejected',
      };

      item.revision_history.unshift(historyEntry);
      item.revision_count++;
    }

    // FIX (Bug #1 — via service): passing historyEntry now correctly routes
    // this call to /order/item/ongoing-revision/:itemID in OrderService,
    // which calls SetItemOngoingWithRevision on the server. Previously the
    // service always called /ongoing and the revision data was discarded.
    this.orderCompleteService.updateItemStatus(
      this.orderId, idx, 'ongoing',
      this.rejectReason.trim() || undefined,
      historyEntry ?? undefined
    )
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          this.artworkRejecting = false;
          if (res?.error) {
            this.toast.showToast('error', 'Action Failed', res?.message ?? 'Something went wrong.');
            this._rollbackRejection(idx, historyEntry);
            this.cdRef.detectChanges();
            return;
          }

          if (Array.isArray(this.orderlist.item_urls)) {
            this.orderlist.item_urls[idx] = { img_url: null, file_url: null };
          }

          this.itemStatusMap[idx] = 'ongoing';
          if (this.orderlist?.items?.[idx]) this.orderlist.items[idx].status = 'ongoing';
          this.rejectReason = '';

          requestAnimationFrame(() => {
            const cid = 'ipo-tube-canvas-' + idx;
            const cv = document.getElementById(cid) as HTMLCanvasElement | null;
            if (cv) {
              cancelAnimationFrame(this._ipoAnimFrames[cid]);
              delete this._ipoAnimFrames[cid];
              this._startIpoParticles(cv, cid, 'ongoing');
            }
          });

          const revNum = this.orderlist?.items?.[idx]?.revision_count ?? 1;
          const remaining = this.revisionsRemaining;
          const remainingMsg = remaining > 0
            ? ` You have ${remaining} revision${remaining === 1 ? '' : 's'} remaining.`
            : ` This was your final revision. Contact ${this.SUPPORT_EMAIL} if you need more help.`;

          this.toast.showToast('info', `Revision #${revNum} Requested`,
            `The artist will be notified to revise and re-upload.${remainingMsg}`);
          this.cdRef.detectChanges();
          this._syncUrlParams();
        },
        error: (err: any) => {
          this.artworkRejecting = false;
          this._rollbackRejection(idx, historyEntry);
          this.loggingService.error('rejectArtwork failed:', err);
          this.toast.showToast('error', 'Action Failed', 'Please try again.');
          this.cdRef.detectChanges();
        }
      });
  }

  private _rollbackRejection(idx: number, entry: any): void {
    if (!entry) return;
    const item = this.orderlist?.items?.[idx];
    if (!item) return;
    if (Array.isArray(item.revision_history) && item.revision_history[0] === entry) {
      item.revision_history.shift();
    }
    if (typeof item.revision_count === 'number') {
      item.revision_count = Math.max(0, item.revision_count - 1);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // MESSAGING
  // ─────────────────────────────────────────────────────────────

  uploadfiles(): void {
    if (!this.message?.trim()) {
      this.toast.showToast('error', 'Empty Message', 'Type a message before sending.');
      return;
    }
    this.isSending = true;
    this.startSmoothProgress();

    if (this.filestoupload) {
      this.productservice.uploadfiles(this.filestoupload).subscribe({
        next: ({ progress, response }) => {
          this.ngZone.run(() => {
            if (progress > this.uploadProgress) {
              this.uploadProgress = progress;
              this.particles = Array.from({ length: 6 }, () => Math.random() * 100);
              this.cdRef.markForCheck();
            }
          });
          if (progress === 100 && response) {
            this.finishProgress();
            this.ngZone.run(() => this.sendUpdate(response.files));
          }
        },
        error: err => {
          this.finishProgress();
          this.isSending = false;
          this.loggingService.error(err);
          this.toast.showToast('error', 'Upload Failed', 'File upload error.');
        }
      });
    } else {
      setTimeout(() => { this.finishProgress(); this.sendUpdate(null); }, 500);
    }
  }

  sendUpdate(files: string[] | null): void {
    const user = this.userdata?.[0];
    if (!user || !this.orderId) { this.isSending = false; this.clearFileInput(); return; }
    const payload = {
      date: new Date().toISOString(),
      text: this.message,
      Order_ID: this.orderId,
      username: user.Name,
      User_ID: user.ID,
      email: user.email,
      sendto_id: this.orderlist.Artist_ID,
      role: user.Type,
      Url: files?.length ? encodeURI(this.productservice.getfilebaseurl() + files[0]) : null,
      Pro_url: user.Url ? encodeURI(user.Url) : null,
      recipients: [this.orderlist.artist_email]
    };
    this.socketService.sendStopTyping(this.orderId, user.email);
    this.socketService.sendOrderUpdate(payload);
    this.isSending = false;
    this.clearFileInput();
  }

  onTyping(): void {
    if (!this.orderId || !this.userdata?.[0]?.email) return;
    this.socketService.sendTyping(this.orderId, this.userdata[0].email);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.socketService.sendStopTyping(this.orderId, this.userdata[0].email), 1500);
  }

  scrollToBottom(): void {
    if (!this.chatContent) return;
    setTimeout(() => { this.chatContent.nativeElement.scrollTop = this.chatContent.nativeElement.scrollHeight; }, 50);
  }

  scrollToChat(): void {
    document.querySelector('.chat-window')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  triggerFileInput(): void { this.fileInput.nativeElement.value = ''; this.fileInput.nativeElement.click(); }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    this.filestoupload = Array.from(input.files);
    this.isfileselected = true;
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl = URL.createObjectURL(this.filestoupload[0]);
  }

  clearFileInput(): void {
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl = null;
    this.filestoupload = null;
    this.isfileselected = false;
    this.message = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  // ─────────────────────────────────────────────────────────────
  // UI HELPERS
  // ─────────────────────────────────────────────────────────────

  handleScroll(): void {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hideZoom(), 150);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement).closest('.dropdown-wrap')) this.dropdownOpen = false;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.lightboxOpen) this.closeLightbox();
      if (this.showRejectModal) this.cancelReject();
    }
  }

  @HostListener('window:resize')
  onResize(): void { this.innerWidth = window.innerWidth; }

  formatDate(date: string): string { return this.datePipe.transform(date, 'd MMM yyyy - h:mm a') || ''; }

  getClassForRole(item: any): string {
    if (!this.userdata?.length) return 'in';
    return item.role === 'user' ? 'out' : 'in';
  }

  getSafeProfileImageUrl(rawUrl?: string): string {
    if (!rawUrl || rawUrl === 'null' || rawUrl === 'undefined' || rawUrl.startsWith('null') || rawUrl.startsWith('undefined') || !rawUrl.trim()) {
      return 'assets/images/profile-picture.png';
    }
    const clean = rawUrl.replace('@', '%40');
    if (clean.startsWith('assets/') || clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    return this.productservice.getfilebaseurl() + clean.replace(/^\/+/, '');
  }

  onImageError(event: Event): void { (event.target as HTMLImageElement).src = 'assets/images/profile-picture.png'; }

  isStatusActive(...statuses: string[]): boolean {
    const current = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    return statuses.map(s => s.toLowerCase()).includes(current);
  }

  getItemStatus(index: number): string {
    if (this.itemStatusMap[index] !== undefined) return this.itemStatusMap[index];
    const item = this.orderlist?.items?.[index];
    return ((item?.status || item?.Status) ?? '').toLowerCase().trim();
  }

  get currentItemStatus(): string { return this.getItemStatus(this.itemposition()); }

  isItemStatusActive(...statuses: string[]): boolean {
    return statuses.map(s => s.toLowerCase()).includes(this.currentItemStatus);
  }

  get isItemPendingApproval(): boolean { return this.currentItemStatus === 'pending_approval'; }

  get hasUploadedArtwork(): boolean {
    if (this.isReadyMadeItem) {
      return !!this.artworkDownloadUrl;
    }
    let urls = this.orderlist?.item_urls;
    if (typeof urls === 'string' && urls !== 'null') {
      try { urls = JSON.parse(urls); } catch { urls = null; }
    }
    if (!urls || urls === 'null' || !Array.isArray(urls)) return false;
    const entry = urls[this.itemposition()];
    if (!entry) return false;
    return !!(entry?.img_url || entry?.file_url);
  }

  /**
   * FIX (Bug #6): Ready-Made items are customer-approved at the item level
   * while the order stays 'ongoing' until the admin finalises it via
   * PUT /order/complete. The original guard `if (!this.isOrderCompleted) return false`
   * caused the download card to never show for Ready-Made orders.
   *
   * New logic: for Ready-Made items, only the item-level 'completed' status and
   * a valid artwork URL are required. For custom portraits the order must also
   * be completed (i.e. the artist has finalised the delivery).
   */
  get hasCompletedArtwork(): boolean {
    if (this.isOrderCompleted) {
      return !!this.artworkDownloadUrl;
    }

    const ITEM_DONE = ['completed', 'complete', 'done'];
    if (!ITEM_DONE.includes(this.currentItemStatus)) return false;

    // Ready-Made: artwork is available as soon as the item is approved —
    // don't gate on isOrderCompleted.
    if (this.isReadyMadeItem) {
      return !!this.artworkDownloadUrl;
    }

    // Custom portrait: require the artist to have explicitly finalised the order.
    if (!this.isOrderCompleted) return false;

    return !!this.artworkDownloadUrl;
  }

  selitemposition(pos: number): void {
    this.itemposition.set(pos);
    this.showRejectModal = false;
    this.lightboxOpen = false;
    this.resetProgressParticles();
    this._ipoCanvasesStarted = false;
    requestAnimationFrame(() => this._startPendingIpoCanvases());
  }

  splitPetImgs(petimgStr: string): string[] {
    if (!petimgStr) return [];
    return petimgStr.split(';').filter(s => s && s !== 'null' && s !== 'undefined');
  }

  trackByMessageId(index: number, item: any): any { return item.Message_ID ?? index; }
  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
  opensocialurl(pos: number): void { this.socialmedia.geturl(pos); }

  get isChatEnabled(): boolean {
    const s = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    return s === 'active' || s === 'ongoing' || s === 'in progress';
  }

  get chatDisabledReason(): string {
    const s = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    if (s === 'pending') return 'Order is under approval by artist.';
    if (s === 'completed' || s === 'complete' || s === 'done') return 'This order has been completed. Chat is now read-only.';
    if (s === 'cancelled') return 'This order has been cancelled.';
    if (s === 'refund_pending') return 'This order has a refund request pending approval. Chat is now read-only.';
    if (s === 'refunded') return 'This order has been refunded and cancelled. Chat is now read-only.';
    return 'Chat is unavailable at this time.';
  }

  get progressDisplay(): number { return Math.round(this.uploadProgress); }

  isStepDone(step: string): boolean {
    const status = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    const si = step === 'active' ? 1 : step === 'completed' ? 2 : 0;
    const ci = status === 'pending' ? 0
      : (status === 'active' || status === 'ongoing' || status === 'in progress') ? 1
        : (status === 'completed' || status === 'complete' || status === 'done') ? 2 : -1;
    return ci > si;
  }

  // ─────────────────────────────────────────────────────────────
  // PROGRESS
  // ─────────────────────────────────────────────────────────────

  private startSmoothProgress(): void {
    if (this._progressInterval) clearInterval(this._progressInterval);
    this.uploadProgress = 0; this.uploadInProgress = true;
    this.particles = Array.from({ length: 6 }, () => Math.random() * 100);
    this.cdRef.markForCheck();
    this._progressInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.uploadProgress < 88) {
          const step = Math.max(0.25, (88 - this.uploadProgress) * 0.045);
          this.uploadProgress = Math.min(88, +(this.uploadProgress + step).toFixed(2));
          this.particles = Array.from({ length: 6 }, () => Math.random() * 100);
          this.cdRef.markForCheck();
        }
      });
    }, 35);
  }

  private finishProgress(): void {
    if (this._progressInterval) { clearInterval(this._progressInterval); this._progressInterval = null; }
    this.ngZone.run(() => {
      this.uploadProgress = 100;
      this.particles = Array.from({ length: 10 }, () => Math.random() * 100);
      this.cdRef.markForCheck();
    });
    setTimeout(() => {
      this.ngZone.run(() => {
        this.uploadInProgress = false; this.uploadProgress = 0; this.particles = [];
        this.cdRef.markForCheck();
      });
    }, 750);
  }

  // ─────────────────────────────────────────────────────────────
  // ZOOM
  // ─────────────────────────────────────────────────────────────

  showZoom(event: MouseEvent, imgSrc: string | ArrayBuffer | null): void {
    if (!imgSrc || !this.zoomPreview) return;
    const zoomEl = this.zoomPreview.nativeElement;
    const img = zoomEl.querySelector('.zoom-image') as HTMLImageElement;
    img.src = imgSrc as string;
    zoomEl.classList.remove('hide', 'visible');
    void zoomEl.offsetWidth;
    zoomEl.classList.add('visible');
  }

  hideZoom(): void {
    if (!this.zoomPreview) return;
    const zoomEl = this.zoomPreview.nativeElement;
    zoomEl.classList.add('hide');
    setTimeout(() => zoomEl.classList.remove('visible'), 850);
  }

  hideZoomDelayed(): void {
    if (this._hideZoomTimer) clearTimeout(this._hideZoomTimer);
    this._hideZoomTimer = setTimeout(() => this.hideZoom(), 320);
  }

  cancelHideZoom(): void { if (this._hideZoomTimer) clearTimeout(this._hideZoomTimer); }

  // ─────────────────────────────────────────────────────────────
  // URL SYNC
  // ─────────────────────────────────────────────────────────────

  private _syncUrlParams(): void {
    try {
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(this.orderlist));
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { order: encoded },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch (e) { }
  }

  // ─────────────────────────────────────────────────────────────
  // PARTICLE SYSTEM (unchanged)
  // ─────────────────────────────────────────────────────────────

  private _startPendingIpoCanvases(): void {
    if (!this.orderlist?.items) return;
    let allStarted = true;
    const orderStatus = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    const isTerminalOrder = ['refund_pending', 'refunded', 'cancelled'].includes(orderStatus);
    this.orderlist.items.forEach((_: any, i: number) => {
      const id = 'ipo-tube-canvas-' + i;
      if (this._ipoAnimFrames[id]) return;
      const canvas = document.getElementById(id) as HTMLCanvasElement | null;
      if (!canvas) { allStarted = false; return; }
      const statusToUse = isTerminalOrder ? orderStatus : this.getItemStatus(i);
      this._startIpoParticles(canvas, id, statusToUse);
    });
    if (allStarted) this._ipoCanvasesStarted = true;
  }

  private _startIpoParticles(canvas: HTMLCanvasElement, id: string, status: string): void {
    const tube = canvas.parentElement as HTMLElement;
    canvas.width = tube.offsetWidth || 200;
    canvas.height = tube.offsetHeight || 14;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const PALETTES: Record<string, string[]> = {
      active: ['rgba(99,102,241,0.9)', 'rgba(124,58,237,0.7)', 'rgba(201,168,76,0.6)'],
      ongoing: ['rgba(99,102,241,0.9)', 'rgba(124,58,237,0.7)', 'rgba(201,168,76,0.6)'],
      'in progress': ['rgba(99,102,241,0.9)', 'rgba(124,58,237,0.7)', 'rgba(201,168,76,0.6)'],
      completed: ['rgba(201,168,76,0.9)', 'rgba(124,58,237,0.8)', 'rgba(255,255,255,0.75)'],
      complete: ['rgba(201,168,76,0.9)', 'rgba(124,58,237,0.8)', 'rgba(255,255,255,0.75)'],
      done: ['rgba(201,168,76,0.9)', 'rgba(124,58,237,0.8)', 'rgba(255,255,255,0.75)'],
      pending: ['rgba(217,119,6,0.85)', 'rgba(234,185,74,0.65)'],
      cancelled: ['rgba(220,38,38,0.65)', 'rgba(239,68,68,0.45)'],
      pending_approval: ['rgba(14,165,233,0.9)', 'rgba(59,130,246,0.7)', 'rgba(255,255,255,0.65)'],
      refund_pending: ['rgba(245,158,11,0.85)', 'rgba(251,191,36,0.65)'],
      refunded: ['rgba(107,114,128,0.8)', 'rgba(156,163,175,0.6)'],
    };
    const FILL_RATIO: Record<string, number> = {
      pending: 0.20, active: 0.55, ongoing: 0.55, 'in progress': 0.55,
      pending_approval: 0.80, completed: 1.0, complete: 1.0, done: 1.0, cancelled: 1.0,
      refund_pending: 1.0, refunded: 1.0,
    };
    const cols = PALETTES[status] ?? PALETTES['pending'];
    const fillRatio = FILL_RATIO[status] ?? 0.20;
    const count = (status === 'done' || status === 'completed' || status === 'complete') ? 14
      : (status === 'pending_approval') ? 12 : 10;
    const isTerminal = ['cancelled', 'refund_pending', 'refunded'].includes(status);
    const parts = Array.from({ length: count }, () => ({
      x: Math.random() * W * fillRatio, y: H * 0.2 + Math.random() * H * 0.6,
      r: 1 + Math.random() * 1.4, vx: isTerminal ? 0 : (0.18 + Math.random() * 0.55),
      vy: (Math.random() - 0.5) * 0.18, col: cols[Math.floor(Math.random() * cols.length)], life: Math.random(),
    }));
    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.life += 0.012; if (!isTerminal) p.x += p.vx; p.y += p.vy;
        const alpha = Math.min(1, Math.sin(p.life * Math.PI) * 0.85 + 0.15);
        ctx.globalAlpha = alpha; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (p.x > W * fillRatio + 4 || p.life > 1) {
          p.x = Math.random() * 4; p.y = H * 0.2 + Math.random() * H * 0.6;
          p.life = 0; p.col = cols[Math.floor(Math.random() * cols.length)];
        }
        if (p.y < 1) p.vy = Math.abs(p.vy);
        if (p.y > H - 1) p.vy = -Math.abs(p.vy);
      }
      ctx.globalAlpha = 1; this._ipoAnimFrames[id] = requestAnimationFrame(tick);
    };
    tick();
  }

  private _initProgressParticles(): void {
    let initialised = false;
    const status = this.currentItemStatus;
    const apbCanvas = document.getElementById('apb-particle-canvas') as HTMLCanvasElement | null;
    if (apbCanvas && !this._apbRunning) { this._startApbParticles(apbCanvas, status); initialised = true; }
    (['step-conn-canvas-0', 'step-conn-canvas-1'] as const).forEach(id => {
      const canvas = document.getElementById(id) as HTMLCanvasElement | null;
      if (canvas && !this._connRunning[id]) { this._startConnectorParticles(canvas, id, status); initialised = true; }
    });
    if (initialised) this._particleViewChecked = true;
  }

  private _startApbParticles(canvas: HTMLCanvasElement, _status: string): void {
    const track = canvas.parentElement as HTMLElement;
    canvas.width = track.offsetWidth || 260; canvas.height = track.offsetHeight || 6;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    this._apbRunning = true;
    const W = canvas.width, H = canvas.height;
    const COLS = ['rgba(99,102,241,0.9)', 'rgba(124,58,237,0.75)', 'rgba(201,168,76,0.65)', 'rgba(255,255,255,0.5)'];
    const spawn = () => ({
      x: Math.random() * W * 0.28, y: H * 0.15 + Math.random() * H * 0.7,
      r: 0.8 + Math.random() * 1.6, vx: 1.2 + Math.random() * 2.4,
      vy: (Math.random() - 0.5) * 0.4, col: COLS[Math.floor(Math.random() * COLS.length)],
      life: 0, maxLife: 0.55 + Math.random() * 0.45, trail: [] as { x: number; y: number }[]
    });
    const particles = Array.from({ length: 14 }, spawn);
    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.life += 0.018; p.x += p.vx; p.y += p.vy;
        p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 5) p.trail.shift();
        const t = p.life / p.maxLife;
        const alpha = t < 0.3 ? t / 0.3 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha)); ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (p.x > W + 4 || p.life >= p.maxLife) Object.assign(p, spawn());
      }
      ctx.globalAlpha = 1; this._apbAnimFrame = requestAnimationFrame(tick);
    };
    tick();
  }

  private _startConnectorParticles(canvas: HTMLCanvasElement, id: string, status: string): void {
    const connector = canvas.parentElement as HTMLElement;
    canvas.width = 18; canvas.height = connector.offsetHeight || 26;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    this._connRunning[id] = true;
    const isDone = id === 'step-conn-canvas-0' || ['completed', 'complete', 'done'].includes(status);
    if (!isDone) return;
    const W = canvas.width, H = canvas.height;
    const cols = ['rgba(201,168,76,0.85)', 'rgba(124,58,237,0.7)', 'rgba(255,255,255,0.6)'];
    const particles = Array.from({ length: 6 }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 1.5,
      vy: 0.35 + Math.random() * 0.65, col: cols[Math.floor(Math.random() * cols.length)], life: Math.random()
    }));
    const tick = (): void => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.y += p.vy; p.life += 0.01;
        const alpha = Math.min(1, Math.sin(p.life * Math.PI) * 0.8 + 0.2);
        ctx.globalAlpha = alpha; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (p.y > H + 4 || p.life > 1) { p.y = -2; p.x = Math.random() * W; p.life = 0; }
      }
      ctx.globalAlpha = 1; this._connAnimFrames[id] = requestAnimationFrame(tick);
    };
    tick();
  }

  private resetProgressParticles(): void {
    if (this._apbAnimFrame) cancelAnimationFrame(this._apbAnimFrame);
    this._apbAnimFrame = 0; this._apbRunning = false;
    Object.values(this._connAnimFrames).forEach(id => cancelAnimationFrame(id));
    this._connAnimFrames = {}; this._connRunning = {};
    this._particleViewChecked = false;
  }
}