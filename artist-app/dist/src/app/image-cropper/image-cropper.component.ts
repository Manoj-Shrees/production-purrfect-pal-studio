import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Output,
  ViewChild
} from '@angular/core';
import { LoggingService } from '../Service/Logs/logging.service';

@Component({
  selector: 'app-image-cropper',
  standalone: false,
  templateUrl: './image-cropper.component.html',
  styleUrls: ['./image-cropper.component.css']
})
export class ImageCropperComponent {

@ViewChild('previewImg', { static: false }) previewImg!: ElementRef<HTMLImageElement>;
@ViewChild('cropArea', { static: false }) cropArea!: ElementRef<HTMLDivElement>;
@ViewChild('overlay', { static: false }) overlay!: ElementRef<HTMLCanvasElement>;
@ViewChild('imgContainer', { static: false }) imgContainer!: ElementRef<HTMLDivElement>;
@ViewChild('livePreview', { static: false }) livePreview!: ElementRef<HTMLImageElement>;


  @Output() cropDone = new EventEmitter<{ blob: Blob; url: string }>();
  @Output() cropCancel = new EventEmitter<void>();

  visible = false;
  imageSrc: string | null = null;
  rotation = 0;
  zoom = 1;

  dragging = false;
  resizing = false;
  startX = 0;
  startY = 0;
  currentHandle: string | null = null;

  targetLeft = 0;
  targetTop = 0;
  targetWidth = 0;
  targetHeight = 0;

  currentLeft = 0;
  currentTop = 0;
  currentWidth = 0;
  currentHeight = 0;

  private animationRunning = false;


  constructor(private cdr: ChangeDetectorRef, private loggingService: LoggingService) {}

  /* ================= OPEN ================= */
open(file: File) {
  this.loggingService.log('open called');

  this.visible = true;
  this.imageSrc = null;

  // Force Angular to render modal first
  this.cdr.detectChanges();

  // Wait ONE frame so ViewChild exists
  requestAnimationFrame(() => {
    this.loggingService.log('modal rendered');

    const reader = new FileReader();
    reader.onload = () => {
      this.loggingService.log('file loaded');
      this.imageSrc = reader.result as string;

      // ensure Angular updates <img [src]>
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  });
}




onImageLoad() {
  this.loggingService.log('onImageLoad called');
  if (!this.previewImg?.nativeElement) return;

  requestAnimationFrame(() => {
    this.loggingService.log('Image loaded in cropper');

    this.initCropBounds();
    this.attachCropListeners();
    this.updateTransform();
  });
}



  close() {
    this.visible = false;
    document.body.style.overflow = '';
    this.imageSrc = null;
    this.cropCancel.emit();
    this.animationRunning = false;
  }

  confirm() {
    const bounds = this.getImageBounds();
    const scaleX = this.previewImg.nativeElement.naturalWidth / bounds.w;
    const scaleY = this.previewImg.nativeElement.naturalHeight / bounds.h;

    const sx = (this.currentLeft - bounds.x) * scaleX;
    const sy = (this.currentTop - bounds.y) * scaleY;
    const sw = this.currentWidth * scaleX;
    const sh = this.currentHeight * scaleY;

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;

    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((this.rotation * Math.PI) / 180);
    ctx.scale(this.zoom, this.zoom);
    ctx.drawImage(
      this.previewImg.nativeElement,
      sx,
      sy,
      sw,
      sh,
      -canvas.width / 2,
      -canvas.height / 2,
      canvas.width,
      canvas.height
    );
    ctx.restore();

    canvas.toBlob(blob => {
      if (blob) {
        this.cropDone.emit({
          blob,
          url: URL.createObjectURL(blob)
        });
      }
    }, 'image/png');

    this.close();
  }

  /* ================= TOOLS ================= */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.updateTransform();
  }

  zoomIn() {
    this.zoom = Math.min(3, this.zoom + 0.1);
    this.updateTransform();
  }

  zoomOut() {
    this.zoom = Math.max(0.5, this.zoom - 0.1);
    this.updateTransform();
  }

  private updateTransform() {
    if (!this.previewImg) return;
    this.previewImg.nativeElement.style.transform =
      `rotate(${this.rotation}deg) scale(${this.zoom})`;
  }

  /* ================= POINTER EVENTS ================= */
  private attachCropListeners() {
    if (!this.cropArea) return;

    const cropEl = this.cropArea.nativeElement;

    // Remove previous listeners
    const clone = cropEl.cloneNode(true) as HTMLDivElement;
    cropEl.parentNode?.replaceChild(clone, cropEl);
    this.cropArea = new ElementRef(clone);

    const handles = ['tl','tr','bl','br','tm','bm','lm','rm'];

    clone.addEventListener('pointerdown', (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.classList.contains('handle')) this.startAction(e, null);
    });

