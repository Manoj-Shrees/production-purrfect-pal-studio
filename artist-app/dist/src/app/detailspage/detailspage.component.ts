import {
  ChangeDetectorRef, Component, HostListener, NgZone, Renderer2, ElementRef,
  signal, ViewChild, OnInit, OnDestroy, AfterViewInit,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  BehaviorSubject, catchError, combineLatest, filter, of, Subject, switchMap, take, takeUntil,
} from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { NgForm } from '@angular/forms';

import { DetailpageService }    from '../Service/detail-page/detailpage.service';
import { SocketService }        from '../Service/socket/socket.service';
import { UsersService }         from '../Service/User/users.service';
import { ProductService }       from '../Service/ProductPage/product.service';
import { ItemService }          from '../Service/Items/item.service';
import { OrderService }         from '../Service/Order/order-complete.service';
import { DownloaderService }    from '../Service/FiledDownload/downloader.service';
import { AuthService }          from '../Service/Auth/auth.service';
import { LoggingService }       from '../Service/Logs/logging.service';
import { items }                from './models/itemmodel';
import LZString                 from 'lz-string';

@Component({
  selector: 'app-detailspage', standalone: false,
  templateUrl: './detailspage.component.html', styleUrl: './detailspage.component.css',
})
export class DetailspageComponent implements OnInit, OnDestroy, AfterViewInit {

  @ViewChild('fileInput')     fileInput!:     ElementRef;
  @ViewChild('chatContent')   chatContent!:   ElementRef<HTMLUListElement>;
  @ViewChild('zoomPreview')   zoomPreview!:   ElementRef<HTMLImageElement>;
  @ViewChild('artworkForm')   artworkForm!:   NgForm;
  @ViewChild('slider')        slider!:        ElementRef<HTMLInputElement>;
  @ViewChild('sliderWrapper') sliderWrapper!: ElementRef<HTMLElement>;

  level = 50; animateLevel = true; orderlist: any;
  itemposition = signal<number>(0);
  messages: any; orderId = ''; message = '';
  messagedata: any[] = []; userdata: any; artistdata: any;
  filestoupload: any; istyping = false; typingTimeout: any;
  isfileselected = false; previewImageUrl: string | null = null;
  premade300x300file: File | null = null; premadeoriginalfile: File | null = null;
  dataofitems: any; petName: any; isSending = false; dropdownOpen = false;
  uploadInProgress = false; uploadProgress = 0; particles: number[] = [];
  isOtherPartyOnline = false;

  // ── Revision history lightbox ──
  historyLightboxOpen   = false;
  historyLightboxEntry: any = null;

  // ── Mark Complete Modal ───────────────────────────────────────
  markCompleteModalOpen = false;
  markCompleteLoading   = signal(false);
  markCompleteErr       = signal('');

  /**
   * Prevents the auto-open of the "Mark Order Complete" modal from
   * firing more than once per session / per order load.
   */
  private _autoCompleteModalShown = false;

  // ── Add to Items Catalog ─────────────────────────────────────
  addToItemsLoading     = signal(false);
  addToItemsSuccessIdx: number[] = [];

  chatSuggestions: string[] = [
    "I've received your order. Thank you for choosing Purrfect Pal Studio — I'll start reviewing it now.",
    "I've gone through your details and will begin working on your portrait shortly.",
    "Just to make sure I get everything right — do you have any specific preferences for background or mood?",
    "I've prepared the initial sketch. Please take a look and let me know if you'd like any changes before I continue.",
    "Just a quick update — I'm currently working on your portrait and will share the next version soon.",
    "Thank you for your feedback. I'll make the adjustments and send an updated version shortly.",
    "Your portrait is ready. Please review it and let me know if everything looks good.",
    "I'm glad you're happy with the result. If everything looks perfect, I'll mark the order as complete.",
    "Just checking in to see if you had a chance to review the portrait. Let me know your thoughts.",
  ];
  suggestionsOpen = false;
  artworkUploading = signal(false);
  artworkUploadErr = signal('');
  itemStatusMap: Record<number, string> = {};
  statusUpdateLoading: number | null = null;
  statusDropdownOpenIndex: number | null = null;
  readonly STATUS_OPTIONS = [
    { value: 'active',    label: 'Active',    color: 'green' },
    { value: 'ongoing',   label: 'Ongoing',   color: 'blue'  },
    { value: 'cancelled', label: 'Cancelled', color: 'red'   },
  ];
  private _ipoAnimFrames: Record<string, number> = {};
  private orderId$       = new BehaviorSubject<string>('');
  private artistEmail$   = new BehaviorSubject<string>('');
  private customerEmail$ = new BehaviorSubject<string>('');
  private socketInitialized = false;
  public  previousLoaded = false;
  private scrollHandler!: () => void;
  private visibilityHandler!: () => void;
  private hideTimeout: any; private _progressInterval: any; private _hideZoomTimer: any;
  private destroy$ = new Subject<void>();

  // ── COMPUTED ──────────────────────────────────────────────────

  private readonly ITEM_DONE = new Set(['completed', 'complete', 'done']);

