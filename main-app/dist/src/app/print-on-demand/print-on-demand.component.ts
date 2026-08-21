import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import LZString from 'lz-string';

import {
  computeCenter,
  computeFaceBounds,
  computeFill,
  computeFit,
  exportPrint,
  thumbStyle,
  zoomAround,
  drawMockup as drawMockupUtil,
} from './util/canvas.utils';

import {
  GROUPS,
  CanvasSize,
  SIZES,
  ImageTransform,
  CartState,
} from './util/canvas.types';

import { SociallinkService } from '../Service/Sociallinks/sociallink.service';
import { OrderItem } from '../print-on-demand-checkout/util/checkout.types';
import { AuthService } from '../Service/User/auth.service';
import { UsersService } from '../Service/User/users.service';
import { RouteAccessService } from '../Service/User/route-access-service.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { PodSessionService, PodPendingSession } from '../Service/PrintOnDemand/pod-session.service';

export type PendingDialogState = 'hidden' | 'checking' | 'visible';

@Component({
  selector: 'app-print-on-demand',
  standalone: false,
  templateUrl: './print-on-demand.component.html',
  styleUrl: './print-on-demand.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrintOnDemandComponent implements AfterViewInit, OnInit, OnDestroy {

  checkoutOpen = false;
  orderItems: OrderItem[] = [];

  menuOpen = false;
  innerWidth = window.innerWidth;

  @ViewChild('stage') stageRef!: ElementRef<HTMLElement>;
  @ViewChild('mockupCanvas') mockupCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('file') fileRef!: ElementRef<HTMLInputElement>;

  readonly groups = GROUPS;
  readonly thumbStyle = thumbStyle;
  readonly sizesByGroup: Record<string, CanvasSize[]> = {
    Square: SIZES.filter(s => s.group === 'Square'),
    Rectangle: SIZES.filter(s => s.group === 'Rectangle'),
  };

  // ── Size ──────────────────────────────────────────────────────────────────
  size = SIZES[0];
  price = SIZES[0].price;
  priceFading = false;
  ddOpen = false;
  canvasW = 0;
  canvasH = 0;

  // ── Image ─────────────────────────────────────────────────────────────────
  hasImage = false;
  previewUrl: string | null = null;
  selectedFile: File | null = null;
  filename = '';
  filesize = '';
  adjustMode = false;
  zoomLabel = '100%';
  natW = 0;
  natH = 0;
  transform: ImageTransform = { scale: 1, x: 0, y: 0, rotation: 0 };

  // ── Rotation ───────────────────────────────────────────────────────────────
  rotationDeg = 0;
  get rotationLabel(): string { return this.rotationDeg + '°'; }

  faceX = 0; faceY = 0; faceW = 0; faceH = 0;

  // ── Gesture state ─────────────────────────────────────────────────────────
  private dragging = false;
  private startX = 0; private startY = 0;
  private originX = 0; private originY = 0;
  private pinchDist: number | null = null;
  private stagePanning = false;
  private stagePanStartX = 0; private stagePanStartY = 0;
  private stagePanOriginX = 0; private stagePanOriginY = 0;

  // ── Cart ──────────────────────────────────────────────────────────────────
  cartState: CartState = 'idle';
  cartCount = 0;
  qty = 1;

  // ── Auth ──────────────────────────────────────────────────────────────────
  userid = 0;
  userdata: any;
  isloggedin = false;

  private destroy$ = new Subject<void>();

  // ── UI ────────────────────────────────────────────────────────────────────
  toast = '';
  toastVisible = false;
  initialForm: any | null = null;
  dropOverlay = false;
  exporting = false;
  accordion: string | null = null;

  // ── Stage zoom / pan ──────────────────────────────────────────────────────
  stageZoom = 1;
  stagePanX = 0;
  stagePanY = 0;
  isPanning = false;

  get stageZoomLabel(): string { return Math.round(this.stageZoom * 100) + '%'; }
  get stageZoomTransform(): string {
    return `translate(${this.stagePanX}px,${this.stagePanY}px) scale(${this.stageZoom})`;
  }

  // ── Pending session dialog ────────────────────────────────────────────────
  pendingDialogState: PendingDialogState = 'hidden';
  pendingSession: PodPendingSession | null = null;
  pendingImageFound = false;
  pendingDialogBusy = false;

  get pendingSessionAge(): string {
    if (!this.pendingSession) return '';
    const ms = Date.now() - this.pendingSession.timestamp;
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  // ── RAF / timer handles ───────────────────────────────────────────────────
  private loadedImage: HTMLImageElement | null = null;
  private _rafPending = false;
  private _rafId: number | null = null;
  private _sizeRafOuter: number | null = null;
  private _sizeRafInner: number | null = null;
  private toastTimer: any;
  private cartResetTimer: any;
  private dropCount = 0;

  // ── Image loading progress ─────────────────────────────────────────────────
imageLoading = false;
loadProgress = 0;           // 0–100
private _progressTimer: any;

  // ── Watermark ─────────────────────────────────────────────────────────────
  private _wmImg: HTMLImageElement | null = null;
  private _wmLoading = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private socialMedia: SociallinkService,
    private authService: AuthService,
    private userService: UsersService,
    private accessService: RouteAccessService,
    private logging: LoggingService,
    private podSessionService: PodSessionService,
  ) { }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.authService.checkAuth().pipe(takeUntil(this.destroy$)).subscribe(r => {
      this.isloggedin = r.isAuthenticated;
      this.userdata = r.user ? [r.user] : [];
      if (r.user) this.userid = Number(r.user.ID || r.user.id || 0);
      this.cdr.markForCheck();
    });

    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const imageUrl = params['imageUrl'] || params['image'];
      if (imageUrl) {
        this.loadImageFromUrl(imageUrl);
      }
    });

    const hasUrlImage = this.route.snapshot.queryParams['imageUrl'] || this.route.snapshot.queryParams['image'];
    if (!hasUrlImage) {
      setTimeout(() => this.checkPendingSession(), 400);
    }
  }

  ngAfterViewInit(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.resizeMockupCanvas();
        this.setSize();
        this.ensureWatermark();
        const cvs = this.mockupCanvasRef.nativeElement;
        cvs.addEventListener('wheel', e => this.onWheel(e as WheelEvent), { passive: false });
        cvs.addEventListener('touchstart', e => this.onTouchStart(e as TouchEvent), { passive: false });
        cvs.addEventListener('touchmove', e => this.onTouchMove(e as TouchEvent), { passive: false });
        cvs.addEventListener('touchend', () => this.onTouchEnd());
        cvs.addEventListener('mousedown', e => this.onMouseDown(e as MouseEvent));
        cvs.addEventListener('click', e => this.onStageClick(e as MouseEvent));
      });
    });
  }

