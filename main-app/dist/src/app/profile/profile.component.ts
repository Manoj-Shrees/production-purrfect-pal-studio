import { DatePipe } from '@angular/common';
import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { ProfileService }    from '../Service/Profile/profile.service';
import { LoginService }      from '../Service/User/login.service';
import { AuthService }       from '../Service/User/auth.service';
import { OrderService }      from '../Service/OrderPage/order.service';
import { UsersService }      from '../Service/User/users.service';
import { LoggingService }    from '../Service/Logs/logging.service';
import { ImageCropperComponent } from '../image-cropper/image-cropper.component';
import { ToastService }      from '../Service/common/toast.service';
import { SociallinkService } from '../Service/Sociallinks/sociallink.service';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css'],
})
export class ProfileComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('fileInput')      fileInput!:      ElementRef;
  @ViewChild('cropper')        cropper!:        ImageCropperComponent;
  @ViewChild('particleCanvas') particleCanvas!: ElementRef<HTMLCanvasElement>;

  userinfo             = signal<any>(null);
  profile_image        = signal<string | null>('');
  isProfileImageUpload = signal(false);
  isUploading          = signal(false);

  modelData: any;
  private UID = 0;

  totalordercount  = 0;
  activeordercount = 0;

  oldpassword = '';
  newpassword = '';

  isoldPasswordVisible = false;
  isnewPasswordVisible = false;
  isLoading            = false;
  errorMessage         = '';

  showPasswordForm = false;

  // ── Particle system ────────────────────────────────────────────
  private particles:  any[]  = [];
  private animFrame:  number = 0;
  private canvasReady        = false;

  constructor(
    private router:         Router,
    private profileimage:   ProfileService,
    private orderservice:   OrderService,
    private loggingService: LoggingService,
    private Toast:          ToastService,
    private authService:    AuthService,
    private cdref:          ChangeDetectorRef,
    private Userservice:    UsersService,
    private loginService:   LoginService,
    private socialmedia:    SociallinkService,
    private datePipe:       DatePipe,
    private ngZone:         NgZone,
  ) {}

  // ── Lifecycle ──────────────────────────────────────────────────
  ngOnInit(): void {
    this.isProfileImageUpload.set(true);
    this.authService.checkAuth().subscribe(response => {
      if (response.isAuthenticated && response.user) {
        const email = response.user.user_email || response.user.user_id || response.user.email;
        this.getuserinfo(email);
      } else {
        this.isProfileImageUpload.set(false);
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy(): void {
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

  // ── Orders ─────────────────────────────────────────────────────
  getordercount(id: number): void {
    this.orderservice.getordercount(id).subscribe({
      next: data => {
        this.totalordercount  = data.Order[0].total_count;
        this.activeordercount = data.Order[0].active_count;
      },
      error: err => this.loggingService.error('Error fetching order count:', err),
    });
  }

  // ── Password helpers ───────────────────────────────────────────
  toggleoldPassword(input: HTMLInputElement): void {
    this.isoldPasswordVisible = !this.isoldPasswordVisible;
    input.type = this.isoldPasswordVisible ? 'text' : 'password';
  }

  togglenewPassword(input: HTMLInputElement): void {
    this.isnewPasswordVisible = !this.isnewPasswordVisible;
    input.type = this.isnewPasswordVisible ? 'text' : 'password';
  }

  togglePasswordForm(): void {
    this.showPasswordForm = !this.showPasswordForm;
    this.resetPasswordForm();
  }

  cancelPasswordForm(): void {
    this.showPasswordForm = false;
    this.resetPasswordForm();
  }

  private resetPasswordForm(): void {
    this.oldpassword          = '';
    this.newpassword          = '';
    this.errorMessage         = '';
    this.isoldPasswordVisible = false;
    this.isnewPasswordVisible = false;
  }

  updatepassword(oldpassinput: HTMLInputElement, newpassinput: HTMLInputElement): void {
    this.errorMessage = '';

    if (!this.oldpassword.trim()) {
      this.errorMessage = 'Please enter your current password.';
      return;
    }
    if (this.newpassword.length < 8) {
      this.errorMessage = 'New password must be at least 8 characters.';
      return;
    }
    if (this.oldpassword === this.newpassword) {
      this.errorMessage = 'New password must differ from the current one.';
      return;
    }

    this.isLoading = true;

    this.Userservice.updatepasswordafterlogin(
      this.userinfo().email, this.oldpassword, this.newpassword
    ).subscribe({
      next: () => {
        this.ngZone.run(() => {
          this.Toast.showToast('success', 'Password Updated',
            'Your password has been updated successfully.');
        });
        oldpassinput.value = '';
        newpassinput.value = '';
        this.resetPasswordForm();
        this.isLoading = false;
        setTimeout(() => { this.showPasswordForm = false; }, 1500);
        this.getuserinfo(this.userinfo().ID ?? this.UID);
      },
      error: err => {
        this.ngZone.run(() => {
          this.Toast.showToast('error', 'Password Update Failed',
            'Current password incorrect.');
        });
        this.errorMessage = 'Incorrect current password. Please try again.';
        this.loggingService.error('Error updating password:', err);
        this.isLoading = false;
      },
    });
  }

  // ── Auth / navigation ──────────────────────────────────────────
  logout(): void {
    this.loginService.logoutuser().subscribe({
      next: () => {
        this.authService.setUser(null);
        this.ngZone.run(() => {
          this.Toast.showToast('success', 'Logout', 'Logout successful.');
        });
        this.router.navigate(['/login']);
      },
      error: err => {
        this.ngZone.run(() => {
          this.Toast.showToast('error', 'Logout', 'Logout failed.');
        });
        this.loggingService.error('Logout failed:', err);
      },
    });
  }

  // ── User info ──────────────────────────────────────────────────
  getuserinfo(arg?: any): void {
    let email = (typeof arg === 'string' && arg.includes('@')) ? arg : null;
    if (!email && arg && typeof arg === 'object' && arg.email) {
      email = arg.email;
    }
    if (!email) {
      email = this.userinfo()?.email || this.modelData?.email;
    }

    if (!email) {
      this.loggingService.warn('getuserinfo skipped: no valid email available');
      this.isProfileImageUpload.set(false);
      return;
    }

    this.profileimage.getprofile(email).subscribe({
      next: response => {
        if (!response || !response[0]) {
          this.isProfileImageUpload.set(false);
          if (this.userinfo()) {
            this.loggingService.warn('Profile sync returned empty record; maintaining active user context');
            return;
          }
          this.ngZone.run(() => {
            this.Toast.showToast('error', 'Profile Error', 'Could not load your profile.');
          });
          this.router.navigate(['/login']);
          return;
        }

        this.userinfo.set(response[0]);
        const { email: userEmail, ID, Url } = response[0];
        this.modelData  = { email: userEmail };
        this.UID        = ID;
        this.getordercount(ID);
        const isNullUrl = !Url || Url === 'null' || Url === 'undefined' || !String(Url).trim();
        if (isNullUrl) {
          this.profile_image.set('assets/images/profile-picture.png');
        } else {
          const cleanUrl = String(Url).startsWith('http') ? Url : (this.profileimage.getfilebaseurl() + String(Url).replace(/^\/+/, ''));
          this.profile_image.set(`${cleanUrl}?t=${new Date().getTime()}`);
        }
        this.isProfileImageUpload.set(false);
      },
      error: err => {
        this.loggingService.error('Error fetching user profile:', err);
        this.isProfileImageUpload.set(false);
        if (!this.userinfo()) {
          this.ngZone.run(() => {
            this.Toast.showToast('error', 'Profile Error', 'Could not load your profile.');
          });
          this.router.navigate(['/login']);
        }
      },
    });
  }
  formatDate(dateString: string): string {
    if (!dateString) return '—';
    return this.datePipe.transform(new Date(dateString), 'd MMMM yyyy') ?? '—';
  }

  // ── Image upload ───────────────────────────────────────────────
  triggerFileInput(): void { this.fileInput.nativeElement.click(); }

  onFileSelected(event: any): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const MAX_SIZE_BYTES = 10 * 1024 * 1024;
      if (input.files[0].size > MAX_SIZE_BYTES) {
        this.Toast.showToast('error', 'File Too Large',
          `"${input.files[0].name}" exceeds 10 MB. Please choose a smaller image.`);
        input.value = '';
        return;
      }
      this.cropper.open(input.files[0]);
    }
    input.value = '';
  }

  onCropDone(result: { blob: Blob; url: string }): void {
    const file = new File([result.blob], 'profile.jpg', { type: result.blob.type });
    this.uploadprofileimage([file]);
  }

  onCropCancel(): void { this.loggingService.log('Crop canceled'); }

 uploadprofileimage(files: File[]): void {
  if (!files.length) return;
  this.isUploading.set(true);
  this.isProfileImageUpload.set(true);
  this.cdref.detectChanges();

  this.profileimage.upload(files, this.userinfo().email).subscribe({
    next: response => {
      this.updateprofileimage(response.files, true);
    },
    error: err => {
      this.ngZone.run(() => {
        this.isUploading.set(false);
        this.isProfileImageUpload.set(false);
        this.cdref.detectChanges();
        this.Toast.showToast('error', 'Upload Failed', 'Error uploading profile image.');
      });
      this.loggingService.error(err);
    },
  });
}

updateprofileimage(files: any[], showUploadToast = false): void {
  if (!files?.length) {
    this.ngZone.run(() => {
      this.isUploading.set(false);
      this.isProfileImageUpload.set(false);
      this.cdref.detectChanges();
    });
    return;
  }

  const latestFile = files[files.length - 1];
  const rawPath    = typeof latestFile === 'string' ? latestFile : (latestFile?.path || latestFile?.url || '');
  const cleanRel   = rawPath.replace(/\\/g, '/').replace(/^.*?(uploadedfiles\/)/i, '$1').replace(/^\/+/, '');
  const filePath   = cleanRel.startsWith('http') ? cleanRel : (this.profileimage.getfilebaseurl() + cleanRel);

  this.profileimage.updatepro_img(this.UID, { url: filePath }).subscribe({
    next: () => {
      this.ngZone.run(() => {
        // ── Set image ONLY after DB confirms ──
        this.profile_image.set(`${filePath}?t=${Date.now()}`);
        this.isUploading.set(false);
        this.isProfileImageUpload.set(false);
        this.cdref.detectChanges();

        if (showUploadToast) {
          this.Toast.showToast('success', 'Profile Updated',
            'Profile image uploaded & updated successfully.');
        } else {
          this.Toast.showToast('success', 'Profile Updated',
            'Profile image updated successfully.');
        }

        // ── Reload user info to sync fresh URL from server ──
        this.getuserinfo(this.UID);
      });
    },
    error: err => {
      this.ngZone.run(() => {
        this.isUploading.set(false);
        this.isProfileImageUpload.set(false);
        this.cdref.detectChanges();
        this.Toast.showToast('error', 'Update Failed', 'Error updating profile image.');
      });
      this.loggingService.error(err);
    },
  });
}

  // ── Social links ───────────────────────────────────────────────
  opensocialurl(pos: number): void { this.socialmedia.geturl(pos); }

  // ── Image helpers ──────────────────────────────────────────────
  getSafeProfileImageUrl(rawUrl: string): string {
    if (!rawUrl || rawUrl === 'null' || rawUrl === 'undefined' || rawUrl.startsWith('null') || rawUrl.startsWith('undefined') || !rawUrl.trim()) {
      return 'assets/images/profile-picture.png';
    }
    const clean = rawUrl.replace('@', '%40');
    if (clean.startsWith('assets/') || clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    return this.profileimage.getfilebaseurl() + clean.replace(/^\/+/, '');
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = 'assets/images/profile-picture.png';
  }

  // ── Firefly particle system ────────────────────────────────────
  private initParticles(): void {
    const canvas = this.particleCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Build initial firefly pool
    this.particles = Array.from({ length: 45 }, () => this.makeFirefly(canvas, true));

    let tick = 0;

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick++;

      for (const f of this.particles) {
        // ── Move ──────────────────────────────────────────────
        f.t += f.speed;
        if (f.t >= 1) {
          f.x  = f.tx;
          f.y  = f.ty;
          f.tx = Math.max(10, Math.min(canvas.width  - 10, f.x + (Math.random() - .5) * 160));
          f.ty = Math.max(10, Math.min(canvas.height - 10, f.y + (Math.random() - .5) * 160));
          f.t  = 0;
        }
        // Ease-in-out quadratic
        const e  = f.t < .5 ? 2 * f.t * f.t : 1 - Math.pow(-2 * f.t + 2, 2) / 2;
        f.cx = f.x + (f.tx - f.x) * e;
        f.cy = f.y + (f.ty - f.y) * e;

        // Record trail
        f.trail.unshift({ x: f.cx, y: f.cy });
        if (f.trail.length > f.maxTrail) f.trail.pop();

        // ── Draw ──────────────────────────────────────────────
        const pulse = (Math.sin(tick * f.pulseSpeed + f.pulseOffset) + 1) / 2;
        const alpha = .35 + pulse * .65;
        const r     = f.baseR * (.7 + pulse * .6);

        // Fading trail dots
        for (let i = 1; i < f.trail.length; i++) {
          const a = ((f.trail.length - i) / f.trail.length) * alpha * .35;
          ctx.beginPath();
          ctx.arc(f.trail[i].x, f.trail[i].y, r * .45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,255,${a})`;
          ctx.fill();
        }

        // Soft radial halo
        const grd = ctx.createRadialGradient(f.cx, f.cy, 0, f.cx, f.cy, r * 5.5);
        grd.addColorStop(0,   `rgba(0,255,255,${alpha * .55})`);
        grd.addColorStop(.4,  `rgba(0,220,255,${alpha * .18})`);
        grd.addColorStop(1,   `rgba(0,180,255,0)`);
        ctx.beginPath();
        ctx.arc(f.cx, f.cy, r * 5.5, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Bright core
        ctx.beginPath();
        ctx.arc(f.cx, f.cy, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,255,255,${alpha})`;
        ctx.fill();
      }

      this.animFrame = requestAnimationFrame(loop);
    };

    // Run outside Angular's zone so change-detection is never triggered
    this.ngZone.runOutsideAngular(() => loop());
  }

  private makeFirefly(canvas: HTMLCanvasElement, randomiseT = false): any {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    return {
      x,  y,
      tx: x + (Math.random() - .5) * 180,
      ty: y + (Math.random() - .5) * 180,
      cx: x, cy: y,
      t:           randomiseT ? Math.random() : 0,
      speed:       Math.random() * .006 + .002,
      pulseSpeed:  Math.random() * .018 + .008,
      pulseOffset: Math.random() * Math.PI * 2,
      baseR:       Math.random() * 1.6 + .6,
      trail:       [] as { x: number; y: number }[],
      maxTrail:    Math.floor(Math.random() * 8) + 4,
    };
  }
}