import {
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  HostListener,
  OnInit,
  OnDestroy,
  AfterViewChecked,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ProfileService }        from '../Service/ArtistProfile/profile.service';
import { InfoService }           from '../Service/ArtistProfile/info.service';
import { RouteAccessService }    from '../Service/Auth/route-access.service';
import { ProfilerefreshService } from '../Service/ProfileRefresh/profilerefresh.service';
import { LoginService }          from '../Service/User/login.service';
import { AuthService }           from '../Service/Auth/auth.service';
import { DetailpageService }     from '../Service/detail-page/detailpage.service';
import { UsersService }          from '../Service/User/users.service';
import { OrderResponse, OrderItem } from '../Service/servicebasemodel';
import { ImageCropperComponent } from '../image-cropper/image-cropper.component';
import { LoggingService } from '../Service/Logs/logging.service';

export interface StatCard  { value: string; label: string; colorClass: string; iconClass: string; }
export interface DetailRow { label: string; value: string; iconClass: string; }
export interface SkillChip { name: string;  iconClass: string; }
export interface NavItem   { label: string; route: string;  iconClass: string; active?: boolean; }

@Component({
  selector: 'app-artist-profile',
  standalone: false,
  templateUrl: './artist-profile.component.html',
  styleUrls: ['./artist-profile.component.css'],
})
export class ArtistProfileComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('fileInput')      fileInput!:      ElementRef<HTMLInputElement>;
  @ViewChild('cropper')        cropper!:        ImageCropperComponent;
  @ViewChild('particleCanvas') particleCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('pwSection')      pwSection!:      ElementRef<HTMLElement>;

  private userId      = 0;
  unsavedChanges      = false;
  private particles:  any[] = [];
  private animFrame:  number = 0;
  private canvasReady = false;

  // ── Core signals ───────────────────────────────────────────────
  artistInfo       = signal<any>(null);
  profileImage     = signal<string>('');
  isUploading      = signal(false);
  pastOrderList    = signal<OrderItem[]>([]);
  ongoingOrderList = signal<OrderItem[]>([]);
  totalOrderCount  = signal<number>(0);

  // ── Password form signals ──────────────────────────────────────
  showPasswordForm = signal(false);
  showOldPw        = signal(false);
  showNewPw        = signal(false);
  pwLoading        = signal(false);
  pwError          = signal('');
  pwSuccess        = signal('');

  oldPassword = '';
  newPassword = '';

  navItems: NavItem[] = [
    { label: 'Jobs',    route: '/jobs',    iconClass: 'icon-briefcase' },
    { label: 'Ongoing', route: '/ongoing', iconClass: 'icon-clock'     },
    { label: 'Past',    route: '/past',    iconClass: 'icon-check'     },
    { label: 'Profile', route: '/profile', iconClass: 'icon-user', active: true },
  ];

  // ── Computed stats ─────────────────────────────────────────────
  stats = computed<StatCard[]>(() => {
    const past    = this.pastOrderList();
    const ongoing = this.ongoingOrderList();
    const total   = this.totalOrderCount();

    const avgVal = past.length
      ? Math.round(this.getTotalPrice(past) / past.length)
      : 0;

    const denominator = total > 0 ? total : past.length + ongoing.length;
    const compRate    = denominator > 0
      ? Math.round((past.length / denominator) * 100)
      : 0;

    return [
      { value: String(past.length),                                  label: 'Jobs Completed', colorClass: 'sc-a', iconClass: 'icon-check'  },
      { value: String(ongoing.length),                               label: 'Active Jobs',    colorClass: 'sc-b', iconClass: 'icon-clock'  },
      { value: `A $${this.getTotalPrice(past).toLocaleString()}`,    label: 'Total Earnings', colorClass: 'sc-c', iconClass: 'icon-dollar' },
      { value: `A $${this.getTotalPrice(ongoing).toLocaleString()}`, label: 'Active Balance', colorClass: 'sc-d', iconClass: 'icon-wallet' },
      { value: `A $${avgVal.toLocaleString()}`,                      label: 'Avg. Job Value', colorClass: 'sc-e', iconClass: 'icon-trend'  },
      { value: `${compRate}%`,                                       label: 'Completion Rate',colorClass: 'sc-f', iconClass: 'icon-gauge'  },
    ];
  });

  // ── Computed details ───────────────────────────────────────────
  detailRows = computed<DetailRow[]>(() => {
    const info = this.artistInfo();
    if (!info) return [];
    const rawDate     = info.created_at ?? info.createdAt ?? info.join_date ?? info.memberSince ?? null;
    const memberSince = rawDate
      ? (this.datePipe.transform(new Date(rawDate), 'MMMM yyyy') ?? '—')
      : '—';
    return [
      { label: 'Date of Birth', value: this.formatDate(info.date_of_birth), iconClass: 'icon-cake'   },
      { label: 'Location',      value: info.location  ?? '—',               iconClass: 'icon-pin'    },
      { label: 'Art Style',     value: info.art_style ?? '—',               iconClass: 'icon-star'   },
      { label: 'Member Since',  value: memberSince,                         iconClass: 'icon-shield' },
    ];
  });

  skillChips = computed<SkillChip[]>(() => {
    const info = this.artistInfo();
    if (!info?.skill) return [];

    // ✅ skill may come back as a JSON string '["Procreate","Photoshop"]'
    //    or already as an array — handle both
    let skills: string[] = [];
    if (Array.isArray(info.skill)) {
      skills = info.skill;
    } else {
      try {
        const parsed = JSON.parse(info.skill);
        skills = Array.isArray(parsed) ? parsed : [info.skill];
      } catch {
        skills = [info.skill];
      }
    }
    return skills.map(name => ({ name, iconClass: this.skillIcon(name) }));
  });

  // ── Constructor ────────────────────────────────────────────────
  constructor(
    private router:         Router,
    private profileSvc:     ProfileService,
    private infoSvc:        InfoService,
    private routeAccessSvc: RouteAccessService,
    private refreshSvc:     ProfilerefreshService,
    private loginSvc:       LoginService,
    private authSvc:        AuthService,
    private detailSvc:      DetailpageService,
    private usersSvc:       UsersService,
    private datePipe:       DatePipe,
    private logger:         LoggingService
  ) {}

  ngOnInit(): void {
    this.refreshSvc.refreshRequested$.subscribe(() => this.checkAuth());
    this.checkAuth();
  }

  ngOnDestroy(): void {
    this.artistInfo.set(null);
    cancelAnimationFrame(this.animFrame);
  }

  ngAfterViewChecked(): void {
    if (this.isUploading() && this.particleCanvas && !this.canvasReady) {
      this.canvasReady = true;
      this.initParticles();
    }
    if (!this.isUploading()) {
      this.canvasReady = false;
      cancelAnimationFrame(this.animFrame);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.unsavedChanges) { event.preventDefault(); event.returnValue = ''; }
    else this.reloadRoute();
  }

  // ── Auth ───────────────────────────────────────────────────────
  checkAuth(): void {
    this.authSvc.checkAuth().subscribe(response => {
      if (response.isAuthenticated && response.user) {
        this.authSvc.setUser(response.user);
        const { ID } = response.user;
        this.userId = ID;
        this.loadArtistInfo(ID);
        this.loadAllOrders(ID);
      }
    });
  }

  loadArtistInfo(id: number): void {
    this.infoSvc.getinfo(id).subscribe(response => {
      const profile = response.Artist_Profile[0];
      this.artistInfo.set({ ...profile });
      this.profileImage.set(`${profile.Url}?t=${Date.now()}`);
    });
  }

  loadAllOrders(id: number): void {
    this.detailSvc.getorderdata(id).pipe(
      catchError(err => {
        this.logger.error('❌ getorderdata failed:', err);
        return of({});
      })
    ).subscribe((res: any) => {

      // ─────────────────────────────────────────────────────────────────────
      // 🔍 DIAGNOSTIC LOGS — check your browser console after refreshing.
      //    They tell you:
      //      1. What keys the API actually returns  →  fix the res.??? line
      //      2. What the Status value looks like    →  fix the filter string
      //    Remove these console.logs once stats are working correctly.
      // ─────────────────────────────────────────────────────────────────────
      this.logger.log('📦 Raw order API response:', res);
      this.logger.log('📋 Response keys:', Object.keys(res ?? {}));

      // ✅ FIX: try every common response-key shape in order of likelihood.
      //    Original code assumed res.Order (capital O) — your API might use
      //    res.orders / res.data / res.result / or return a bare array.
      const all: any[] =
        res?.Order   ??   // original casing
        res?.Orders  ??   // alternate capitalisation
        res?.orders  ??   // lowercase
        res?.data    ??   // common REST wrapper
        res?.result  ??
        res?.Results ??
        (Array.isArray(res) ? res : []);  // API returned array directly

      this.logger.log(`✅ Resolved ${all.length} orders`);

      if (all.length > 0) {
        // Shows you the exact field names and Status value on a real order
        this.logger.log('🔍 First order sample:', all[0]);
        this.logger.log('🔍 Status value:', all[0].Status ?? all[0].status ?? all[0].order_status ?? '(no status field found)');
      }

      // ✅ FIX: normalise Status field — handles Status / status / order_status
      const getStatus = (o: any): string =>
        (o.Status ?? o.status ?? o.order_status ?? '').toLowerCase();

      this.totalOrderCount.set(all.length);
      this.pastOrderList.set(all.filter(o => getStatus(o) === 'completed'));
      this.ongoingOrderList.set(all.filter(o => getStatus(o) === 'active'));

      this.logger.log('📊 After filter — completed:', this.pastOrderList().length,
                  '| active:', this.ongoingOrderList().length,
                  '| total:', this.totalOrderCount());
    });
  }

  // ── Password form ──────────────────────────────────────────────
  togglePasswordForm(): void {
    const wasOpen = this.showPasswordForm();
    this.showPasswordForm.update(v => !v);
    this.resetPasswordForm();

    if (!wasOpen) {
      setTimeout(() => {
        this.pwSection?.nativeElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 50);
    }
  }

  cancelPasswordForm(): void {
    this.showPasswordForm.set(false);
    this.resetPasswordForm();
  }

  private resetPasswordForm(): void {
    this.oldPassword = '';
    this.newPassword = '';
    this.pwError.set('');
    this.pwSuccess.set('');
    this.showOldPw.set(false);
    this.showNewPw.set(false);
  }

  updatePassword(): void {
    this.pwError.set('');
    this.pwSuccess.set('');

    if (!this.oldPassword.trim()) {
      this.pwError.set('Please enter your current password.');
      return;
    }
    if (this.newPassword.length < 8) {
      this.pwError.set('New password must be at least 8 characters.');
      return;
    }
    if (this.oldPassword === this.newPassword) {
      this.pwError.set('New password must be different from the current one.');
      return;
    }

    this.pwLoading.set(true);
    const email = this.artistInfo()?.email ?? '';

    this.usersSvc.updatepasswordafterlogin(email, this.oldPassword, this.newPassword).subscribe({
      next: () => {
        this.pwLoading.set(false);
        this.pwSuccess.set('Password updated successfully!');
        this.oldPassword = '';
        this.newPassword = '';
        setTimeout(() => {
          this.showPasswordForm.set(false);
          this.pwSuccess.set('');
        }, 2000);
      },
      error: (err) => {
        this.pwLoading.set(false);
        this.pwError.set('Incorrect current password. Please try again.');
        this.logger.error('Password update failed:', err);
      },
    });
  }

  // ── Image upload ───────────────────────────────────────────────
  triggerFileInput(): void { this.fileInput.nativeElement.click(); }

  onFileSelected(event: any): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) this.cropper.open(input.files[0]);
    input.value = '';
  }

  onCropDone(result: { blob: Blob; url: string }): void {
    const file = new File([result.blob], 'profile.jpg', { type: result.blob.type });
    this.uploadProfileImage([file]);
  }

  onCropCancel(): void {}

  private uploadProfileImage(files: File[]): void {
    this.isUploading.set(true);
    this.unsavedChanges = true;
    this.profileSvc.upload(files, this.artistInfo().email).subscribe(response => {
      setTimeout(() => this.updateProfileImageUrl(response.files), 3000);
    });
  }

  private updateProfileImageUrl(files: any[]): void {
    const path = files?.length
      ? (files[files.length - 1].path
          ? this.profileSvc.getfilebaseurl() + files[files.length - 1].path
          : 'null')
      : 'null';
    this.profileImage.set(path);
    this.profileSvc.update(this.userId, { url: path }).subscribe({
      next: () => {
        this.isUploading.set(false);
        this.unsavedChanges = false;
        this.refreshSvc.requestRefresh();
        this.reloadRoute();
      },
      error: err => { this.logger.error('Image update failed:', err); this.isUploading.set(false); }
    });
  }

  // ── Navigation ─────────────────────────────────────────────────
  logout(): void {
    this.loginSvc.logoutuser().subscribe({
      next: () => { this.authSvc.setUser(null); this.router.navigate(['/login']); },
      error: err => this.logger.error('Logout failed:', err),
    });
  }

  navigateChangePassword(): void { this.router.navigate(['/change-password']); }
  navigateForgotPassword(): void { this.router.navigate(['/forgot-password']); }

  reloadRoute(): void {
    this.routeAccessSvc.allowNextAccess();
    this.router.navigate(['/artist-profile']);
  }

  // ── Image helpers ──────────────────────────────────────────────
  getSafeProfileImageUrl(url: string): string {
    return url ? url.replace('@', '%40') : 'assets/images/profile-picture.png';
  }
  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/profile-picture.png';
  }

  // ── Price ──────────────────────────────────────────────────────
  getTotalPrice(orders: OrderItem[]): number {
    return orders.reduce((total, order: any) => {
      if (Array.isArray(order.items) && order.items.length) {
        const itemSum = order.items.reduce(
          (sum: number, item: any) => sum + (item.price ?? 0) * 0.5, 0
        );
        return total + itemSum;
      }
      if (order.price != null)       return total + order.price * 0.5;
      if (order.total_price != null) return total + order.total_price * 0.5;
      return total;
    }, 0);
  }

  // ── Date ───────────────────────────────────────────────────────
  formatDate(d: string): string {
    if (!d) return '—';
    return this.datePipe.transform(new Date(d), 'd MMMM yyyy') ?? '—';
  }

  // ── Skill icon map ─────────────────────────────────────────────
  private skillIcon(skill: string): string {
    const map: Record<string, string> = {
      'Procreate': 'icon-pen', 'Photoshop': 'icon-image',
      'Illustration': 'icon-pencil', 'Character Design': 'icon-people',
      'Watercolour': 'icon-drop', 'Digital Painting': 'icon-palette',
    };
    return map[skill] ?? 'icon-star';
  }

  // ── Particle system ────────────────────────────────────────────
  private initParticles(): void {
    const canvas = this.particleCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const COLORS = ['#3651e8', '#3c2e6b', '#b97d2e', '#8f5c1a', '#ffffff'];
    this.particles = Array.from({ length: 60 }, () => this.makeParticle(canvas, COLORS));

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.particles.forEach(p => {
        p.y -= p.vy; p.x += p.vx; p.life--;
        p.opacity = Math.max(0, p.life / p.maxLife);
        if (p.life <= 0) Object.assign(p, this.makeParticle(canvas, COLORS));
        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle   = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      this.animFrame = requestAnimationFrame(loop);
    };
    loop();
  }

  private makeParticle(canvas: HTMLCanvasElement, colors: string[]): any {
    const maxLife = 80 + Math.random() * 80;
    return {
      x: Math.random() * canvas.width,
      y: canvas.height + 10,
      r: 1.5 + Math.random() * 3,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 0.8 + Math.random() * 1.6,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: maxLife, maxLife, opacity: 1,
    };
  }
}