ngOnDestroy(): void {
  this.destroy$.next();
  this.destroy$.complete();
  clearTimeout(this.toastTimer);
  clearTimeout(this.cartResetTimer);
  clearInterval(this._progressTimer);   // ← add this line
  if (this._rafId !== null) cancelAnimationFrame(this._rafId);
  if (this._sizeRafOuter !== null) cancelAnimationFrame(this._sizeRafOuter);
  if (this._sizeRafInner !== null) cancelAnimationFrame(this._sizeRafInner);
}

  // ── Pending session ───────────────────────────────────────────────────────

  private async checkPendingSession(): Promise<void> {
    if (!this.podSessionService.hasPending()) return;
    const meta = this.podSessionService.loadMetadata();
    if (!meta) return;
    this.pendingSession = meta;
    this.pendingDialogState = 'checking';
    this.cdr.detectChanges();
    const storedFile = await this.podSessionService.loadImage();
    this.pendingImageFound = storedFile !== null;
    if (storedFile) this.loadFileIntoCanvas(storedFile, false);
    this.pendingDialogState = 'visible';
    this.cdr.detectChanges();
  }

  async resumePendingSession(): Promise<void> {
    if (!this.pendingSession || this.pendingDialogBusy) return;
    this.pendingDialogBusy = true;
    this.cdr.detectChanges();
    const session = this.pendingSession;
    this.orderItems = session.items;
    this.cartCount = session.items.length > 0 ? 1 : 0;
    this.initialForm = session.form;
    const matchedSize = SIZES.find(s => s.label === session.items[0]?.label?.replace(' Canvas', ''));
    if (matchedSize) { this.size = matchedSize; this.price = matchedSize.price; }
    if (!this.hasImage) {
      const storedFile = await this.podSessionService.loadImage();
      if (storedFile) this.loadFileIntoCanvas(storedFile, false);
    }
    await this.podSessionService.clearAll({ deleteFromServer: false });
    this.pendingDialogBusy = false;
    this.pendingDialogState = 'hidden';
    this.pendingSession = null;
    this.checkoutOpen = true;
    this.cdr.markForCheck();
    this.showToast('Previous session restored — continue where you left off!');
  }

  async deletePendingSession(): Promise<void> {
    if (this.pendingDialogBusy) return;
    this.pendingDialogBusy = true;
    this.cdr.detectChanges();
    await this.podSessionService.clearAll({ deleteFromServer: true });
    if (this.hasImage && this.pendingImageFound) {
      this.hasImage = false;
      this.previewUrl = null;
      this.selectedFile = null;
      this.loadedImage = null;
      this.natW = this.natH = 0;
      this.rotationDeg = 0;
      this.transform = { scale: 1, x: 0, y: 0, rotation: 0 };
      this.drawMockup();
    }
    this.pendingDialogBusy = false;
    this.pendingDialogState = 'hidden';
    this.pendingSession = null;
    this.pendingImageFound = false;
    this.orderItems = [];
    this.cartCount = 0;
    this.cdr.markForCheck();
    this.showToast('Previous session cleared.');
  }

  // ── Canvas sizing ─────────────────────────────────────────────────────────

  /**
   * Sets the canvas BUFFER to physical pixels (cssSize × devicePixelRatio)
   * so rendering is crisp on retina / HiDPI displays.
   * The CSS size stays at 100 % / 100 % via the stylesheet — no inline style
   * override needed because the canvas element itself never sets width/height
   * as CSS attributes.
   */
  private resizeMockupCanvas(): void {
    const stage = this.stageRef?.nativeElement;
    const cvs   = this.mockupCanvasRef?.nativeElement;
    if (!stage || !cvs) return;
    // Cap dpr at 3 to avoid runaway memory on very-high-density screens.
    const dpr   = Math.min(window.devicePixelRatio || 1, 3);
    const physW = Math.round(stage.clientWidth  * dpr);
    const physH = Math.round(stage.clientHeight * dpr);
    if (physW > 0 && physH > 0 && (cvs.width !== physW || cvs.height !== physH)) {
      cvs.width  = physW;
      cvs.height = physH;
    }
  }

  // ── Draw mockup + watermark ───────────────────────────────────────────────

  drawMockup(): void {
    const cvs = this.mockupCanvasRef?.nativeElement;
    if (!cvs) return;
    if (cvs.width === 0 || cvs.height === 0) {
      this.resizeMockupCanvas();
      if (cvs.width === 0 || cvs.height === 0) return;
    }
    const b = drawMockupUtil(cvs, this.loadedImage as HTMLImageElement,
      this.transform, this.natW, this.natH,
      this.size, this.hasImage, this.canvasW, this.canvasH);
    // b is in LOGICAL pixels (drawMockup divides by dpr internally)
    this.faceX = b.x; this.faceY = b.y; this.faceW = b.w; this.faceH = b.h;
    if (b.w > 0 && b.h > 0) { this.canvasW = b.w; this.canvasH = b.h; }

    if (this.hasImage) this.drawWatermark(cvs);
  }

  // ── Size ──────────────────────────────────────────────────────────────────

  pickSize(s: CanvasSize): void {
    this.size = s; this.ddOpen = false;
    this.animatePrice(s.price);
    this.cdr.markForCheck();
    this._cancelAllRafs();
    this._sizeRafOuter = requestAnimationFrame(() => {
      this._sizeRafOuter = null;
      this._sizeRafInner = requestAnimationFrame(() => {
        this._sizeRafInner = null;
        this.setSize();
      });
    });
  }

  private _cancelAllRafs(): void {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; this._rafPending = false; }
    if (this._sizeRafOuter !== null) { cancelAnimationFrame(this._sizeRafOuter); this._sizeRafOuter = null; }
    if (this._sizeRafInner !== null) { cancelAnimationFrame(this._sizeRafInner); this._sizeRafInner = null; }
  }

  private setSize(): void {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; this._rafPending = false; }
    this.resizeMockupCanvas();
    const cvs   = this.mockupCanvasRef?.nativeElement;
    const stage = this.stageRef?.nativeElement;
    if (!cvs || !stage || cvs.width === 0 || cvs.height === 0) { this.cdr.detectChanges(); return; }

    // computeFaceBounds expects LOGICAL (CSS) pixels — use clientWidth/Height.
    const { fw, fh } = computeFaceBounds(stage.clientWidth, stage.clientHeight, this.size);
    this.canvasW = fw; this.canvasH = fh;

    if (this.hasImage && this.natW > 0 && fw > 0 && fh > 0) {
      const minScale = this._minFillScale(fw, fh, this.natW, this.natH, this.rotationDeg);
      const base     = computeFill(fw, fh, this.natW, this.natH);
      const scale    = Math.max(base.scale, minScale);
      this.transform = { scale, x: (fw - this.natW * scale) / 2, y: (fh - this.natH * scale) / 2, rotation: this.rotationDeg };
      this.zoomLabel = Math.round(scale * 100) + '%';
    }
    this.drawMockup();
    this.cdr.detectChanges();
  }

  private animatePrice(to: number): void {
    this.priceFading = true;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.price = to;
      this.priceFading = false;
      this.cdr.markForCheck();
    }, 180);
  }

  // ── Image loading ─────────────────────────────────────────────────────────

  triggerUpload(): void { this.fileRef.nativeElement.click(); }

  onFileSelect(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
    (e.target as HTMLInputElement).value = '';
  }

