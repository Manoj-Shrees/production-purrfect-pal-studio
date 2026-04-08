import { ChangeDetectorRef, Component, NgZone, Renderer2 } from '@angular/core';
import { DetailpageService } from '../Service/detail-page/detailpage.service';
import { catchError, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

import { ElementRef, signal, ViewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SocketService } from '../Service/socket/socket.service';
import { UsersService } from '../Service/User/users.service';
import { ProductService } from '../Service/ProductPage/product.service';
import { items } from './models/itemmodel';
import { ItemService } from '../Service/Items/item.service';
import LZString from 'lz-string';
import { OrderCompleteService } from '../Service/Order/order-complete.service';
import { hosturl } from '../Service/servicebasemodel';
import { FormControl, NgForm } from '@angular/forms';
import { DownloaderService } from '../Service/FiledDownload/downloader.service';
import { AuthService } from '../Service/Auth/auth.service';
import { LoggingService } from '../Service/Logs/logging.service';



@Component({
  selector: 'app-detailspage',
  standalone: false,
  templateUrl: './detailspage.component.html',
  styleUrl: './detailspage.component.css',
})
export class DetailspageComponent {
  @ViewChild('fileInput') fileInput!: ElementRef;
  @ViewChild('chatContent') chatContent!: ElementRef<HTMLUListElement>;
  @ViewChild('zoomPreview') zoomPreview!: ElementRef<HTMLImageElement>;

  level = 50;
  animateLevel = true;

  @ViewChild('slider') slider!: ElementRef<HTMLInputElement>;
  @ViewChild('sliderWrapper') sliderWrapper!: ElementRef<HTMLElement>;

  orderlist: any;

  itemposition = signal<number>(0);
  messages: any;
  joinMessage: string = 'hi there';
  orderId: string = '';
  message: string = '';
  messagedata: any[] = [];
  userdata: any;
  artistdata: any;
  filestoupload: any;
  istyping: boolean = false;
  typingTimeout: any;
  isfileselected: boolean = false;
  previewImageUrl: string | null = null;
  premade300x300file: any;
  premadeoriginalfile: any;
  dataofitems: any;
  petName: any;
  sliderValue = 0;
  isSending: boolean = false;

  uploadInProgress = false;
  uploadProgress = 0;
  particles: number[] = [];

  // ── Per-item status management ──────────────────────────────────────────────
  itemStatusMap: Record<number, string> = {};
  statusUpdateLoading: number | null = null;
  statusDropdownOpen = false;

  readonly STATUS_OPTIONS: { value: string; label: string; color: string }[] = [
    { value: 'pending',   label: 'Pending',     color: 'amber'  },
    { value: 'active',    label: 'Active',       color: 'green'  },
    { value: 'completed', label: 'Completed',    color: 'violet' },
    { value: 'cancelled', label: 'Cancelled',    color: 'red'    },
  ];

  // ── IPO particle animation ───────────────────────────────────────────────────
  private _ipoAnimFrames: Record<string, number> = {};

  private socketInitialized = false;
  private previousLoaded = false;
  private scrollHandler!: () => void;
  private hideTimeout: any;
  private _progressInterval: any;
  private _hideZoomTimer: any;

  // ── Chat status ────────────────────────────────────────────────────────────
  get isChatEnabled(): boolean {
    const status = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    return status === 'active' || status === 'ongoing' || status === 'in progress';
  }

  get chatDisabledReason(): string {
    const status = (this.orderlist?.Status || this.orderlist?.status || '').toLowerCase().trim();
    if (status === 'pending') return 'Order is under approval by artist.';
    if (status === 'completed' || status === 'complete' || status === 'done')
      return 'This order has been completed. Chat is now read-only.';
    return 'Chat is unavailable at this time.';
  }

  get progressDisplay(): number {
    return Math.round(this.uploadProgress);
  }

  // ── Per-item status helpers ────────────────────────────────────────────────
  getItemStatus(index: number): string {
    if (this.itemStatusMap[index] !== undefined) return this.itemStatusMap[index];
    const item = this.orderlist?.items?.[index];
    return (
      (item?.status || item?.Status || this.orderlist?.Status || this.orderlist?.status) ?? ''
    ).toLowerCase().trim();
  }

  get currentItemStatus(): string {
    return this.getItemStatus(this.itemposition());
  }

  isItemStatusActive(...statuses: string[]): boolean {
    return statuses.map(s => s.toLowerCase()).includes(this.currentItemStatus);
  }

  get isItemUploaded(): boolean {
    const idx = this.itemposition();
    const urls = this.orderlist?.item_urls;
    if (!urls || urls === 'null' || !Array.isArray(urls)) return false;
    return !!(urls[idx]?.img_url || urls[idx]?.file_url);
  }

  get completedCount(): number {
    const urls = this.orderlist?.item_urls;
    if (!urls || urls === 'null' || !Array.isArray(urls)) return 0;
    return urls.filter((u: any) => u?.img_url || u?.file_url).length;
  }

  get totalItems(): number {
    return this.orderlist?.items?.length || 0;
  }

  get progressPercent(): number {
    if (this.totalItems === 0) return 0;
    return Math.round((this.completedCount / this.totalItems) * 100);
  }

  get canCompleteOrder(): boolean {
    return this.totalItems > 0 && this.completedCount === this.totalItems;
  }

  constructor(
    private activeroute: ActivatedRoute,
    private renderer: Renderer2,
    private downloaderService: DownloaderService,
    private loggingService: LoggingService,
    private ngZone: NgZone,
    private cd: ChangeDetectorRef,
    private socketService: SocketService,
    private datePipe: DatePipe,
    private productservice: ProductService,
    private userservice: UsersService,
    private itemsservice: ItemService,
    private orderstatus: OrderCompleteService,
    private authservice: AuthService
  ) {}

  ngAfterViewInit(): void {
    if (this.slider && this.sliderWrapper) {
      this.updateSlider();
    }
    if (this.orderlist?.items) {
      requestAnimationFrame(() => this._startPendingIpoCanvases());
    }
  }

  ngOnDestroy(): void {
    this.socketService.disconnect();
    window.removeEventListener('scroll', this.scrollHandler);
    window.removeEventListener('touchmove', this.scrollHandler);
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    if (this._progressInterval) clearInterval(this._progressInterval);
    if (this._hideZoomTimer) clearTimeout(this._hideZoomTimer);
    Object.values(this._ipoAnimFrames).forEach(id => cancelAnimationFrame(id));
    this._ipoAnimFrames = {};
  }

  handleScroll() {
    if (this.hideTimeout) clearTimeout(this.hideTimeout);
    this.hideTimeout = setTimeout(() => this.hideZoom(), 150);
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.level = +input.value;
    if (this.slider && this.sliderWrapper) this.updateSlider();
  }

  updateSlider(): void {
    const sliderEl        = this.slider.nativeElement as HTMLInputElement;
    const sliderWrapperEl = this.sliderWrapper.nativeElement as HTMLElement;
    const val = this.level;

    sliderEl.style.background = `linear-gradient(to right, #38bdf8 0%, #38bdf8 ${val}%, #80a6dc ${val}%, #3980e4 100%)`;

    this.animateLevel = false;
    setTimeout(() => { this.animateLevel = true; this.cd.detectChanges(); }, 10);

    const percent    = (val - Number(sliderEl.min)) / (Number(sliderEl.max) - Number(sliderEl.min));
    const leftOffset = percent * (sliderEl.offsetWidth - 50) + 25;

    const drip = this.renderer.createElement('div');
    this.renderer.addClass(drip, 'drop-splash');
    this.renderer.setStyle(drip, 'left', `${leftOffset - 10}px`);
    this.renderer.setStyle(drip, 'top', `12px`);
    this.renderer.appendChild(sliderWrapperEl, drip);
    setTimeout(() => this.renderer.removeChild(sliderWrapperEl, drip), 800);
  }

  DownloadFile(url: string) {
    this.downloaderService.downloadFile(url).subscribe(
      (response: Blob) => {
        const blob        = new Blob([response], { type: 'image/png' });
        const downloadUrl = URL.createObjectURL(blob);
        const a           = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'pps-watermark.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      },
      (error) => console.error('Error downloading image:', error)
    );
  }

  ngOnInit(): void {
    this.scrollHandler = this.handleScroll.bind(this);
    window.addEventListener('scroll', this.scrollHandler, { passive: true });
    window.addEventListener('touchmove', this.scrollHandler, { passive: true });

    this.activeroute.queryParams.subscribe(params => {
      const order = params['order'];
      if (order) {
        this.orderlist = JSON.parse(LZString.decompressFromEncodedURIComponent(order));
        this.orderId   = this.orderlist.Order_ID;
        this.tryInitSocket();
        requestAnimationFrame(() => this._startPendingIpoCanvases());
      }
    });

    this.authservice.checkAuth().subscribe(response => {
      if (response?.isAuthenticated && response?.user) {
        this.authservice.setUser(response.user);
        const { ID } = response.user;
        if (this.artistdata == null) this.getartistdata(ID);
      }
    });

    if (this.orderlist?.User_ID) this.getuserdata(this.orderlist.User_ID);

    this.getdatafromitems();
  }

  // ═══════════════════════ SOCKET ═══════════════════════

  tryInitSocket(): void {
    if (this.socketInitialized) return;
    if (this.orderId && this.artistdata?.[0]?.email) {
      this.initSocket();
      this.socketInitialized = true;
    }
  }

  private initSocket(): void {
    // ─── IMPORTANT: Register ALL listeners BEFORE joining the room ───
    // If joinOrder() is called first and the server responds with
    // previousMessages before the listener is wired up, the event is
    // silently dropped and messages never appear.

    this.socketService.connect(this.artistdata[0].email);

    // 1. Wire up listeners FIRST
    this.socketService.onPreviousMessages().subscribe(msgs => {
      this.ngZone.run(() => {
        if (this.previousLoaded) return;
        this.messagedata    = msgs ? (Array.isArray(msgs) ? msgs : [msgs]) : [];
        this.previousLoaded = true;
        this.loggingService.log('Previous messages loaded:', this.messagedata);
        this.cd.detectChanges();
        this.scrollToBottom();
      });
    });

    this.socketService.onNewMessage().subscribe(msg => {
      if (!msg) return;
      this.ngZone.run(() => {
        this.messagedata = [...this.messagedata, msg];
        this.cd.detectChanges();
        this.scrollToBottom();
      });
    });

    this.socketService.onTyping().subscribe(() => {
      this.ngZone.run(() => {
        this.istyping = true;
        this.cd.detectChanges();
        this.scrollToBottom(); // keep typing indicator visible
      });
    });

    this.socketService.onStopTyping().subscribe(() => {
      this.ngZone.run(() => { this.istyping = false; this.cd.detectChanges(); });
    });

    // 2. Join the room AFTER all listeners are registered
    this.socketService.joinOrder(this.orderId);
  }

  private scrollToBottom(): void {
    if (!this.chatContent) return;
    setTimeout(() => {
      this.chatContent.nativeElement.scrollTop = this.chatContent.nativeElement.scrollHeight;
    }, 50);
  }

  getuserdata(Id: number) {
    this.userservice.getuserprofilebyidnumber(Id).subscribe((response: any) => {
      this.userdata = response.User;
      this.cd.detectChanges();
      this.tryInitSocket();
    });
  }

  getartistdata(Id: number) {
    this.userservice.getuserprofilebyidnumber(Id).subscribe((response: any) => {
      this.artistdata = response.User;
      this.cd.detectChanges();
      this.tryInitSocket();
    });
  }

  // ═══════════════════════ PER-ITEM STATUS ═══════════════════════

  updateItemStatus(index: number, newStatus: string): void {
    if (this.statusUpdateLoading !== null) return;
    this.statusUpdateLoading = index;
    this.cd.detectChanges();

    this.orderstatus.updateItemStatus(this.orderlist.Order_ID, index, newStatus)
      .subscribe({
        next: () => {
          this.itemStatusMap[index] = newStatus;
          if (this.orderlist?.items?.[index]) {
            this.orderlist.items[index].status = newStatus;
          }
          this.statusUpdateLoading = null;
          this.statusDropdownOpen  = false;
          this.cd.detectChanges();

          const id = 'ipo-tube-canvas-' + index;
          if (this._ipoAnimFrames[id]) {
            cancelAnimationFrame(this._ipoAnimFrames[id]);
            delete this._ipoAnimFrames[id];
          }
          requestAnimationFrame(() => {
            const canvas = document.getElementById(id) as HTMLCanvasElement | null;
            if (canvas) this._startIpoParticles(canvas, id, newStatus);
          });
        },
        error: (err: any) => {
          this.statusUpdateLoading = null;
          this.cd.detectChanges();
          this.loggingService.error(err);
          alert('Failed to update status: ' + (err?.message ?? 'Unknown error'));
        }
      });
  }

  // ═══════════════════════ IPO PARTICLES ═══════════════════════

  private _startPendingIpoCanvases(): void {
    if (!this.orderlist?.items) return;
    this.orderlist.items.forEach((_: any, i: number) => {
      const id = 'ipo-tube-canvas-' + i;
      if (this._ipoAnimFrames[id]) return;
      const canvas = document.getElementById(id) as HTMLCanvasElement | null;
      if (!canvas) return;
      const status = this.getItemStatus(i);
      this._startIpoParticles(canvas, id, status);
    });
  }

  private _startIpoParticles(
    canvas: HTMLCanvasElement,
    id: string,
    status: string
  ): void {
    const tube = canvas.parentElement as HTMLElement;
    canvas.width  = tube.offsetWidth  || 200;
    canvas.height = tube.offsetHeight || 14;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    const PALETTES: Record<string, string[]> = {
      active:    ['rgba(99,102,241,0.9)',  'rgba(124,58,237,0.7)',  'rgba(201,168,76,0.6)'],
      ongoing:   ['rgba(99,102,241,0.9)',  'rgba(124,58,237,0.7)',  'rgba(201,168,76,0.6)'],
      'in progress': ['rgba(99,102,241,0.9)', 'rgba(124,58,237,0.7)', 'rgba(201,168,76,0.6)'],
      completed: ['rgba(201,168,76,0.9)',  'rgba(124,58,237,0.8)',  'rgba(255,255,255,0.75)'],
      complete:  ['rgba(201,168,76,0.9)',  'rgba(124,58,237,0.8)',  'rgba(255,255,255,0.75)'],
      done:      ['rgba(201,168,76,0.9)',  'rgba(124,58,237,0.8)',  'rgba(255,255,255,0.75)'],
      pending:   ['rgba(217,119,6,0.85)',  'rgba(234,185,74,0.65)'],
      cancelled: ['rgba(220,38,38,0.65)',  'rgba(239,68,68,0.45)'],
    };

    const FILL_RATIO: Record<string, number> = {
      pending: 0.20, active: 0.55, ongoing: 0.55, 'in progress': 0.55,
      completed: 1.0, complete: 1.0, done: 1.0, cancelled: 1.0,
    };

    const cols      = PALETTES[status] ?? PALETTES['pending'];
    const fillRatio = FILL_RATIO[status] ?? 0.20;
    const count     = (status === 'done' || status === 'completed' || status === 'complete') ? 14
                    : (status === 'active' || status === 'ongoing' || status === 'in progress') ? 10 : 6;

    interface Particle { x: number; y: number; r: number; vx: number; vy: number; col: string; life: number; }

    const particles: Particle[] = Array.from({ length: count }, () => ({
      x:    Math.random() * W * fillRatio,
      y:    H * 0.2 + Math.random() * H * 0.6,
      r:    1 + Math.random() * 1.4,
      vx:   status === 'cancelled' ? 0 : (0.18 + Math.random() * 0.55),
      vy:   (Math.random() - 0.5) * 0.18,
      col:  cols[Math.floor(Math.random() * cols.length)],
      life: Math.random(),
    }));

    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.life += 0.012;
        if (status !== 'cancelled') p.x += p.vx;
        p.y += p.vy;

        const alpha = Math.min(1, Math.sin(p.life * Math.PI) * 0.85 + 0.15);
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = p.col;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        if (p.x > W * fillRatio + 4 || p.life > 1) {
          p.x    = Math.random() * 4;
          p.y    = H * 0.2 + Math.random() * H * 0.6;
          p.life = 0;
          p.col  = cols[Math.floor(Math.random() * cols.length)];
        }
        if (p.y < 1)   p.vy =  Math.abs(p.vy);
        if (p.y > H-1) p.vy = -Math.abs(p.vy);
      }
      ctx.globalAlpha = 1;
      this._ipoAnimFrames[id] = requestAnimationFrame(tick);
    };
    tick();
  }

  // ═══════════════════════ FILE HANDLING ═══════════════════════

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.filestoupload = Array.from(input.files) as any;
    this.isfileselected = true;
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl = URL.createObjectURL(input.files[0]);
  }

  clearFileInput(): void {
    if (this.previewImageUrl) URL.revokeObjectURL(this.previewImageUrl);
    this.previewImageUrl  = null;
    this.filestoupload    = null;
    this.isfileselected   = false;
    this.message          = '';
    if (this.fileInput) this.fileInput.nativeElement.value = '';
  }

  // ═══════════════════════ SMOOTH PROGRESS ═══════════════════════

  private startSmoothProgress(): void {
    if (this._progressInterval) clearInterval(this._progressInterval);

    this.uploadProgress  = 0;
    this.uploadInProgress = true;
    this.particles       = Array.from({ length: 6 }, () => Math.random() * 100);
    this.cd.markForCheck();

    this._progressInterval = setInterval(() => {
      this.ngZone.run(() => {
        if (this.uploadProgress < 88) {
          const step = Math.max(0.25, (88 - this.uploadProgress) * 0.045);
          this.uploadProgress  = Math.min(88, +(this.uploadProgress + step).toFixed(2));
          this.particles       = Array.from({ length: 6 }, () => Math.random() * 100);
          this.cd.markForCheck();
        }
      });
    }, 35);
  }

  private finishProgress(): void {
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
      this._progressInterval = null;
    }
    this.ngZone.run(() => {
      this.uploadProgress = 100;
      this.particles      = Array.from({ length: 10 }, () => Math.random() * 100);
      this.cd.markForCheck();
    });

    setTimeout(() => {
      this.ngZone.run(() => {
        this.uploadInProgress = false;
        this.uploadProgress   = 0;
        this.particles        = [];
        this.cd.markForCheck();
      });
    }, 750);
  }

  // ═══════════════════════ SEND / UPLOAD ═══════════════════════

  uploadfiles(): void {
    if (!this.message || this.message.trim() === '') {
      alert('Please enter a message before sending.');
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
              this.particles      = Array.from({ length: 6 }, () => Math.random() * 100);
              this.cd.markForCheck();
            }
          });

          if (progress === 100 && response) {
            this.finishProgress();
            this.ngZone.run(() => {
              if (response.files && response.files.length > 0) {
                const newUrl = this.productservice.getfilebaseurl() + response.files[response.files.length - 1];
                if (!this.orderlist.item_urls || this.orderlist.item_urls === 'null') {
                  this.orderlist.item_urls = new Array(this.totalItems).fill(null);
                }
                this.orderlist.item_urls[this.itemposition()] = {
                  img_url: newUrl,
                  file_url: newUrl
                };
              }
              this.sendUpdate(response.files);
            });
          }
        },
        error: err => {
          this.finishProgress();
          this.resetSendingState();
          this.loggingService.error(err);
          alert('Upload Failed: ' + err.message);
        }
      });
    } else {
      setTimeout(() => {
        this.finishProgress();
        this.sendUpdate(null);
      }, 500);
    }
  }

  sendUpdate(files: string[] | null): void {
    const artist   = this.artistdata[0];
    const customer = this.userdata[0];

    const messageData = {
      date:       new Date().toISOString(),
      text:       this.message,
      Order_ID:   this.orderId || 'Unknown',
      username:   artist.Name,
      User_ID:    artist.ID,
      email:      artist.email,
      role:       artist.Type || 'artist',
      Pro_url:    artist.Url && artist.Url !== 'null' ? artist.Url : null,
      sendto_id:  this.orderlist.User_ID,
      recipients: customer?.email ? [customer.email] : [],
      Url: files?.length
        ? this.productservice.getfilebaseurl() + files[files.length - 1]
        : null,
    };

    this.socketService.sendStopTyping(this.orderId, artist.email);
    this.socketService.sendOrderUpdate(messageData);
    this.resetSendingState();
  }

  private resetSendingState(): void {
    this.isSending = false;
    this.clearFileInput();
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  selitemposition(pos: number) {
    this.itemposition.set(pos);
    requestAnimationFrame(() => {
      const id = 'ipo-tube-canvas-' + pos;
      if (!this._ipoAnimFrames[id]) {
        const canvas = document.getElementById(id) as HTMLCanvasElement | null;
        if (canvas) this._startIpoParticles(canvas, id, this.getItemStatus(pos));
      }
    });
  }

  onTyping(): void {
    if (!this.orderId || !this.artistdata?.[0]?.email) return;
    this.socketService.sendTyping(this.orderId, this.artistdata[0].email);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.socketService.sendStopTyping(this.orderId, this.artistdata[0].email);
    }, 1500);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return this.datePipe.transform(date, 'd MMMM yyyy - h:mm a')!;
  }

  getClassForRole(item: any): string {
    return item.role === 'user' ? 'in' : 'out';
  }

  openacceptmodal() {
    const modal = document.getElementById('accept-modal');
    if (modal) modal.style.display = 'block';
  }

  onPremadeFileUpload(event: any) {
    const selectedfile = event.target.files[0];
    if (selectedfile) this.premade300x300file = selectedfile;
  }

  onPremadeOriginalFileUpload(event: any) {
    const selectedfile = event.target.files[0];
    if (selectedfile) this.premadeoriginalfile = selectedfile;
  }

  sendUploadedFile(files: any) {
    const baseurl    = hosturl;
    const itemsdata: items = {
      name:      'hii',
      price:     20,
      discount:  20,
      url:       baseurl + files[1].path,
      image_url: baseurl + files[0].path
    };
    if (files != null) {
      this.itemsservice.uploadandcreate(itemsdata).pipe().subscribe(response => console.log(response));
    }
  }

  getdatafromitems() {
    this.itemsservice.getitemdata().subscribe(response => { this.dataofitems = response; });
  }

  updateOrderToComplete() {
    this.orderstatus.completeorder(this.orderlist.Order_ID).pipe().subscribe(
      response  => console.log('Order status updated successfully:', response),
      error     => console.error('Error updating order status:', error)
    );
  }

  splitPetImgs(petimgStr: string): string[] {
    if (!petimgStr) return [];
    return petimgStr.split(';').filter(s => s && s !== 'null' && s !== 'undefined');
  }

  getPreviewSrc(): string {
    return this.previewImageUrl ?? '';
  }

  trackByMessageId(index: number, item: any): any {
    return item.id || index;
  }

  showZoom(event: MouseEvent, imgSrc: string | ArrayBuffer | null) {
    if (!imgSrc || !this.zoomPreview) return;
    const zoomEl = this.zoomPreview.nativeElement;
    const img    = zoomEl.querySelector('.zoom-image') as HTMLImageElement;
    img.src = imgSrc as string;
    zoomEl.classList.remove('hide');
    zoomEl.classList.remove('visible');
    void zoomEl.offsetWidth;
    zoomEl.classList.add('visible');
  }

  hideZoom() {
    if (!this.zoomPreview) return;
    const zoomEl = this.zoomPreview.nativeElement;
    zoomEl.classList.add('hide');
    setTimeout(() => zoomEl.classList.remove('visible'), 850);
  }

  hideZoomDelayed() {
    if (this._hideZoomTimer) clearTimeout(this._hideZoomTimer);
    this._hideZoomTimer = setTimeout(() => this.hideZoom(), 320);
  }

  cancelHideZoom() {
    if (this._hideZoomTimer) clearTimeout(this._hideZoomTimer);
  }

  getSafeProfileImageUrl(url?: string): string {
    return url ? url.replace('@', '%40') : 'assets/images/profile-picture.png';
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/profile-picture.png';
  }
}