    clone.querySelectorAll('.handle').forEach((el) => {
      const h = el as HTMLElement;
      h.addEventListener('pointerdown', (e: PointerEvent) => {
        const handle = handles.find(cls => h.classList.contains(cls)) ?? null;
        this.startAction(e, handle);
      });
    });
  }

  private startAction(e: PointerEvent, handle: string | null) {
    e.preventDefault();
    this.currentHandle = handle;
    this.dragging = !handle;
    this.resizing = !!handle;

    this.startX = e.clientX;
    this.startY = e.clientY;

    const move = (ev: PointerEvent) => this.moveAction(ev);
    const end = () => {
      this.dragging = false;
      this.resizing = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  private moveAction(e: PointerEvent) {
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    this.startX = e.clientX;
    this.startY = e.clientY;

    const b = this.getImageBounds();
    const minSize = 50;

    if (this.dragging) {
      this.targetLeft = Math.min(
        Math.max(b.x, this.targetLeft + dx),
        b.x + b.w - this.targetWidth
      );
      this.targetTop = Math.min(
        Math.max(b.y, this.targetTop + dy),
        b.y + b.h - this.targetHeight
      );
    }

    if (this.resizing && this.currentHandle) {
      const h = this.currentHandle;

      if (h.includes('r')) {
        // Right edge capped to image right boundary
        this.targetWidth = Math.min(this.targetWidth + dx, b.x + b.w - this.targetLeft);
      }

      if (h.includes('l')) {
        // Left edge can't go past image left boundary, width can't go below minSize
        const maxShift = this.targetWidth - minSize;       // how far right we can pull left edge
        const minShift = -(this.targetLeft - b.x);         // how far left we can push left edge
        const clampedDx = Math.min(Math.max(dx, minShift), maxShift);
        this.targetLeft += clampedDx;
        this.targetWidth -= clampedDx;
      }

      if (h.includes('b')) {
        // Bottom edge capped to image bottom boundary
        this.targetHeight = Math.min(this.targetHeight + dy, b.y + b.h - this.targetTop);
      }

      if (h.includes('t')) {
        // Top edge can't go above image top boundary, height can't go below minSize
        const maxShift = this.targetHeight - minSize;
        const minShift = -(this.targetTop - b.y);
        const clampedDy = Math.min(Math.max(dy, minShift), maxShift);
        this.targetTop += clampedDy;
        this.targetHeight -= clampedDy;
      }

      // Final safety clamp for minimums
      this.targetWidth = Math.max(minSize, this.targetWidth);
      this.targetHeight = Math.max(minSize, this.targetHeight);
    }
  }

  /* ================= ANIMATION ================= */
  private animate() {
    if (!this.animationRunning) return;

    this.currentLeft += (this.targetLeft - this.currentLeft) * 0.2;
    this.currentTop += (this.targetTop - this.currentTop) * 0.2;
    this.currentWidth += (this.targetWidth - this.currentWidth) * 0.2;
    this.currentHeight += (this.targetHeight - this.currentHeight) * 0.2;

    const crop = this.cropArea.nativeElement;
    crop.style.left = `${this.currentLeft}px`;
    crop.style.top = `${this.currentTop}px`;
    crop.style.width = `${this.currentWidth}px`;
    crop.style.height = `${this.currentHeight}px`;

    this.drawOverlay();
    this.updateLivePreview();

    requestAnimationFrame(() => this.animate());
  }

  /* ================= HELPERS ================= */
  private drawOverlay() {
    const canvas = this.overlay.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const container = this.imgContainer.nativeElement;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(this.currentLeft, this.currentTop, this.currentWidth, this.currentHeight);
  }

 private updateLivePreview() {
  if (!this.imageSrc) return;

  const bounds = this.getImageBounds();

  const scaleX = this.previewImg.nativeElement.naturalWidth / bounds.w;
  const scaleY = this.previewImg.nativeElement.naturalHeight / bounds.h;

  const sx = (this.currentLeft - bounds.x) * scaleX;
  const sy = (this.currentTop - bounds.y) * scaleY;
  const sw = this.currentWidth * scaleX;
  const sh = this.currentHeight * scaleY;

  const previewSize = 120;

  const canvas = document.createElement('canvas');
  canvas.width = previewSize;
  canvas.height = previewSize;

  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, previewSize, previewSize);

  // maintain aspect ratio
  const scale = Math.min(
    previewSize / sw,
    previewSize / sh
  );

  const dw = sw * scale;
  const dh = sh * scale;

  const dx = (previewSize - dw) / 2;
  const dy = (previewSize - dh) / 2;

  ctx.drawImage(
    this.previewImg.nativeElement,
    sx,
    sy,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh
  );

  this.livePreview.nativeElement.src = canvas.toDataURL('image/png');
}


  private getImageBounds() {
    const c = this.imgContainer.nativeElement;
    const img = this.previewImg.nativeElement;

    const cw = c.clientWidth;
    const ch = c.clientHeight;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = cw / ch;

    let w, h;
    if (ir > cr) {
      w = cw;
      h = cw / ir;
    } else {
      h = ch;
      w = ch * ir;
    }

    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
  }

  private initCropBounds() {
    const b = this.getImageBounds();

    this.targetLeft = b.x + b.w * 0.25;
    this.targetTop = b.y + b.h * 0.25;
    this.targetWidth = b.w * 0.5;
    this.targetHeight = b.h * 0.5;

    this.currentLeft = this.targetLeft;
    this.currentTop = this.targetTop;
    this.currentWidth = this.targetWidth;
    this.currentHeight = this.targetHeight;

    this.animationRunning = true;
    this.animate();
  }
}