import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, Inject, NgZone, OnDestroy, PLATFORM_ID, ViewChild } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-art-sharpness-demo',
  standalone: false,
  templateUrl: './art-sharpness-demo.component.html',
  styleUrl: './art-sharpness-demo.component.css'
})
export class ArtSharpnessDemoComponent implements AfterViewInit, OnDestroy {
  @ViewChild('magicCanvas') magicCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('imgContainer') imgContainer!: ElementRef;
  @ViewChild('lens') lens!: ElementRef;
  @ViewChild('zoomImg') zoomImg!: ElementRef;
  @ViewChild('detailPercent') detailPercent!: ElementRef;
  @ViewChild('detailBar') detailBar!: ElementRef;

  selectedStyle: 'realistic' | 'cartoonised' | 'human' = 'realistic';
  mobileViewMode: 'dual' | 'reticle' = 'dual';
  isImageLoading: boolean = false;

  private isBrowser: boolean;
  private isVisible: boolean = false;
  private viewportObserver?: IntersectionObserver;
  private lensAnimFrameId: number | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  setMobileViewMode(mode: 'dual' | 'reticle'): void {
    this.mobileViewMode = mode;
  }

  styleConfig = {
    realistic: {
      label: 'Realistic Art',
      feature: '4K Ultra-Sharp Hand-Drawn Fur & Details',
      src: '/assets/demo/detailedtexturedog.webp'
    },
    cartoonised: {
      label: 'Cartoon & Pop Art',
      feature: 'Clean Vector Stroke & Cell-Shaded Precision',
      src: '/assets/demo/detailtexturecartoon couples.webp'
    },
    human: {
      label: 'Couples & Family',
      feature: 'High-Definition Skin Tone & Digital Portrait Artistry',
      src: '/assets/demo/detailtextturerelasticcouples.webp'
    }
  };

  get currentImageSrc(): string {
    return this.styleConfig[this.selectedStyle].src;
  }

  get selectedStyleLabel(): string {
    return this.styleConfig[this.selectedStyle].label;
  }

  get currentStyleFeature(): string {
    return this.styleConfig[this.selectedStyle].feature;
  }

  @ViewChild('btnRealistic') btnRealistic!: ElementRef;
  @ViewChild('btnCartoon') btnCartoon!: ElementRef;
  @ViewChild('btnHuman') btnHuman!: ElementRef;

  get activeStyleIndex(): number {
    if (this.selectedStyle === 'realistic') return 0;
    if (this.selectedStyle === 'cartoonised') return 1;
    return 2;
  }

  getLiquidSliderTransform(): string {
    let activeBtn: ElementRef | undefined;
    if (this.selectedStyle === 'realistic') activeBtn = this.btnRealistic;
    else if (this.selectedStyle === 'cartoonised') activeBtn = this.btnCartoon;
    else if (this.selectedStyle === 'human') activeBtn = this.btnHuman;

    if (activeBtn?.nativeElement) {
      const el = activeBtn.nativeElement as HTMLElement;
      return `translate(${el.offsetLeft}px, ${el.offsetTop}px)`;
    }

    return `translateX(${this.activeStyleIndex * 100}%)`;
  }

  getLiquidSliderWidth(): string {
    let activeBtn: ElementRef | undefined;
    if (this.selectedStyle === 'realistic') activeBtn = this.btnRealistic;
    else if (this.selectedStyle === 'cartoonised') activeBtn = this.btnCartoon;
    else if (this.selectedStyle === 'human') activeBtn = this.btnHuman;

    if (activeBtn?.nativeElement) {
      const el = activeBtn.nativeElement as HTMLElement;
      return `${el.offsetWidth}px`;
    }

    return '33.333%';
  }

  getLiquidSliderHeight(): string {
    let activeBtn: ElementRef | undefined;
    if (this.selectedStyle === 'realistic') activeBtn = this.btnRealistic;
    else if (this.selectedStyle === 'cartoonised') activeBtn = this.btnCartoon;
    else if (this.selectedStyle === 'human') activeBtn = this.btnHuman;

    if (activeBtn?.nativeElement) {
      const el = activeBtn.nativeElement as HTMLElement;
      return `${el.offsetHeight}px`;
    }

    return '100%';
  }