private async processFile(file: File): Promise<void> {
  const MAX_SIZE = 10 * 1024 * 1024;
  const MIN_DIM  = 1000;

  this._startProgress(10);  // ← stage 1: validation / start

  if (file.size > MAX_SIZE) {
    this.showToast('Processing large image… please wait.');
    this._advanceProgress(30);  // compressing
    const compressed = await this.compressImage(file, MAX_SIZE);
    if (compressed) {
      file = compressed;
    } else {
      this._endProgress();
      this.showToast('Failed to compress image below 10MB. Please use a smaller file.');
      return;
    }
  }

  this._advanceProgress(55);  // reading dimensions

  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    if (img.naturalWidth < MIN_DIM || img.naturalHeight < MIN_DIM) {
      this.showToast(`Warning: Image resolution (${img.naturalWidth}×${img.naturalHeight}) is lower than recommended 1000 px.`);
    }
    this._advanceProgress(75);  // loading into canvas
    this.loadFileIntoCanvas(file, true);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    this._endProgress();
    this.showToast('Error loading image. Please try another file.');
  };
  img.src = url;
}

  private compressImage(file: File, targetSize: number): Promise<File | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          const MAX_CANVAS = 4000;
          if (width > MAX_CANVAS || height > MAX_CANVAS) {
            const ratio = Math.min(MAX_CANVAS / width, MAX_CANVAS / height);
            width *= ratio; height *= ratio;
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, width, height);
          let quality = 0.9;
          const attemptCompression = () => {
            canvas.toBlob((blob) => {
              if (!blob) return resolve(null);
              if (blob.size <= targetSize || quality <= 0.1) {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              } else {
                quality -= 0.1;
                attemptCompression();
              }
            }, 'image/jpeg', quality);
          };
          attemptCompression();
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  private loadFileIntoCanvas(file: File, showToast: boolean): void {
  const reader = new FileReader();
  this.selectedFile = file;

  reader.onprogress = (e: ProgressEvent) => {
    if (e.lengthComputable) {
      // Map reader progress into the 75–88 band
      const band = 75 + Math.round((e.loaded / e.total) * 13);
      this._advanceProgress(band);
      this.cdr.markForCheck();
    }
  };

  reader.onload = ({ target }) => {
    const url = target?.result as string;
    this.previewUrl = url;
    this.filename = file.name.length > 22 ? file.name.slice(0, 20) + '…' : file.name;
    this.filesize = (file.size / 1_048_576).toFixed(1) + ' MB';
    this._advanceProgress(90);  // decoding image element
    const img = new Image();
    img.onload = () => {
      this.natW = img.naturalWidth; this.natH = img.naturalHeight;
      this.loadedImage = img; this.hasImage = true;
      this.rotationDeg = 0;
      this._advanceProgress(98);
      this.fill();
      // Short delay so the bar reaches 100 visibly before hiding
      setTimeout(() => { this._endProgress(); this.cdr.detectChanges(); }, 220);
      this.cdr.detectChanges();
    };
    img.onerror = () => { this._endProgress(); };
    img.src = url;
  };

  reader.onerror = () => { this._endProgress(); };
  reader.readAsDataURL(file);
  if (showToast) this.showToast('Photo added — use Adjust to reposition');
}