  get allItemsCompleted(): boolean {
    if (!this.orderlist?.items?.length) return false;
    return this.orderlist.items.every((_: any, i: number) =>
      this.ITEM_DONE.has(this.getItemStatus(i))
    );
  }

  get isChatEnabled(): boolean {
    if (!this.orderlist?.items?.length) return false;
    if (this.allItemsCompleted) return false;
    const s = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    return s === 'active' || s === 'ongoing' || s === 'in progress';
  }

  get chatDisabledReason(): string {
    if (this.allItemsCompleted) return 'All items are completed. Chat is now read-only.';
    const s = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    if (s === 'pending') return 'Order is under approval by artist.';
    if (s === 'completed' || s === 'complete' || s === 'done') return 'This order has been completed. Chat is now read-only.';
    return 'Chat is unavailable at this time.';
  }

  get progressDisplay(): number { return Math.round(this.uploadProgress); }

  getItemStatus(index: number): string {
    if (this.itemStatusMap[index] !== undefined) return this.itemStatusMap[index];
    const item = this.orderlist?.items?.[index];
    return ((item?.status || item?.Status) ?? 'none').toLowerCase().trim();
  }
  get currentItemStatus(): string { return this.getItemStatus(this.itemposition()); }
  isItemStatusActive(...statuses: string[]): boolean { return statuses.map(s => s.toLowerCase()).includes(this.currentItemStatus); }

  get isItemUploaded(): boolean {
    const idx = this.itemposition();
    let urls = this.orderlist?.item_urls;
    if (typeof urls === 'string' && urls !== 'null') {
      try { urls = JSON.parse(urls); this.orderlist.item_urls = urls; } catch (e) {}
    }
    if (!urls || urls === 'null' || !Array.isArray(urls)) return false;
    return !!(urls[idx]?.img_url || urls[idx]?.file_url);
  }

  get completedCount(): number {
    if (!this.orderlist?.items?.length) return 0;
    return this.orderlist.items.filter((_: any, i: number) => {
      const s = this.getItemStatus(i);
      return s === 'completed' || s === 'pending_approval';
    }).length;
  }
  get totalItems(): number { return this.orderlist?.items?.length || 0; }
  get progressPercent(): number { if (this.totalItems === 0) return 0; return Math.round((this.completedCount / this.totalItems) * 100); }

  // ── UPLOAD & REVISION COUNTERS ────────────────────────────────

  get currentItemUploadCount(): number {
    const idx = this.itemposition();
    return this.orderlist?.items?.[idx]?.upload_count ?? 0;
  }

  get currentItemRevisionCount(): number {
    const idx = this.itemposition();
    return this.orderlist?.items?.[idx]?.revision_count ?? 0;
  }

  get effectiveRevisionCount(): number {
    return Math.max(this.currentItemRevisionCount, this.rejectedHistory.length);
  }

  get revisionLimitReached(): boolean {
    return this.effectiveRevisionCount >= 4;
  }

  get rejectedHistory(): any[] {
    const idx = this.itemposition();
    const hist = this.orderlist?.items?.[idx]?.revision_history;
    return Array.isArray(hist) ? hist.filter((h: any) => h.status === 'rejected') : [];
  }

  // ── MARK COMPLETE GUARDS ──────────────────────────────────────

