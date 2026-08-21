import {
  AfterViewInit, Component, ElementRef, Inject,
  NgZone, OnDestroy, OnInit, ViewChild, PLATFORM_ID, ChangeDetectorRef
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

type EntranceDir = 'from-top' | 'from-right' | 'from-bottom' | 'from-left' | 'from-topright' | 'from-topleft';

interface Photo {
  url: string;
  label: string;

  // final resting position — set once
  left: number;
  top: number;
  rotation: number;     // scattered tilt, degrees

  // entrance
  entranceDir: EntranceDir;

  // 3-D mouse tilt — only thing rAF touches
  tiltX: number;
  tiltY: number;
  tiltTargetX: number;
  tiltTargetY: number;
  isHovered: boolean;

  // state
  show: boolean;
  exiting: boolean;
  loaded: boolean;

  slotKey: string;
  depth: number;
  zIndex: number;
}

@Component({
  selector: 'app-showcase-gallery',
  standalone: false,
  templateUrl: './showcase-gallery.component.html',
  styleUrls: ['./showcase-gallery.component.css']
})
export class ShowcaseGalleryComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('galleryRef', { static: false }) galleryRef!: ElementRef<HTMLDivElement>;

  imageUrls: string[] = Array.from({ length: 23 }, (_, i) => `/assets/showcase/${i + 1}.webp`);
  labels: string[] = [
   'Paws & Whiskers', 'Tail-Wag Moments', 'Furry Memories', 'Pure Pup Joy',
'Cuddle Chronicles', 'Meowgical Times', 'Joy Unleashed', 'Whisker Wonders',
'Bark & Play', 'Purrfect Days', 'Snuggle Stories', 'Wagging Tails',
'Fuzzy Friends', 'Joyful Jumps', 'Cozy Naps', 'Feline Fancies',
'Happy Howls', 'Chasing Shadows', 'Playful Paws', 'Gentle Growls',
'Golden Retriever Grins', 'Midnight Purrs', 'Sunbeam Snoozers', 'Belly Rub Bliss',
'Zoomie Hours', 'Biscuit Kneaders', 'Nose Boops', 'Flopped Ears',
'Velvet Paws', 'Soggy Snouts', 'Boop the Snoot', 'Window Watchers',
'Treat Time Tales', 'Pawdorable Moments', 'Fur Baby Love', 'Head Tilt Royalty',
'Wet Nose Wonders', 'Dreamland Pups', 'Tongue Out Tuesday', 'Squirrel Alert',
'Sniff & Explore', 'Nap Champion', 'Rolling in Clover', 'Sock Thief Diaries',
'Pillow Fort Cats', 'Midnight Zoomies', 'Ear Scratch Ecstasy', 'Feather Chasers',
'Morning Stretch Club', 'Leash Day Legends', 'Sunspot Seekers', 'Blanket Burrito',
'Floofy & Fabulous', 'Mischief Managed', 'Tiny Toe Beans', 'Snore & Snuggle',
'The Derp Files', 'Studio Paws', 'Portrait Perfection', 'Artful Companions'
  ]; 

  activePhotos: Photo[] = [];
  private occupiedSlots  = new Set<string>();   // slots with live cards
  private exitingSlots   = new Set<string>();   // slots mid-exit animation
  private shuffledImages: string[] = [];
  private rafId = 0;
  private spawnTimer = 0;
  private viewportObserver?: IntersectionObserver;
  private isVisible = false;
  isBrowser: boolean;

  imgWidth  = 260;
  imgHeight = 299;
  maxActive = 5;
  private cols = 3;
  private rows = 2;

  private readonly SPAWN_MS = 1000;
  private readonly DIRS: EntranceDir[] = ['from-top', 'from-right', 'from-bottom', 'from-left', 'from-topright', 'from-topleft'];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────
  ngOnInit(): void {
    if (!this.isBrowser) return;
    this.resetQueue();
    this.updateLimits();
    window.addEventListener('resize', this.onResize);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    if ('IntersectionObserver' in window && this.galleryRef?.nativeElement) {
      this.viewportObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            this.isVisible = true;
            this.startSpawnTimer();
            this.startTiltLoop();
          } else {
            this.isVisible = false;
            this.stopTimers();
          }
        });
      }, { threshold: 0.05 });

      this.viewportObserver.observe(this.galleryRef.nativeElement);
    } else {
      this.isVisible = true;
      this.startSpawnTimer();
      this.startTiltLoop();
    }
  }

  ngOnDestroy(): void {
    if (this.viewportObserver) {
      this.viewportObserver.disconnect();
    }
    this.stopTimers();
    window.removeEventListener('resize', this.onResize);
  }

  private stopTimers(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    if (this.spawnTimer) {
      clearInterval(this.spawnTimer);
      this.spawnTimer = 0;
    }
  }

  // ─── Template ───────────────────────────────────────────────────────
  onImageLoad(photo: Photo): void {
    photo.loaded = true;
    photo.show   = true;
    this.cdr.detectChanges();
  }

  /** Wrapper: only position. Inner: rotation + live tilt. */
  innerTransform(p: Photo): string {
    return `rotate(${p.rotation.toFixed(2)}deg) rotateX(${p.tiltX.toFixed(2)}deg) rotateY(${p.tiltY.toFixed(2)}deg)`;
  }

  onMouseMove(e: MouseEvent, p: Photo, el: HTMLElement): void {
    const r  = el.getBoundingClientRect();
    const dx = (e.clientX - r.left  - r.width  / 2) / (r.width  / 2);
    const dy = (e.clientY - r.top   - r.height / 2) / (r.height / 2);
    p.tiltTargetX = -dy * 18;
    p.tiltTargetY =  dx * 18;
  }

  onMouseEnter(p: Photo): void { p.isHovered = true;  p.zIndex = 500; }
  onMouseLeave(p: Photo): void {
    p.isHovered = false;
    p.tiltTargetX = 0;
    p.tiltTargetY = 0;
    p.zIndex = Math.floor(10 + p.depth * 90);
  }

  trackByPhoto(_: number, p: Photo): string { return p.slotKey; }

  // ─── Responsive ─────────────────────────────────────────────────────
  private onResize = () => this.updateLimits();

  private updateLimits(): void {
    const w = this.galleryRef?.nativeElement.clientWidth || window.innerWidth;

    if      (w <= 360)  { this.maxActive = 4; this.cols = 2; this.rows = 2; this.imgWidth = Math.round(w * 0.42); }
    else if (w <= 480)  { this.maxActive = 4; this.cols = 2; this.rows = 2; this.imgWidth = Math.round(w * 0.40); }
    else if (w <= 640)  { this.maxActive = 4; this.cols = 2; this.rows = 2; this.imgWidth = Math.round(w * 0.36); }
    else if (w <= 768)  { this.maxActive = 4; this.cols = 2; this.rows = 2; this.imgWidth = Math.round(w * 0.30); }
    else if (w <= 900)  { this.maxActive = 4; this.cols = 3; this.rows = 2; this.imgWidth = Math.round(w * 0.28); }
    else if (w <= 1024) { this.maxActive = 6; this.cols = 3; this.rows = 3; this.imgWidth = Math.round(w * 0.26); }
    else if (w <= 1280) { this.maxActive = 6; this.cols = 3; this.rows = 3; this.imgWidth = Math.round(w * 0.24); }
    else if (w <= 1440) { this.maxActive = 8; this.cols = 4; this.rows = 3; this.imgWidth = Math.round(w * 0.21); }
    else                { this.maxActive = 9; this.cols = 4; this.rows = 3; this.imgWidth = Math.round(Math.min(w * 0.19, 340)); }

    this.imgHeight = Math.round(this.imgWidth * 1.15);
  }

  // ─── Image queue ────────────────────────────────────────────────────
  private resetQueue(): void { this.shuffledImages = this.shuffle([...this.imageUrls]); }
  private shuffle(a: any[]): any[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  private nextImage(): string {
    if (!this.shuffledImages.length) this.resetQueue();
    return this.shuffledImages.shift()!;
  }

  // ─── Slot grid — guarantees no overlap ──────────────────────────────
  get cardHeight(): number { return this.imgHeight + 44; }

  private pickSlot(): { left: number; top: number; slotKey: string } | null {
    const el = this.galleryRef?.nativeElement;
    if (!el) return null;
    const cw     = el.clientWidth;
    const ch     = el.clientHeight;
    const topOff = 96;
    const padH   = 8;   // horizontal edge padding

    // Total placeable area = full width minus padding on both sides
    // Slots divide the space where a card's LEFT edge can start (0 → cw-imgWidth)
    const usableW  = cw - padH * 2 - this.imgWidth;
    const usableH  = Math.max(ch - topOff - padH - this.cardHeight, this.cardHeight * (this.rows - 1) + 10);
    const slotW    = usableW  / Math.max(this.cols - 1, 1);  // spacing between card left edges
    const slotH    = usableH  / Math.max(this.rows - 1, 1);

    // No jitter on mobile — keeps a strict 2×2 grid so cards never overlap
    const isMobile = cw <= 768;
    const jitX     = isMobile ? 0 : Math.min((slotW - this.imgWidth)  * 0.25, 14);
    const jitY     = isMobile ? 0 : Math.min((slotH - this.cardHeight) * 0.25, 14);

    const keys: string[] = [];
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols; c++)
        keys.push(`${c}_${r}`);
    this.shuffle(keys);

    for (const key of keys) {
      if (this.occupiedSlots.has(key)) continue;
      if (this.exitingSlots.has(key))  continue;

      const [ci, ri] = key.split('_').map(Number);

      // Direct grid position — col/row index × spacing, clamped to safe range
      const baseL = padH + (this.cols <= 1 ? 0 : ci * slotW);
      const baseT = topOff + (this.rows <= 1 ? 0 : ri * slotH);
      const left  = Math.max(padH, Math.min(baseL + (Math.random() - 0.5) * 2 * jitX, cw - this.imgWidth - padH));
      const top   = Math.max(topOff, Math.min(baseT + (Math.random() - 0.5) * 2 * jitY, ch - this.cardHeight - padH));

      // Desktop secondary guard (slot centres already safe on mobile)
      if (!isMobile) {
        const tooClose = this.activePhotos.some(p =>
          Math.abs(p.left - left) < this.imgWidth   * 0.80 &&
          Math.abs(p.top  - top)  < this.cardHeight * 0.80
        );
        if (tooClose) continue;
      }

      return { left, top, slotKey: key };
    }
    return null;
  }

  // ─── Spawn ──────────────────────────────────────────────────────────
  private spawnPhoto(): void {
    if (!this.galleryRef) return;
    if (this.activePhotos.length >= this.maxActive) return;

    const slot = this.pickSlot();
    if (!slot) return;

    const depth    = Math.random();
    const rotation = (Math.random() - 0.5) * 16;
    const dir      = this.DIRS[Math.floor(Math.random() * this.DIRS.length)];

    const photo: Photo = {
      url:          this.nextImage(),
      label:        this.labels[Math.floor(Math.random() * this.labels.length)],
      left:         slot.left,
      top:          slot.top,
      rotation,
      entranceDir:  dir,
      tiltX: 0, tiltY: 0, tiltTargetX: 0, tiltTargetY: 0, isHovered: false,
      show:         false,
      exiting:      false,
      loaded:       false,
      slotKey:      slot.slotKey,
      depth,
      zIndex:       Math.floor(10 + depth * 90)
    };

    this.occupiedSlots.add(slot.slotKey);
    this.activePhotos.push(photo);
    this.cdr.detectChanges();

    // schedule exit
    const lifetime = 5000 + Math.random() * 4000;
    setTimeout(() => {
      photo.exiting = true;
      photo.show    = false;
      // move slot from occupied → exiting so no new card lands here during shrink
      this.occupiedSlots.delete(photo.slotKey);
      this.exitingSlots.add(photo.slotKey);
      this.cdr.detectChanges();
      setTimeout(() => {
        this.activePhotos = this.activePhotos.filter(p => p !== photo);
        this.exitingSlots.delete(photo.slotKey);
        this.cdr.detectChanges();
      }, 700);
    }, lifetime);
  }

  // ─── Spawn timer ────────────────────────────────────────────────────
  private startSpawnTimer(): void {
    if (this.spawnTimer) return;
    this.zone.runOutsideAngular(() => {
      this.spawnTimer = window.setInterval(
        () => {
          if (!this.isVisible) return;
          this.zone.run(() => this.spawnPhoto());
        },
        this.SPAWN_MS
      );
    });
  }

  // ─── rAF — tilt only ────────────────────────────────────────────────
  private startTiltLoop(): void {
    if (this.rafId) return;
    this.zone.runOutsideAngular(() => {
      const tick = () => {
        if (!this.isVisible) {
          this.rafId = 0;
          return;
        }
        this.rafId = requestAnimationFrame(tick);
        let dirty = false;
        for (const p of this.activePhotos) {
          if (p.tiltX === p.tiltTargetX && p.tiltY === p.tiltTargetY) continue;
          const spd = p.isHovered ? 0.14 : 0.10;
          p.tiltX += (p.tiltTargetX - p.tiltX) * spd;
          p.tiltY += (p.tiltTargetY - p.tiltY) * spd;
          if (!p.isHovered && Math.abs(p.tiltX) < 0.04 && Math.abs(p.tiltY) < 0.04) {
            p.tiltX = 0; p.tiltY = 0;
          }
          dirty = true;
        }
        if (dirty) this.zone.run(() => this.cdr.detectChanges());
      };
      this.rafId = requestAnimationFrame(tick);
    });
  }
}