private loadImageFromUrl(url: string): void {
  const filename = url.split('/').pop() || 'artwork.png';

  // Normalize: strip www so fetch origin matches the app's origin (purrfectpal.studio)
  const normalizedUrl = url.replace('https://www.purrfectpal.studio', 'https://purrfectpal.studio');

  this._startProgress(5);
  fetch(normalizedUrl, { credentials: 'omit' })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this._advanceProgress(40);
      return res.blob();
    })
    .then(blob => {
      this._advanceProgress(65);
      const file = new File([blob], filename, { type: blob.type || 'image/png' });
      this.loadFileIntoCanvas(file, false);
    })
    .catch(err => {
      this._endProgress();
      this.logging.error('Failed to load artwork image from URL', err);
      this.showToast('Failed to load image from order tracking.');
    });
}

  // ── Min fill scale ────────────────────────────────────────────────────────

  private _minFillScale(fw: number, fh: number, nw: number, nh: number, deg: number): number {
    if (!fw || !fh || !nw || !nh) return 1;
    const norm = ((deg % 360) + 360) % 360;
    if (norm === 0 || norm === 180) return Math.max(fw / nw, fh / nh);
    if (norm === 90 || norm === 270) return Math.max(fw / nh, fh / nw);
    const rad = (norm * Math.PI) / 180;
    const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    return Math.max(fw / (nw * c + nh * s), fh / (nw * s + nh * c));
  }

  private _face() {
    return { fw: this.faceW > 0 ? this.faceW : this.canvasW, fh: this.faceH > 0 ? this.faceH : this.canvasH };
  }

  // ── Transform controls ────────────────────────────────────────────────────

  fill(): void {
    const { fw, fh } = this._face();
    const minScale = this._minFillScale(fw, fh, this.natW, this.natH, this.rotationDeg);
    const base     = computeFill(fw, fh, this.natW, this.natH);
    const scale    = Math.max(base.scale, minScale);
    this.applyTransform({ scale, x: (fw - this.natW * scale) / 2, y: (fh - this.natH * scale) / 2, rotation: this.rotationDeg });
  }

  fit(): void {
    this.applyTransform({ ...computeFit(this.canvasW, this.canvasH, this.natW, this.natH), rotation: this.rotationDeg });
  }

  center(): void {
    this.applyTransform({ ...computeCenter(this.canvasW, this.canvasH, this.natW, this.natH, this.transform.scale), rotation: this.rotationDeg });
  }

  reset(): void { this.rotationDeg = 0; this.fill(); this.showToast('Reset to fill'); }

  nudgeZoom(delta: number): void {
    this.applyTransform(zoomAround(this.transform, this.faceW / 2, this.faceH / 2, delta));
  }

  // ── Rotation ───────────────────────────────────────────────────────────────

  private _applyRotation(deg: number): void {
    this.rotationDeg = deg;
    if (!this.hasImage || !this.natW) { this.applyTransform({ ...this.transform, rotation: deg }); return; }
    const { fw, fh } = this._face();
    const minScale = this._minFillScale(fw, fh, this.natW, this.natH, deg);
    const scale    = Math.max(this.transform.scale, minScale);
    this.applyTransform({ scale, x: (fw - this.natW * scale) / 2, y: (fh - this.natH * scale) / 2, rotation: deg });
  }

  rotateBy(delta: number): void { this._applyRotation(((this.rotationDeg + delta) % 360 + 360) % 360); }
  rotationReset(): void { this.rotationDeg = 0; this.fill(); }
  snapRotation(): void { this._applyRotation(Math.round(this.rotationDeg / 90) * 90 % 360); }

  // ── Adjust mode ───────────────────────────────────────────────────────────

  toggleAdjust(): void {
    if (!this.hasImage) return;
    this.adjustMode = !this.adjustMode;
    this.drawMockup();
    this.showToast(this.adjustMode ? 'Drag to reposition · Scroll to zoom' : 'Adjustments applied');
  }

  private applyTransform(t: ImageTransform): void {
    this.transform = t;
    this.zoomLabel = Math.round(t.scale * 100) + '%';
    this.cdr.markForCheck();
    if (!this._rafPending) {
      this._rafPending = true;
      this._rafId = requestAnimationFrame(() => { this._rafPending = false; this.drawMockup(); });
    }
  }

  // ── Mouse / Touch ─────────────────────────────────────────────────────────

  onMouseDown(e: MouseEvent): void {
    if (this.adjustMode && this.hasImage) {
      this.dragging = true;
      this.startX = e.clientX; this.startY = e.clientY;
      this.originX = this.transform.x; this.originY = this.transform.y;
      e.preventDefault();
    } else if (this.stageZoom > 1) {
      this.stagePanning = true; this.isPanning = true;
      this.stagePanStartX = e.clientX; this.stagePanStartY = e.clientY;
      this.stagePanOriginX = this.stagePanX; this.stagePanOriginY = this.stagePanY;
      e.preventDefault();
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(e: MouseEvent): void {
    if (this.dragging) {
      this.applyTransform({ ...this.transform, x: this.originX + (e.clientX - this.startX), y: this.originY + (e.clientY - this.startY) });
    } else if (this.stagePanning) {
      this.stagePanX = this.stagePanOriginX + (e.clientX - this.stagePanStartX);
      this.stagePanY = this.stagePanOriginY + (e.clientY - this.stagePanStartY);
      this.clampStagePan();
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void { this.dragging = false; this.stagePanning = false; this.isPanning = false; }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    if (this.adjustMode && this.hasImage) {
      const cvs  = this.mockupCanvasRef.nativeElement;
      const rect = cvs.getBoundingClientRect();
      // faceX/Y are in logical CSS pixels; clientX/Y are also CSS pixels.
      // No dpr ratio needed here — drawMockup returns logical bounds.
      const mx = (e.clientX - rect.left) - this.faceX;
      const my = (e.clientY - rect.top)  - this.faceY;
      this.applyTransform(zoomAround(this.transform, mx, my, e.deltaY > 0 ? -0.06 : 0.06));
    } else {
      const next = Math.min(5, Math.max(1, parseFloat((this.stageZoom + (e.deltaY > 0 ? -0.25 : 0.25)).toFixed(2))));
      this.setStageZoom(next);
    }
  }

  onTouchStart(e: TouchEvent): void {
    if (!this.adjustMode) return;
    if (e.touches.length === 1) {
      this.dragging = true;
      this.startX = e.touches[0].clientX; this.startY = e.touches[0].clientY;
      this.originX = this.transform.x; this.originY = this.transform.y;
    }
    if (e.touches.length === 2) {
      this.pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
    e.preventDefault();
  }

  onTouchMove(e: TouchEvent): void {
    if (!this.adjustMode) return;
    if (e.touches.length === 1 && this.dragging) {
      this.applyTransform({ ...this.transform, x: this.originX + (e.touches[0].clientX - this.startX), y: this.originY + (e.touches[0].clientY - this.startY) });
    }
    if (e.touches.length === 2 && this.pinchDist !== null) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      this.applyTransform(zoomAround(this.transform, this.faceW / 2, this.faceH / 2, (d - this.pinchDist) * 0.004));
      this.pinchDist = d;
    }
    e.preventDefault();
  }

  onTouchEnd(): void { this.dragging = false; this.pinchDist = null; }

  onStageClick(e: MouseEvent): void {
    if (this.hasImage || this.adjustMode) return;
    const cvs  = this.mockupCanvasRef.nativeElement;
    const rect = cvs.getBoundingClientRect();
    // faceX/Y/W/H are in logical CSS pixels; use CSS-pixel mouse coords directly.
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx >= this.faceX && mx <= this.faceX + this.faceW && my >= this.faceY && my <= this.faceY + this.faceH) {
      this.triggerUpload();
    }
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  @HostListener('document:dragenter', ['$event'])
  onDragEnter(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) { this.dropCount++; this.dropOverlay = true; }
  }
  @HostListener('document:dragleave')
  onDragLeave(): void {
    if (--this.dropCount <= 0) { this.dropCount = 0; this.dropOverlay = false; }
  }
  @HostListener('document:dragover', ['$event'])
  onDragOver(e: DragEvent): void { e.preventDefault(); }
  @HostListener('document:drop', ['$event'])
  onDrop(e: DragEvent): void {
    e.preventDefault(); this.dropCount = 0; this.dropOverlay = false;
    const f = e.dataTransfer?.files[0];
    if (f?.type.startsWith('image/')) this.processFile(f);
  }

  // ── Cart ──────────────────────────────────────────────────────────────────

  changeQty(delta: number): void {
    const next = Math.max(1, this.qty + delta);
    if (next !== this.qty) { this.qty = next; this.cdr.markForCheck(); }
  }

  addToCart(): void {
    if (this.cartState !== 'idle') return;
    if (!this.hasImage) { this.showToast('Please upload a photo first'); return; }
    const MAX_SIZE = 10 * 1024 * 1024;
    if (this.selectedFile && this.selectedFile.size > MAX_SIZE) {
      this.showToast('File is too large (max 10MB). Please re-upload a smaller image.');
      return;
    }
    if (this.natW < 1000 || this.natH < 1000) {
      this.showToast('Resolution too low. Minimum 1000 x 1000 required for quality print.');
      return;
    }
    if (this.cartCount >= 1) { this.checkoutOpen = true; return; }
    this.orderItems = [{ label: this.size.label + ' Canvas', qty: this.qty, price: this.size.price, imageUrl: this.previewUrl }];
    this.cartCount = 1; this.cartState = 'success';
    this.cdr.markForCheck();
    this.showToast(`${this.qty}× ${this.size.label} added to cart`);
    clearTimeout(this.cartResetTimer);
    this.cartResetTimer = setTimeout(() => {
      this.cartState = 'idle';
      this.checkoutOpen = true;
      this.cdr.markForCheck();
    }, 600);
  }

  openCheckout(): void {
    if (!this.orderItems.length) { this.showToast('Add an item to your cart first'); return; }
    this.checkoutOpen = true;
  }

  onCheckoutClose(): void { this.checkoutOpen = false; this.cdr.markForCheck(); }

  onCheckoutSubmit(e: { form: any; total: number }): void {
    this.logging.log('Canvas checkout submit', e);
    if (!this.isloggedin) { this.showToast('Please log in to complete your order'); this.router.navigate(['/Login']); return; }
    if (!this.userdata?.[0]) { this.showToast('Loading your account — please try again'); return; }
    const payload = this.orderItems.map(i => ({ label: i.label, qty: i.qty, price: i.price, imageUrl: i.imageUrl ?? null, ...e.form }));
    this.accessService.allowNextAccess();
    this.router.navigate(['/Payment'], {
      queryParams: {
        items:      LZString.compressToEncodedURIComponent(JSON.stringify(payload)),
        totalprice: LZString.compressToEncodedURIComponent(JSON.stringify(e.total)),
        userid:     LZString.compressToEncodedURIComponent(JSON.stringify(this.userid)),
        email:      LZString.compressToEncodedURIComponent(JSON.stringify(this.userdata[0].email)),
        username:   LZString.compressToEncodedURIComponent(JSON.stringify(this.userdata[0].Name)),
      },
    });
  }

  // ── Export ────────────────────────────────────────────────────────────────

  export(): void {
    if (!this.hasImage || this.exporting || !this.loadedImage) return;
    this.exporting = true;
    exportPrint(this.loadedImage, this.transform, this.natW, this.natH, this.size, this.faceW, this.faceH,
      msg => { this.exporting = false; this.showToast(msg); });
  }

  // ── Stage zoom ─────────────────────────────────────────────────────────────

  stageZoomIn(): void  { this.setStageZoom(Math.min(5, parseFloat((this.stageZoom + 0.5).toFixed(2)))); }
  stageZoomOut(): void { this.setStageZoom(Math.max(1, parseFloat((this.stageZoom - 0.5).toFixed(2)))); }
  stageZoomReset(): void { this.stageZoom = 1; this.stagePanX = 0; this.stagePanY = 0; }

  private setStageZoom(z: number): void {
    this.stageZoom = z;
    this.cdr.markForCheck();
    z === 1 ? (this.stagePanX = 0, this.stagePanY = 0) : this.clampStagePan();
  }

  private clampStagePan(): void {
    const stage = this.stageRef?.nativeElement;
    if (!stage) return;
    const maxX = (stage.clientWidth  * (this.stageZoom - 1)) / 2;
    const maxY = (stage.clientHeight * (this.stageZoom - 1)) / 2;
    this.stagePanX = Math.max(-maxX, Math.min(maxX, this.stagePanX));
    this.stagePanY = Math.max(-maxY, Math.min(maxY, this.stagePanY));
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  toggleAccordion(id: string): void { this.accordion = this.accordion === id ? null : id; }

  private showToast(msg: string): void {
    this.toast = msg;
    this.toastVisible = true;
    this.cdr.markForCheck();
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
      this.cdr.markForCheck();
    }, 3000);
  }

  @HostListener('document:click', ['$event'])
  closeDropdown(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.dd-wrap')) this.ddOpen = false;
  }

  @HostListener('window:resize')
  onResize(): void { this.innerWidth = window.innerWidth; this.setSize(); }

  opensocialurl(pos: number): void { this.socialMedia.geturl(pos); }
  toggleMenu(): void { this.menuOpen = !this.menuOpen; }

  // ── Watermark ─────────────────────────────────────────────────────────────

  /** Loads /assets/images/pps-logo.png once; redraws when ready. */
  private ensureWatermark(): void {
    if (this._wmImg || this._wmLoading) return;
    this._wmLoading = true;
    const img = new Image();
    img.onload  = () => { this._wmImg = img; this._wmLoading = false; if (this.hasImage) this.drawMockup(); };
    img.onerror = () => { this._wmLoading = false; };
    img.src = '/assets/images/pps-logo.png';
  }

  /**
   * Draws a brick-tiled, –30° rotated PPS logo at 9% opacity over the canvas
   * face area. Applies ctx.scale(dpr) so coordinates match the logical face
   * bounds returned by drawMockup.
   */
  private drawWatermark(cvs: HTMLCanvasElement): void {
    if (!this._wmImg) { this.ensureWatermark(); return; }
    if (!this.faceW || !this.faceH) return;

    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const dpr   = Math.min(window.devicePixelRatio || 1, 3);
    // faceX/Y/W/H are in logical CSS pixels; scale context to match.
    const wSize = Math.max(32, Math.min(this.faceW, this.faceH) * 0.13);
    const step  = wSize * 3.0;
    const angle = -(Math.PI / 6);

    ctx.save();
    ctx.scale(dpr, dpr);   // draw in logical pixel space
    ctx.beginPath();
    ctx.rect(this.faceX, this.faceY, this.faceW, this.faceH);
    ctx.clip();
    ctx.globalAlpha = 0.09;

    for (let row = -1; row * step < this.faceH + step * 2; row++) {
      for (let col = -1; col * step < this.faceW + step * 2; col++) {
        const cx = this.faceX + col * step + (row % 2 === 0 ? 0 : step / 2);
        const cy = this.faceY + row * step;
        ctx.save();
        ctx.translate(cx + wSize / 2, cy + wSize / 2);
        ctx.rotate(angle);
        ctx.drawImage(this._wmImg, -wSize / 2, -wSize / 2, wSize, wSize);
        ctx.restore();
      }
    }

    ctx.restore();
  }


  // ── Progress helpers ───────────────────────────────────────────────────────

private _startProgress(initial = 8): void {
  clearInterval(this._progressTimer);
  this.imageLoading = true;
  this.loadProgress = initial;
  this.cdr.markForCheck();
}

/** Only advances forward, never backward. */
private _advanceProgress(to: number): void {
  if (to > this.loadProgress) {
    this.loadProgress = to;
    this.cdr.markForCheck();
  }
}

private _endProgress(): void {
  clearInterval(this._progressTimer);
  this.loadProgress = 100;
  this.cdr.markForCheck();
  setTimeout(() => {
    this.imageLoading = false;
    this.loadProgress = 0;
    this.cdr.markForCheck();
  }, 380);
}

}