  get isOrderPending(): boolean {
    return (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim() === 'pending';
  }

  get canMarkOrderComplete(): boolean {
    const orderStatus = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    if (this.ITEM_DONE.has(orderStatus)) return false;
    return this.allItemsCompleted;
  }

  // ── CATALOG GUARD ─────────────────────────────────────────────
  get isCurrentItemAddedToCatalog(): boolean {
    return this.addToItemsSuccessIdx.includes(this.itemposition());
  }

  // ── LIGHTBOX ──────────────────────────────────────────────────
  openHistoryLightbox(entry: any): void { this.historyLightboxEntry = entry; this.historyLightboxOpen = true; }
  closeHistoryLightbox(): void { this.historyLightboxOpen = false; this.historyLightboxEntry = null; }

  // ── MARK COMPLETE MODAL ───────────────────────────────────────
  openMarkCompleteModal(): void { this.markCompleteModalOpen = true; this.markCompleteErr.set(''); }
  closeMarkCompleteModal(): void { this.markCompleteModalOpen = false; this.markCompleteErr.set(''); }

  confirmMarkComplete(): void {
    if (this.markCompleteLoading()) return;
    this.markCompleteLoading.set(true);
    this.markCompleteErr.set('');

    this.orderstatus.completeOrder(String(this.orderlist.Order_ID)).subscribe({
      next: (res: any) => {
        this.markCompleteLoading.set(false);

        if (res?.error) {
          this.markCompleteErr.set(res?.message ?? 'Failed to mark as complete.');
          return;
        }

        this.orderlist.Status  = 'completed';
        this.orderlist.end_date = new Date().toISOString();

        this.orderlist.items?.forEach((_: any, i: number) => {
          this.itemStatusMap[i] = 'completed';
          if (this.orderlist.items[i]) this.orderlist.items[i].status = 'completed';
        });

        this.markCompleteModalOpen = false;
        this.cd.detectChanges();
        this._syncUrlParams();
      },
      error: (err: any) => {
        this.markCompleteLoading.set(false);
        this.markCompleteErr.set(err?.message ?? 'Failed to mark as complete.');
      }
    });
  }

  // ── ADD TO ITEMS CATALOG ──────────────────────────────────────
  addToItemsCatalog(): void {
    if (this.addToItemsLoading() || this.isCurrentItemAddedToCatalog) return;
    const idx  = this.itemposition();
    const item = this.orderlist?.items?.[idx];
    let   urls = this.orderlist?.item_urls;
    if (typeof urls === 'string') { try { urls = JSON.parse(urls); } catch (e) {} }
    const itemUrl = Array.isArray(urls) ? urls[idx] : null;
    if (!item || !itemUrl) return;

    this.addToItemsLoading.set(true);

    const catalogPayload = {
      name:       item.name,
      price:      item.price    ?? 0,
      discount:   0,
      image_url:  itemUrl.img_url  ?? '',
      url:        itemUrl.file_url ?? '',
    };

    this.itemsservice.uploadandcreate(catalogPayload).subscribe({
      next: (res: any) => {
        this.addToItemsLoading.set(false);
        if (!res?.error) this.addToItemsSuccessIdx = [...this.addToItemsSuccessIdx, idx];
        this.cd.detectChanges();
      },
      error: () => { this.addToItemsLoading.set(false); this.cd.detectChanges(); },
    });
  }

  private get loggedArtistEmail(): string { return this.artistdata?.[0]?.email || ''; }
  private get loggedArtistName():  string { return this.artistdata?.[0]?.Name  || 'Artist'; }
  private get loggedArtistId(): number | null { return this.artistdata?.[0]?.ID ?? null; }

  get complexityLabel(): string {
    if (this.level <= 20) return 'Simple'; if (this.level <= 40) return 'Easy';
    if (this.level <= 60) return 'Moderate'; if (this.level <= 80) return 'Complex';
    return 'Highly Complex';
  }
  get calculatedPrice(): number { return parseFloat((45 + (this.level / 100) * 55).toFixed(2)); }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-trigger') && !target.closest('.dropdown-menu-styled')) this.dropdownOpen = false;
    if (!target.closest('.status-dropdown-trigger') && !target.closest('.status-dropdown-menu')) this.statusDropdownOpenIndex = null;
    if (!target.closest('.suggestions-wrap')) this.suggestionsOpen = false;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.historyLightboxOpen) this.closeHistoryLightbox();
      if (this.markCompleteModalOpen) this.closeMarkCompleteModal();
    }
  }

  constructor(
    private activeroute: ActivatedRoute, private renderer: Renderer2,
    private downloaderService: DownloaderService, private loggingService: LoggingService,
    private ngZone: NgZone, private cd: ChangeDetectorRef, private socketService: SocketService,
    private datePipe: DatePipe, private productservice: ProductService, private userservice: UsersService,
    private itemsservice: ItemService, private orderstatus: OrderService,
    private authservice: AuthService, private sanitizer: DomSanitizer,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.scrollHandler = this.handleScroll.bind(this);
    window.addEventListener('scroll',    this.scrollHandler, { passive: true });
    window.addEventListener('touchmove', this.scrollHandler, { passive: true });
    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        const cEmail = this.customerEmail$.value;
        if (cEmail && this.socketInitialized) this.socketService.checkOnlineStatus(cEmail);
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.activeroute.queryParams.subscribe(params => {
      const order = params['order'];
      if (order) {
        this.orderlist = JSON.parse(LZString.decompressFromEncodedURIComponent(order));
        if (typeof this.orderlist.item_urls === 'string' && this.orderlist.item_urls !== 'null') {
          try { this.orderlist.item_urls = JSON.parse(this.orderlist.item_urls); } catch (e) { this.orderlist.item_urls = new Array(this.totalItems).fill(null); }
        }
        this.orderId   = String(this.orderlist.Order_ID);
        this.orderId$.next(this.orderId);
        if (this.orderlist?.User_ID) this.getuserdata(this.orderlist.User_ID);
        requestAnimationFrame(() => this._startPendingIpoCanvases());

        // Reset auto-modal flag for this order and run an initial check.
        // Handles the case where the artist opens the detail page AFTER the
        // customer has already approved all items.
        this._autoCompleteModalShown = false;
        this._checkForCompletionAfterRefresh();
      }
    });

    this.authservice.checkAuth().subscribe(response => {
      if (response?.isAuthenticated && response?.user) {
        this.authservice.setUser(response.user);
        if (!this.artistdata) this.getartistdata(response.user.ID);
      }
    });
    this.getdatafromitems();
  }

  ngAfterViewInit(): void {
    if (this.slider && this.sliderWrapper) this.updateSlider();
    if (this.orderlist?.items) requestAnimationFrame(() => this._startPendingIpoCanvases());
    combineLatest([this.orderId$.pipe(filter(id => !!id)), this.artistEmail$.pipe(filter(email => !!email))])
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(([orderId, artistEmail]) => {
        if (this.socketInitialized) return;
        this.socketInitialized = true;
        this.ngZone.run(() => { this.messagedata = []; this.previousLoaded = false; this.cd.detectChanges(); });
        this.initSocketListeners(artistEmail, orderId);
      });
    this.customerEmail$.pipe(filter(e => !!e), takeUntil(this.destroy$))
      .subscribe(customerEmail => { if (this.socketInitialized) setTimeout(() => this.socketService.checkOnlineStatus(customerEmail), 100); });
  }

  ngOnDestroy(): void {
    if (this.loggedArtistEmail) this.socketService.setUserOffline(this.loggedArtistEmail);
    this.destroy$.next(); this.destroy$.complete();
    window.removeEventListener('scroll', this.scrollHandler); window.removeEventListener('touchmove', this.scrollHandler);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    clearTimeout(this.hideTimeout); clearInterval(this._progressInterval); clearTimeout(this._hideZoomTimer);
    Object.values(this._ipoAnimFrames).forEach(id => cancelAnimationFrame(id)); this._ipoAnimFrames = {};
  }

  handleScroll(): void { clearTimeout(this.hideTimeout); this.hideTimeout = setTimeout(() => this.hideZoom(), 150); }

  selitemposition(pos: number): void {
    this.itemposition.set(pos);
    this.premade300x300file = null; this.premadeoriginalfile = null; this.petName = '';
    this.artworkUploadErr.set(''); this.historyLightboxOpen = false;
    this.markCompleteModalOpen = false;
    this.level = 50;
    if (this.slider && this.sliderWrapper) this.updateSlider();
    setTimeout(() => { this.artworkForm?.resetForm(); }, 0);
    requestAnimationFrame(() => {
      const id = 'ipo-tube-canvas-' + pos;
      if (!this._ipoAnimFrames[id]) {
        const canvas = document.getElementById(id) as HTMLCanvasElement | null;
        if (canvas) this._startIpoParticles(canvas, id, this.getItemStatus(pos));
      }
    });
  }

  useSuggestion(text: string): void {
    this.message = text; this.suggestionsOpen = false;
    setTimeout(() => {
      const input = document.getElementById('msgtext') as HTMLInputElement | null;
      if (input) { input.focus(); input.setSelectionRange(text.length, text.length); }
    }, 0);
  }

  trackByMessageId(index: number, item: any): any { return item.Message_ID ?? index; }

  // ─────────────────────────────────────────────────────────────
  // COMPLETION CHECK AFTER REFRESH
  //
  // Fetches fresh item statuses from the API and auto-opens the
  // "Mark Order as Complete" modal the first time all items are
  // found to be customer-approved.
  //
  // Called: (a) on init, (b) whenever any socket message arrives
  // for this order (customer may have approved an item while the
  // artist was on the page).
  // ─────────────────────────────────────────────────────────────
  private _checkForCompletionAfterRefresh(): void {
    if (!this.orderId) return;

    this.orderstatus.getorderbyid(this.orderId).subscribe((res: any) => {
      if (!res || res?.error) return;

      // API returns { Order: [{ ...row }] }
      const orderArr = res?.Order ?? res?.order ?? (Array.isArray(res) ? res : null);
      const fresh    = Array.isArray(orderArr) && orderArr.length ? orderArr[0] : orderArr;
      if (!fresh?.Order_ID) return;

      // Merge fresh item statuses into local state
      let freshItems: any[] = [];
      try {
        const raw = fresh.items ?? fresh.Items;
        freshItems = typeof raw === 'string' ? JSON.parse(raw) : (raw ?? []);
      } catch { freshItems = []; }

      freshItems.forEach((item: any, idx: number) => {
        if (!this.orderlist?.items?.[idx]) return;
        const s = (item.status || item.Status || '').toLowerCase().trim();
        // Only pull from server if the artist hasn't locally overridden this slot
        if (s && this.itemStatusMap[idx] === undefined) {
          this.orderlist.items[idx].status = s;
        }
        if (typeof item.upload_count   === 'number') this.orderlist.items[idx].upload_count   = item.upload_count;
        if (typeof item.revision_count === 'number') this.orderlist.items[idx].revision_count = item.revision_count;

        let rh = item.revision_history ?? item.Revision_History;
        if (typeof rh === 'string' && rh !== 'null') { try { rh = JSON.parse(rh); } catch { rh = null; } }
        if (Array.isArray(rh) && rh.length > 0) this.orderlist.items[idx].revision_history = rh;
      });

      // Merge fresh item_urls
      let freshUrls = fresh.item_urls ?? fresh.Item_Urls;
      if (typeof freshUrls === 'string' && freshUrls !== 'null') {
        try { freshUrls = JSON.parse(freshUrls); } catch { freshUrls = null; }
      }
      if (Array.isArray(freshUrls)) {
        if (!Array.isArray(this.orderlist.item_urls)) {
          this.orderlist.item_urls = new Array(this.totalItems).fill(null);
        }
        freshUrls.forEach((entry: any, idx: number) => {
          if (entry?.img_url) this.orderlist.item_urls[idx] = entry;
        });
      }

      this.cd.detectChanges();

      // Auto-open the "Mark Order Complete" modal once when all items are approved
      if (this.canMarkOrderComplete && !this.markCompleteModalOpen && !this._autoCompleteModalShown) {
        this._autoCompleteModalShown = true;
        this.ngZone.run(() => {
          this.openMarkCompleteModal();
          this.cd.detectChanges();
        });
      }
    });
  }

  // ── ARTWORK UPLOAD ────────────────────────────────────────────

  submitArtwork(): void {
    if (!this.premadeoriginalfile) {
      this.artworkUploadErr.set('Original artwork file is required.');
      return;
    }

    const idx          = this.itemposition();
    const username     = this.loggedArtistEmail || String(this.loggedArtistId ?? idx);
    const displayFile  = this.premade300x300file ?? this.premadeoriginalfile;
    const downloadFile = this.premadeoriginalfile;

    this.artworkUploading.set(true);
    this.artworkUploadErr.set('');

    this.itemsservice.uploadItemFiles([displayFile, downloadFile], username).pipe(
      switchMap((uploadRes: any) => {
        if (uploadRes?.error || !uploadRes?.files) {
          throw new Error(uploadRes?.message ?? 'File upload failed.');
        }

        const [displayPath, downloadPath] = uploadRes.files as [string, string];
        const base = this.productservice.getfilebaseurl();

        const item = this.orderlist.items[idx];
        item.upload_count = (item.upload_count ?? 0) + 1;

        const submittedAt = new Date().toISOString();

        this._patchItemUrls(idx, base + displayPath, base + downloadPath);

        const revisionEntry = {
          upload_number:    item.upload_count,
          img_url:          displayPath,
          file_url:         downloadPath,
          submitted_at:     submittedAt,
          rejected_at:      null,
          rejection_reason: null,
        };

        const itemUrls = {
          img_url:      base + displayPath,
          file_url:     base + downloadPath,
          submitted_at: submittedAt,
        };

        return this.orderstatus.updateItemStatus(
          String(this.orderlist.Order_ID),
          idx,
          'pending_approval',
          undefined,
          revisionEntry,
          itemUrls,
        );
      }),
      catchError(err => {
        this.artworkUploadErr.set(err?.message ?? 'Upload failed.');
        this.artworkUploading.set(false);
        return of(null);
      })
    ).subscribe(res => {
      this.artworkUploading.set(false);

      if (!res || res?.error) {
        this.artworkUploadErr.set(res?.message ?? 'Failed to update item status.');
        return;
      }

      this.itemStatusMap[idx] = 'pending_approval';
      if (this.orderlist?.items?.[idx]) this.orderlist.items[idx].status = 'pending_approval';
      if (res?.order_status) this.orderlist.Status = res.order_status;

      this.premade300x300file  = null;
      this.premadeoriginalfile = null;
      this.petName = '';
      this.level   = 50;
      if (this.slider && this.sliderWrapper) this.updateSlider();
      setTimeout(() => this.artworkForm?.resetForm(), 0);

      this.cd.detectChanges();
      this._syncUrlParams();
    });
  }

  private _patchItemUrls(idx: number, displayUrl: string, downloadUrl: string): void {
    if (typeof this.orderlist.item_urls === 'string' && this.orderlist.item_urls !== 'null') {
      try { this.orderlist.item_urls = JSON.parse(this.orderlist.item_urls); } catch (e) { this.orderlist.item_urls = new Array(this.totalItems).fill(null); }
    }
    if (!this.orderlist.item_urls || this.orderlist.item_urls === 'null' || !Array.isArray(this.orderlist.item_urls)) {
      this.orderlist.item_urls = new Array(this.totalItems).fill(null);
    }
    this.orderlist.item_urls[idx] = { img_url: displayUrl, file_url: downloadUrl, submitted_at: new Date().toISOString() };
  }

  updateItemStatus(index: number, newStatus: string): void {
    if (this.statusUpdateLoading !== null) return;
    this.statusUpdateLoading = index; this.cd.detectChanges();
    this.orderstatus.updateItemStatus(this.orderlist.Order_ID, index, newStatus, this.loggedArtistId ? String(this.loggedArtistId) : undefined).subscribe({
      next: (res: any) => {
        this.itemStatusMap[index] = newStatus;
        if (this.orderlist?.items?.[index]) this.orderlist.items[index].status = newStatus;
        if (res?.order_status) this.orderlist.Status = res.order_status;
        this.statusUpdateLoading = null; this.statusDropdownOpenIndex = null; this.cd.detectChanges();
        requestAnimationFrame(() => {
          const id = 'ipo-tube-canvas-' + index; const canvas = document.getElementById(id) as HTMLCanvasElement | null;
          if (canvas) { cancelAnimationFrame(this._ipoAnimFrames[id]); delete this._ipoAnimFrames[id]; this._startIpoParticles(canvas, id, newStatus); }
        });
        this._syncUrlParams();
      },
      error: (err: any) => { this.statusUpdateLoading = null; this.cd.detectChanges(); this.loggingService.error(err); alert('Failed to update status: ' + (err?.message ?? 'Unknown error')); },
    });
  }

  private initSocketListeners(artistEmail: string, orderId: string): void {
    this.socketService.connect(artistEmail);
    this.socketService.onPreviousMessages().pipe(takeUntil(this.destroy$)).subscribe(msgs => {
      this.ngZone.run(() => {
        if (this.previousLoaded) return;
        this.messagedata = (msgs ? (Array.isArray(msgs) ? msgs : [msgs]) : [])
          .filter((m: any) => this.isValidMessage(m))
          .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        this.previousLoaded = true; this.cd.detectChanges(); this.scrollToBottom();
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
          this.cd.detectChanges();
          this.scrollToBottom();

          // Refresh item statuses from API every time a message arrives.
          // This catches the moment the customer approves the last item
          // while the artist is on this page — auto-opens the modal.
          this._checkForCompletionAfterRefresh();
        }
      });
    });

    this.socketService.onTyping().pipe(takeUntil(this.destroy$)).subscribe(data => {
      const ok = (!data?.orderId || String(data.orderId) === String(this.orderId)) && (!data?.email || data.email !== this.loggedArtistEmail);
      if (!ok) return;
      this.ngZone.run(() => { this.istyping = true; this.cd.detectChanges(); this.scrollToBottom(); });
    });
    this.socketService.onStopTyping().pipe(takeUntil(this.destroy$)).subscribe(data => {
      const ok = (!data?.orderId || String(data.orderId) === String(this.orderId)) && (!data?.email || data.email !== this.loggedArtistEmail);
      if (!ok) return;
      this.ngZone.run(() => { this.istyping = false; this.cd.detectChanges(); });
    });
    this.socketService.onUserStatusUpdate().pipe(takeUntil(this.destroy$)).subscribe(({ email, online }) => {
      this.ngZone.run(() => { if (email === this.customerEmail$.value) { this.isOtherPartyOnline = online; this.cd.detectChanges(); } });
    });
    this.socketService.onOnlineStatusResult().pipe(takeUntil(this.destroy$)).subscribe(({ email, online }) => {
      this.ngZone.run(() => { if (email === this.customerEmail$.value) { this.isOtherPartyOnline = online; this.cd.detectChanges(); } });
    });

    this.socketService.joinOrder(orderId);
    const cEmail = this.customerEmail$.value;
    if (cEmail) setTimeout(() => this.socketService.checkOnlineStatus(cEmail), 100);
  }

  private scrollToBottom(): void {
    if (!this.chatContent) return;
    setTimeout(() => { this.chatContent.nativeElement.scrollTop = this.chatContent.nativeElement.scrollHeight; }, 50);
  }

  getuserdata(Id: number): void {
    this.userservice.getuserprofilebyidnumber(Id).subscribe((response: any) => {
      this.userdata = response.User;
      this.customerEmail$.next(this.userdata?.[0]?.email ?? '');
      this.cd.detectChanges();
    });
  }

  getartistdata(Id: number): void {
    this.userservice.getuserprofilebyidnumber(Id).subscribe((response: any) => {
      this.artistdata = response.User;
      this.cd.detectChanges();
      this.artistEmail$.next(this.artistdata?.[0]?.email ?? '');
    });
  }

  uploadfiles(): void {
    if (!this.message || this.message.trim() === '') { alert('Please enter a message before sending.'); return; }
    this.isSending = true; this.startSmoothProgress();
    if (this.filestoupload) {
      this.productservice.uploadfiles(this.filestoupload).subscribe({
        next: ({ progress, response }) => {
          this.ngZone.run(() => { if (progress > this.uploadProgress) { this.uploadProgress = progress; this.particles = Array.from({ length: 6 }, () => Math.random() * 100); this.cd.markForCheck(); } });
          if (progress === 100 && response) { this.finishProgress(); this.ngZone.run(() => { this.sendUpdate(response.files); }); }
        },
        error: err => { this.finishProgress(); this.resetSendingState(); this.loggingService.error('File upload failed:', err); alert('Upload Failed: ' + err.message); },
      });
    } else { setTimeout(() => { this.finishProgress(); this.sendUpdate(null); }, 500); }
  }

  sendUpdate(files: string[] | null): void {
    const email = this.loggedArtistEmail;
    if (!email || !this.orderId) { this.loggingService.error('sendUpdate: not ready'); this.resetSendingState(); return; }
    const payload = {
      date: new Date().toISOString(), text: this.message, Order_ID: this.orderId,
      username: this.loggedArtistName, User_ID: this.loggedArtistId, email, role: 'artist',
      Pro_url: this.artistdata?.[0]?.Url || null, sendto_id: this.orderlist?.User_ID,
      recipients: [this.orderlist?.Customer_Email],
      Url: files?.length ? this.productservice.getfilebaseurl() + files[0] : null
    };
    this.socketService.sendStopTyping(this.orderId, email);
    this.socketService.sendOrderUpdate(payload);
    this.resetSendingState();
  }

  private resetSendingState(): void { this.isSending = false; this.clearFileInput(); }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.filestoupload = Array.from(input.files) as any; this.isfileselected = true;
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl = URL.createObjectURL(input.files[0]);
  }

  clearFileInput(): void {
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl = null; this.filestoupload = null; this.isfileselected = false; this.message = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  onPremadeFileUpload(event: any): void        { const f = event.target.files[0]; if (f) this.premade300x300file  = f; }
  onPremadeOriginalFileUpload(event: any): void { const f = event.target.files[0]; if (f) this.premadeoriginalfile = f; }
  triggerFileInput(): void { this.fileInput.nativeElement.click(); }

  private startSmoothProgress(): void {
    clearInterval(this._progressInterval); this.uploadProgress = 0; this.uploadInProgress = true;
    this.particles = Array.from({ length: 6 }, () => Math.random() * 100); this.cd.markForCheck();
    this._progressInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.uploadProgress < 88) { const step = Math.max(0.25, (88 - this.uploadProgress) * 0.045); this.uploadProgress = Math.min(88, +(this.uploadProgress + step).toFixed(2)); this.particles = Array.from({ length: 6 }, () => Math.random() * 100); this.cd.markForCheck(); }
      });
    }, 35);
  }

  private finishProgress(): void {
    clearInterval(this._progressInterval); this._progressInterval = null;
    this.ngZone.run(() => { this.uploadProgress = 100; this.particles = Array.from({ length: 10 }, () => Math.random() * 100); this.cd.markForCheck(); });
    setTimeout(() => { this.ngZone.run(() => { this.uploadInProgress = false; this.uploadProgress = 0; this.particles = []; this.cd.markForCheck(); }); }, 750);
  }

  onInput(event: Event): void { const input = event.target as HTMLInputElement; this.level = +input.value; if (this.slider && this.sliderWrapper) this.updateSlider(); }

  updateSlider(): void {
    const sliderEl = this.slider.nativeElement; const sliderWrapperEl = this.sliderWrapper.nativeElement; const val = this.level;
    sliderEl.style.background = `linear-gradient(to right, #38bdf8 0%, #38bdf8 ${val}%, #80a6dc ${val}%, #3980e4 100%)`;
    this.animateLevel = false; setTimeout(() => { this.animateLevel = true; this.cd.detectChanges(); }, 10);
    const percent = (val - +sliderEl.min) / (+sliderEl.max - +sliderEl.min);
    const leftOffset = percent * (sliderEl.offsetWidth - 50) + 25;
    const drip = this.renderer.createElement('div'); this.renderer.addClass(drip, 'drop-splash');
    this.renderer.setStyle(drip, 'left', `${leftOffset - 10}px`); this.renderer.setStyle(drip, 'top', `12px`);
    this.renderer.appendChild(sliderWrapperEl, drip); setTimeout(() => this.renderer.removeChild(sliderWrapperEl, drip), 800);
  }

  DownloadFile(url: string, filename = 'pps-download.png'): void {
    if (!url || url === 'null') return;
    this.downloaderService.downloadFile(url).subscribe({
      next: (blob: Blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = filename;
        document.body.appendChild(link); link.click();
        document.body.removeChild(link); URL.revokeObjectURL(link.href);
      },
      error: () => {
        const link = document.createElement('a');
        link.href = url; link.download = filename; link.target = '_blank'; link.rel = 'noopener noreferrer';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
      }
    });
  }

  get canUploadArtwork(): boolean {
    const s = this.currentItemStatus;
    return s === 'ongoing' || s === 'active' || s === 'in progress';
  }

  private isValidMessage(msg: any): boolean {
    if (!msg) return false;
    const text = msg.text || msg.Text || ''; const url = msg.Url || msg.url || msg.URL || '';
    return (typeof text === 'string' && text.trim().length > 0) || (typeof url === 'string' && url.trim().length > 0 && url !== 'null');
  }

  getdatafromitems(): void { this.itemsservice.getitemdata().subscribe(r => { this.dataofitems = r; }); }

  splitPetImgs(petimgStr: string): string[] {
    if (!petimgStr) return [];
    return petimgStr.split(';').filter(s => s && s !== 'null' && s !== 'undefined');
  }

  onTyping(): void {
    const email = this.loggedArtistEmail; if (!this.orderId || !email) return;
    this.socketService.sendTyping(this.orderId, email); clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => this.socketService.sendStopTyping(this.orderId, email), 1500);
  }

  formatDate(dateString: string): string { return this.datePipe.transform(new Date(dateString), 'd MMMM yyyy - h:mm a') ?? ''; }
  formatDateShort(dateString: string): string { return this.datePipe.transform(new Date(dateString), 'd MMM yyyy · h:mm a') ?? ''; }

  getClassForRole(item: any): string { return item.role === 'user' ? 'in' : 'out'; }
  getSafeProfileImageUrl(url?: string): string { const safe = this.getSafeUrl(url); return safe && safe !== 'null' ? safe : 'assets/images/profile-picture.png'; }
  getMemberProfileUrl(msg: any): string { if (!msg) return ''; return msg.Pro_url || msg.pro_url || msg.Url || msg.url || ''; }
  getSafeUrl(url?: string): string {
    if (!url || url === 'null' || url === 'undefined') return '';
    try { return encodeURI(url.toString().trim()); } catch { return url || ''; }
  }

  linkify(text: string): SafeHtml {
    if (!text) return '';
    const linkedText = text.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8;text-decoration:underline;font-weight:500;">${url}</a>`);
    return this.sanitizer.bypassSecurityTrustHtml(linkedText);
  }

  onImageError(event: Event): void { (event.target as HTMLImageElement).src = 'assets/images/profile-picture.png'; }

  showZoom(event: MouseEvent, imgSrc: string | ArrayBuffer | null): void {
    if (!imgSrc || !this.zoomPreview) return;
    const zoomEl = this.zoomPreview.nativeElement; const img = zoomEl.querySelector('.zoom-image') as HTMLImageElement;
    img.src = imgSrc as string; zoomEl.classList.remove('hide', 'visible'); void zoomEl.offsetWidth; zoomEl.classList.add('visible');
  }

  hideZoom(): void {
    if (!this.zoomPreview) return;
    const zoomEl = this.zoomPreview.nativeElement; zoomEl.classList.add('hide'); setTimeout(() => zoomEl.classList.remove('visible'), 850);
  }

  hideZoomDelayed(): void { clearTimeout(this._hideZoomTimer); this._hideZoomTimer = setTimeout(() => this.hideZoom(), 320); }
  cancelHideZoom(): void  { clearTimeout(this._hideZoomTimer); }

  private _startPendingIpoCanvases(): void {
    if (!this.orderlist?.items) return;
    this.orderlist.items.forEach((_: any, i: number) => {
      const id = 'ipo-tube-canvas-' + i; if (this._ipoAnimFrames[id]) return;
      const canvas = document.getElementById(id) as HTMLCanvasElement | null; if (!canvas) return;
      this._startIpoParticles(canvas, id, this.getItemStatus(i));
    });
  }

  private _startIpoParticles(canvas: HTMLCanvasElement, id: string, status: string): void {
    const tube = canvas.parentElement as HTMLElement;
    canvas.width = tube.offsetWidth || 200; canvas.height = tube.offsetHeight || 14;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const PALETTES: Record<string, string[]> = {
      active: ['rgba(99,102,241,0.9)','rgba(124,58,237,0.7)','rgba(201,168,76,0.6)'],
      ongoing: ['rgba(99,102,241,0.9)','rgba(124,58,237,0.7)','rgba(201,168,76,0.6)'],
      'in progress': ['rgba(99,102,241,0.9)','rgba(124,58,237,0.7)','rgba(201,168,76,0.6)'],
      completed: ['rgba(201,168,76,0.9)','rgba(124,58,237,0.8)','rgba(255,255,255,0.75)'],
      complete: ['rgba(201,168,76,0.9)','rgba(124,58,237,0.8)','rgba(255,255,255,0.75)'],
      done: ['rgba(201,168,76,0.9)','rgba(124,58,237,0.8)','rgba(255,255,255,0.75)'],
      pending: ['rgba(217,119,6,0.85)','rgba(234,185,74,0.65)'],
      cancelled: ['rgba(220,38,38,0.65)','rgba(239,68,68,0.45)'],
      pending_approval: ['rgba(14,165,233,0.9)','rgba(59,130,246,0.7)','rgba(255,255,255,0.65)'],
    };
    const FILL_RATIO: Record<string, number> = { pending:0.20,active:0.55,ongoing:0.55,'in progress':0.55,pending_approval:0.80,completed:1.0,complete:1.0,done:1.0,cancelled:1.0 };
    const cols = PALETTES[status] ?? PALETTES['pending']; const fillRatio = FILL_RATIO[status] ?? 0.20;
    const count = (status==='done'||status==='completed'||status==='complete')?14:(status==='pending_approval')?12:(status==='active'||status==='ongoing'||status==='in progress')?10:6;
    interface P{x:number;y:number;r:number;vx:number;vy:number;col:string;life:number;}
    const parts: P[] = Array.from({length:count},()=>({x:Math.random()*W*fillRatio,y:H*0.2+Math.random()*H*0.6,r:1+Math.random()*1.4,vx:status==='cancelled'?0:(0.18+Math.random()*0.55),vy:(Math.random()-0.5)*0.18,col:cols[Math.floor(Math.random()*cols.length)],life:Math.random()}));
    const tick=()=>{
      ctx.clearRect(0,0,W,H);
      for(const p of parts){p.life+=0.012;if(status!=='cancelled')p.x+=p.vx;p.y+=p.vy;const alpha=Math.min(1,Math.sin(p.life*Math.PI)*0.85+0.15);ctx.globalAlpha=alpha;ctx.fillStyle=p.col;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();if(p.x>W*fillRatio+4||p.life>1){p.x=Math.random()*4;p.y=H*0.2+Math.random()*H*0.6;p.life=0;p.col=cols[Math.floor(Math.random()*cols.length)];}if(p.y<1)p.vy=Math.abs(p.vy);if(p.y>H-1)p.vy=-Math.abs(p.vy);}
      ctx.globalAlpha=1;this._ipoAnimFrames[id]=requestAnimationFrame(tick);
    };
    tick();
  }

  private _syncUrlParams(): void {
    try {
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(this.orderlist));
      this.router.navigate([], {
        relativeTo: this.activeroute, queryParams: { order: encoded },
        queryParamsHandling: 'merge', replaceUrl: true,
      });
    } catch (e) {}
  }
}