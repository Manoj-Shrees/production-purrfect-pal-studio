import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoadingService } from '../Service/Loader/loading.service';

@Component({
  selector: 'app-process-loading',
  standalone: false,
  templateUrl: './process-loading.component.html',
  styleUrls: ['./process-loading.component.css']
})
export class ProcessLoadingComponent implements AfterViewInit, OnDestroy {

  progress       = 0;
  visualProgress = 0;
  animationSpeed = 1.2;

  private maxSeenProgress = 0;

  burstTriggered = false;

  @ViewChild('progressCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private centerX!: number;
  private centerY!: number;
  private radius = 108;
  private particles: (Particle | FinishBurstParticle)[] = [];
  private rafId!: number;
  private sub!: Subscription;

  constructor(private loadingService: LoadingService) {}

  ngAfterViewInit(): void {
    const canvas  = this.canvasRef.nativeElement;
    canvas.width  = 280;
    canvas.height = 280;

    this.ctx     = canvas.getContext('2d')!;
    this.centerX = canvas.width  / 2;
    this.centerY = canvas.height / 2;

    this.sub = this.loadingService.progress$.subscribe(p => {
      // FIX 3: Only reset on the explicit sentinel value (-1) emitted by
      // openprocessmodal(). A legitimate p=0 at the start of an XHR upload
      // no longer wipes maxSeenProgress, so the bar never jumps backward.
      if (p < 0) {
        this.maxSeenProgress = 0;
        this.visualProgress  = 0;
        this.progress        = 0;
        this.burstTriggered  = false;
        this.particles       = [];
        return;
      }
      this.maxSeenProgress = Math.max(this.maxSeenProgress, p);
      this.progress        = this.maxSeenProgress;
    });

    this.animate();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.rafId);
    this.sub?.unsubscribe();
  }

  private drawCircle(progress: number) {
    const ctx = this.ctx;
    const { centerX: cx, centerY: cy, radius: r } = this;

    ctx.clearRect(0, 0, 280, 280);

    // Tick marks
    const ticks = 60;
    for (let i = 0; i < ticks; i++) {
      const a    = (i / ticks) * Math.PI * 2 - Math.PI / 2;
      const long = i % 5 === 0;
      const r0   = r + 6;
      const r1   = r0 + (long ? 6 : 3);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.strokeStyle = long ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth   = long ? 1.5 : 0.8;
      ctx.stroke();
    }

    // Track ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth   = 10;
    ctx.stroke();

    if (progress <= 0) return;

    const endAngle = (Math.PI * 2) * (progress / 100) - Math.PI / 2;

    // Soft glow pass
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth   = 18;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Main arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI / 2, endAngle);
    ctx.strokeStyle = 'rgba(0,0,0,0.88)';
    ctx.lineWidth   = 10;
    ctx.lineCap     = 'round';
    ctx.shadowColor = 'rgba(255,255,255,0.6)';
    ctx.shadowBlur  = 10;
    ctx.stroke();
    ctx.shadowBlur  = 0;
  }

  private animate() {
    const diff = this.progress - this.visualProgress;
    const step = Math.max(this.animationSpeed, diff * 0.08);
    if (diff > 0) this.visualProgress = Math.min(this.visualProgress + step, this.progress);

    this.drawCircle(this.visualProgress);

    if (this.visualProgress > 0 && this.visualProgress < 100) {
      const angle = (Math.PI * 2) * (this.visualProgress / 100) - Math.PI / 2;
      const x     = this.centerX + Math.cos(angle) * this.radius;
      const y     = this.centerY + Math.sin(angle) * this.radius;
      for (let i = 0; i < 3; i++) this.particles.push(new Particle(x, y));
    }

    if (this.visualProgress >= 100 && !this.burstTriggered) {
      this.triggerFinishBurst();
      this.burstTriggered = true;
    }

    this.particles = this.particles.filter(p => {
      p.update();
      p.draw(this.ctx);
      return p.life > 0;
    });

    this.rafId = requestAnimationFrame(() => this.animate());
  }

  private triggerFinishBurst() {
    for (let i = 0; i < 130; i++) {
      this.particles.push(new FinishBurstParticle(this.centerX, this.centerY));
    }
  }
}

class Particle {
  x: number; y: number;
  angle: number; speed: number;
  size: number; life: number; opacity: number;

  constructor(x: number, y: number) {
    this.x       = x;
    this.y       = y;
    this.angle   = (Math.random() - 0.5) * Math.PI * 2;
    this.speed   = Math.random() * 2 + 0.5;
    this.size    = Math.random() * 2 + 0.8;
    this.life    = 45;
    this.opacity = 1;
  }

  update() {
    this.x      += Math.cos(this.angle) * this.speed;
    this.y      += Math.sin(this.angle) * this.speed;
    this.speed  *= 0.96;
    this.life--;
    this.opacity = this.life / 45;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.globalAlpha = this.opacity;
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle   = '#000000';
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur  = 14;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }
}

class FinishBurstParticle {
  x: number; y: number;
  angle: number; speed: number;
  size: number; life: number; opacity: number;
  private dark: boolean;

  constructor(x: number, y: number) {
    this.x       = x;
    this.y       = y;
    this.angle   = Math.random() * Math.PI * 2;
    this.speed   = Math.random() * 5 + 2;
    this.size    = Math.random() * 3.5 + 2;
    this.life    = Math.random() * 50 + 45;
    this.opacity = 1;
    this.dark    = Math.random() > 0.35;
  }

  update() {
    this.x      += Math.cos(this.angle) * this.speed;
    this.y      += Math.sin(this.angle) * this.speed;
    this.speed  *= 0.94;
    this.life--;
    this.opacity = this.life / 95;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.globalAlpha = this.opacity;
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle   = this.dark ? '#000000' : 'rgba(255,255,255,0.85)';
    ctx.shadowColor = this.dark ? 'rgba(255,255,255,1)' : 'rgba(0,0,0,0.4)';
    ctx.shadowBlur  = 16;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
  }
}