  private preloaderTimeout: any;

  selectStyle(style: 'realistic' | 'cartoonised' | 'human', event?: MouseEvent): void {
    if (this.selectedStyle === style) return;

    if (this.preloaderTimeout) {
      clearTimeout(this.preloaderTimeout);
    }

    this.isImageLoading = true;
    this.selectedStyle = style;
    this.cdr.detectChanges();

    const startTime = Date.now();
    const minDuration = 450; // Smooth perceptible preloader transition window

    const finishLoading = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDuration - elapsed);

      this.preloaderTimeout = setTimeout(() => {
        this.zone.run(() => {
          this.isImageLoading = false;
          this.cdr.detectChanges();
        });
      }, remaining);
    };

    if (this.isBrowser) {
      const nextSrc = this.styleConfig[style].src;
      const preloader = new Image();
      preloader.onload = () => finishLoading();
      preloader.onerror = () => finishLoading();
      preloader.src = nextSrc;
    } else {
      finishLoading();
    }

    if (event && typeof window !== 'undefined' && this.magicCanvas?.nativeElement) {
      const rect = this.magicCanvas.nativeElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      this.triggerMagicBurst(x, y);
    }
  }

  onImageLoaded(): void {
    // Coordinated by finishLoading in selectStyle
  }

  @ViewChild('zoomedPane') zoomedPane!: ElementRef;

  zoomFactor = 2.0;

  // Smooth motion variables for Reticle Lens
  lensX = 0;
  lensY = 0;
  targetLensX = 0;
  targetLensY = 0;

  // Synchronized HD Zoom Pane Offset
  zoomX = 0;
  zoomY = 0;
  targetZoomX = 0;
  targetZoomY = 0;

  currentDetail = 0;
  targetDetail = 0;

  isReticleVisible = false;

  setZoomFactor(factor: number): void {
    this.zoomFactor = factor;
    if (this.imgContainer?.nativeElement) {
      const rect = this.imgContainer.nativeElement.getBoundingClientRect();
      const cx = this.targetLensX + 52.5;
      const cy = this.targetLensY + 52.5;
      this.updateLensPosition(cx, cy, rect);
    }
  }

  onContainerMouseEnter(): void {
    this.isReticleVisible = true;
  }

  onContainerMouseLeave(): void {
    this.isReticleVisible = false;
    this.targetDetail = 0;
  }

  onContainerTouchStart(e: TouchEvent): void {
    this.isReticleVisible = true;
    if (e.touches && e.touches[0]) {
      this.moveTouch(e.touches[0]);
    }
  }

  onContainerTouchMove(e: TouchEvent): void {
    this.isReticleVisible = true;
    if (e.touches && e.touches[0]) {
      if (e.cancelable) e.preventDefault();
      this.moveTouch(e.touches[0]);
    }
  }

  onContainerTouchEnd(): void {
    this.isReticleVisible = false;
    this.targetDetail = 0;
  }

  ngAfterViewInit() {
    const el = this.imgContainer.nativeElement;
    el.addEventListener('mousemove', this.moveLens.bind(this));
    el.addEventListener('mouseenter', () => {
      this.isReticleVisible = true;
      if (this.lens?.nativeElement) this.lens.nativeElement.style.opacity = '1';
    });
    el.addEventListener('mouseleave', () => {
      this.isReticleVisible = false;
      this.targetDetail = 0;
      if (this.lens?.nativeElement) this.lens.nativeElement.style.opacity = '0';
    });

    // Touch support for mobile devices without viewport scroll glitch
    el.addEventListener('touchstart', (e: TouchEvent) => {
      this.isReticleVisible = true;
      if (this.lens?.nativeElement) this.lens.nativeElement.style.opacity = '1';
      if (e.touches && e.touches[0]) this.moveTouch(e.touches[0]);
    }, { passive: true });

    el.addEventListener('touchmove', (e: TouchEvent) => {
      this.isReticleVisible = true;
      if (this.lens?.nativeElement) this.lens.nativeElement.style.opacity = '1';
      if (e.touches && e.touches[0]) {
        if (e.cancelable) e.preventDefault();
        this.moveTouch(e.touches[0]);
      }
    }, { passive: false });

    el.addEventListener('touchend', () => {
      this.isReticleVisible = false;
      this.targetDetail = 0;
      if (this.lens?.nativeElement) this.lens.nativeElement.style.opacity = '0';
    });

    // Default reticle lens position to center on load
    setTimeout(() => {
      if (!this.imgContainer?.nativeElement) return;
      const rect = this.imgContainer.nativeElement.getBoundingClientRect();
      const lensW = this.lens?.nativeElement?.offsetWidth || 105;
      const lensH = this.lens?.nativeElement?.offsetHeight || 105;
      const cx = rect.width / 2 - lensW / 2;
      const cy = rect.height / 2 - lensH / 2;
      this.lensX = cx; this.targetLensX = cx;
      this.lensY = cy; this.targetLensY = cy;
      this.targetZoomX = -cx * this.zoomFactor;
      this.targetZoomY = -cy * this.zoomFactor;
    }, 80);

    // Initialize Magic Particle Canvas Engine
    this.initMagicParticles();

    if ('IntersectionObserver' in window && this.imgContainer?.nativeElement) {
      this.viewportObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.isVisible = true;
            this.startAnimationLoops();
          } else {
            this.isVisible = false;
            this.stopAnimationLoops();
          }
        });
      }, { threshold: 0.05 });

      this.viewportObserver.observe(this.imgContainer.nativeElement);
    } else {
      this.isVisible = true;
      this.startAnimationLoops();
    }
  }

  private startAnimationLoops(): void {
    if (!this.isBrowser) return;

    this.zone.runOutsideAngular(() => {
      if (!this.lensAnimFrameId) {
        this.animate();
      }
      if (!this.animFrameId && this.ctx) {
        this.loopParticles();
      }
    });
  }

  private stopAnimationLoops(): void {
    if (this.lensAnimFrameId) {
      cancelAnimationFrame(this.lensAnimFrameId);
      this.lensAnimFrameId = null;
    }
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  moveTouch(touch: Touch) {
    const rect = this.imgContainer.nativeElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    this.updateLensPosition(x, y, rect);
  }

  moveLens(e: MouseEvent) {
    const rect = this.imgContainer.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.updateLensPosition(x, y, rect);
  }

  private calculateAccurateDetail(normX: number, normY: number): number {
    let focalPoints: { x: number; y: number; weight: number; radius: number }[] = [];

    if (this.selectedStyle === 'realistic') {
      focalPoints = [
        { x: 0.50, y: 0.42, weight: 0.99, radius: 0.18 }, // Eyes & Nose core
        { x: 0.50, y: 0.55, weight: 0.95, radius: 0.20 }, // Whiskers & Muzzle
        { x: 0.35, y: 0.28, weight: 0.92, radius: 0.22 }, // Left Ear Fur
        { x: 0.65, y: 0.28, weight: 0.92, radius: 0.22 }, // Right Ear Fur
        { x: 0.50, y: 0.72, weight: 0.88, radius: 0.25 }, // Chest Fur
      ];
    } else if (this.selectedStyle === 'cartoonised') {
      focalPoints = [
        { x: 0.48, y: 0.40, weight: 1.00, radius: 0.22 }, // Vector Outlines & Eyes
        { x: 0.52, y: 0.45, weight: 0.96, radius: 0.24 }, // Cell Shading
        { x: 0.40, y: 0.25, weight: 0.94, radius: 0.26 }, // Hair Stroke Lines
        { x: 0.60, y: 0.25, weight: 0.94, radius: 0.26 },
      ];
    } else {
      focalPoints = [
        { x: 0.42, y: 0.38, weight: 0.98, radius: 0.20 }, // Left Face/Eyes
        { x: 0.58, y: 0.38, weight: 0.98, radius: 0.20 }, // Right Face/Eyes
        { x: 0.50, y: 0.55, weight: 0.93, radius: 0.25 }, // Expression & Features
        { x: 0.50, y: 0.22, weight: 0.91, radius: 0.28 }, // Digital Hair Texture
      ];
    }

    let maxScore = 0.70; // Baseline background detail 70%

    for (const pt of focalPoints) {
      const dist = Math.sqrt((normX - pt.x) ** 2 + (normY - pt.y) ** 2);
      if (dist < pt.radius) {
        const factor = 1 - (dist / pt.radius) ** 2;
        const score = 0.70 + (pt.weight - 0.70) * factor;
        if (score > maxScore) maxScore = score;
      }
    }

    const zoomBoost = (this.zoomFactor - 1) * 0.025;
    const finalDetail = Math.min(1.0, maxScore + zoomBoost);

    return Math.round(finalDetail * 100);
  }

  private updateLensPosition(x: number, y: number, rect: DOMRect) {
    const lensW = this.lens?.nativeElement?.offsetWidth || 105;
    const lensH = this.lens?.nativeElement?.offsetHeight || 105;

    // Clamp reticle lens position inside image container bounds
    const lx = Math.max(0, Math.min(x - lensW / 2, rect.width - lensW));
    const ly = Math.max(0, Math.min(y - lensH / 2, rect.height - lensH));

    this.targetLensX = lx;
    this.targetLensY = ly;

    // Reticle center point relative to image container
    const centerXOnImage = lx + lensW / 2;
    const centerYOnImage = ly + lensH / 2;

    // Center exact reticle point in the zoomed pane (rect.width / 2, rect.height / 2)
    const rawZoomX = (rect.width / 2) - (centerXOnImage * this.zoomFactor);
    const rawZoomY = (rect.height / 2) - (centerYOnImage * this.zoomFactor);

    // Clamp zoom bounds so HD zoom pane covers full viewport
    const minZoomX = rect.width - (rect.width * this.zoomFactor);
    const minZoomY = rect.height - (rect.height * this.zoomFactor);

    this.targetZoomX = Math.max(minZoomX, Math.min(0, rawZoomX));
    this.targetZoomY = Math.max(minZoomY, Math.min(0, rawZoomY));

    // Dynamic Line Sharpness Detail Level reflection based on feature location
    const normX = Math.max(0, Math.min(1, x / rect.width));
    const normY = Math.max(0, Math.min(1, y / rect.height));

    this.targetDetail = this.calculateAccurateDetail(normX, normY);
  }

  // Smooth lerp animation loop
  lerp(start: number, end: number, smooth = 0.18) {
    return start + (end - start) * smooth;
  }

  animate() {
    if (!this.isVisible) {
      this.lensAnimFrameId = null;
      return;
    }

    this.lensX = this.lerp(this.lensX, this.targetLensX, 0.55);
    this.lensY = this.lerp(this.lensY, this.targetLensY, 0.55);

    if (this.lens?.nativeElement) {
      this.lens.nativeElement.style.transform = `translate3d(${this.lensX.toFixed(1)}px, ${this.lensY.toFixed(1)}px, 0)`;
    }

    this.zoomX = this.lerp(this.zoomX, this.targetZoomX, 0.45);
    this.zoomY = this.lerp(this.zoomY, this.targetZoomY, 0.45);

    if (this.zoomImg?.nativeElement) {
      this.zoomImg.nativeElement.style.transform = `translate3d(${this.zoomX.toFixed(1)}px, ${this.zoomY.toFixed(1)}px, 0)`;
    }

    this.currentDetail = this.lerp(this.currentDetail, this.targetDetail, 0.18);

    if (this.detailPercent?.nativeElement) {
      this.detailPercent.nativeElement.innerText = `${Math.round(this.currentDetail)}%`;
    }
    if (this.detailBar?.nativeElement) {
      this.detailBar.nativeElement.style.width = `${this.currentDetail}%`;
    }

    this.zone.runOutsideAngular(() => {
      this.lensAnimFrameId = requestAnimationFrame(() => this.animate());
    });
  }

  ngOnDestroy(): void {
    if (this.viewportObserver) {
      this.viewportObserver.disconnect();
    }
    this.stopAnimationLoops();
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onCanvasResize);
    }
  }

  // ─── Magic Particle Animation Engine ──────────────────────────────────────────
  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private particles: Array<{
    x: number;
    y: number;
    size: number;
    vx: number;
    vy: number;
    alpha: number;
    maxAlpha: number;
    life: number;
    maxLife: number;
    color: string;
    shape: 'circle' | 'star';
  }> = [];

  initMagicParticles(): void {
    if (typeof window === 'undefined' || !this.magicCanvas?.nativeElement) return;
    const canvas = this.magicCanvas.nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;

    this.resizeCanvas();
    window.addEventListener('resize', this.onCanvasResize);

    // Initial floating magic particles
    for (let i = 0; i < 45; i++) {
      this.particles.push(this.createParticle(canvas.width, canvas.height, true));
    }

    this.loopParticles();
  }

  private onCanvasResize = () => {
    this.resizeCanvas();
  };

  private resizeCanvas(): void {
    if (!this.magicCanvas?.nativeElement) return;
    const canvas = this.magicCanvas.nativeElement;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    }
  }

  private createParticle(w: number, h: number, randomY = false) {
    const colors = ['#fbbf24', '#a855f7', '#06b6d4', '#ec4899', '#ffffff', '#c084fc', '#fef08a'];
    return {
      x: Math.random() * (w || 800),
      y: randomY ? Math.random() * (h || 600) : (h || 600) + 10,
      size: Math.random() * 3.2 + 1.2,
      vx: (Math.random() - 0.5) * 0.9,
      vy: -(Math.random() * 1.3 + 0.5),
      alpha: 0,
      maxAlpha: Math.random() * 0.75 + 0.25,
      life: 0,
      maxLife: Math.random() * 180 + 120,
      color: colors[Math.floor(Math.random() * colors.length)],
      shape: (Math.random() > 0.6 ? 'star' : 'circle') as 'circle' | 'star'
    };
  }

  triggerMagicBurst(x: number, y: number): void {
    const colors = ['#fbbf24', '#a855f7', '#6366f1', '#ec4899', '#ffffff', '#38bdf8'];
    for (let i = 0; i < 28; i++) {
      const angle = (Math.PI * 2 * i) / 28;
      const speed = Math.random() * 3.8 + 1.8;
      this.particles.push({
        x,
        y,
        size: Math.random() * 4 + 1.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        maxAlpha: 1,
        life: 0,
        maxLife: Math.random() * 45 + 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        shape: Math.random() > 0.4 ? 'star' : 'circle'
      });
    }
  }

  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): void {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  private loopParticles = (): void => {
    if (!this.isVisible) {
      this.animFrameId = null;
      return;
    }
    if (!this.ctx || !this.magicCanvas?.nativeElement) return;
    const canvas = this.magicCanvas.nativeElement;
    const w = canvas.width;
    const h = canvas.height;

    this.ctx.clearRect(0, 0, w, h);

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;

      const progress = p.life / p.maxLife;
      if (progress < 0.2) {
        p.alpha = (progress / 0.2) * p.maxAlpha;
      } else if (progress > 0.8) {
        p.alpha = ((1 - progress) / 0.2) * p.maxAlpha;
      } else {
        p.alpha = p.maxAlpha;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = p.size * 2.5;

      if (p.shape === 'star') {
        this.drawStar(this.ctx, p.x, p.y, 4, p.size * 1.6, p.size * 0.6);
      } else {
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
      }
      this.ctx.restore();

      if (p.life >= p.maxLife || p.y < -20 || p.x < -20 || p.x > w + 20) {
        this.particles.splice(i, 1);
        if (this.particles.length < 40) {
          this.particles.push(this.createParticle(w, h));
        }
      }
    }

    this.zone.runOutsideAngular(() => {
      this.animFrameId = requestAnimationFrame(this.loopParticles);
    });
  };
}
