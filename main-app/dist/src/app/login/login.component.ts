import { Component, OnDestroy, signal } from '@angular/core';
import { LoginService } from '../Service/User/login.service';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { LoginStatusService } from '../Service/User/login-status.service';
import { Title, Meta } from '@angular/platform-browser';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';
import { RouteAccessService } from '../Service/User/route-access-service.service';

@Component({
  selector:    'app-login',
  standalone:  false,
  templateUrl: './login.component.html',
  styleUrl:    './login.component.css'
})
export class LoginComponent implements OnDestroy {

  // ── Form field models ─────────────────────────────────────────────────────
  email:    string = '';
  password: string = '';

  // ── UI state ──────────────────────────────────────────────────────────────
  loginError:        string  = '';
  isLoading                  = signal(false);
  isPasswordVisible: boolean = false;

  // ── Per-field error messages ──────────────────────────────────────────────
  emailError:    string = '';
  passwordError: string = '';

  // ── Unactive Account Popup ──────────────────────────────────────────────
  showUnactivePopup: boolean = false;
  unactiveEmail:     string  = '';

  // ── IP lockout countdown ───────────────────────────────────────────────────
  isBlocked:         boolean       = false;
  blockTimerString:  string        = '';
  remainingAttempts: number | null = null;
  private countdownInterval: any   = null;

  constructor(
    private loginService: LoginService,
    private loginStatus:  LoginStatusService,
     private accessService: RouteAccessService,
    private router:       Router,
    private title:        Title,
    private meta:         Meta,
    private loggingService: LoggingService,
    private Toast:        ToastService
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.title.setTitle('Login | Purrfect Pal Studio');
    this.meta.updateTag({
      name:    'description',
      content: 'Login to your Purrfect Pal Studio account to manage your pet portrait orders and view status updates.'
    });
  }

  ngAfterViewInit(): void {
    // Safari autofill workaround
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isSafari) {
      setTimeout(() => {
        const emailInput = document.querySelector('input[name="email"]') as HTMLInputElement;
        if (emailInput && document.activeElement !== emailInput) {
          emailInput.focus();
          emailInput.blur();
        }
      }, 1000);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  VALIDATORS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Email ─────────────────────────────────────────────────────────────────
  // Called on (blur) and (ngModelChange) so the error clears live once fixed.
  validateEmail(): void {
    const trimmed = this.email.trim();
    if (!trimmed) {
      this.emailError = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      this.emailError = 'Please enter a valid email address.';
    } else {
      this.emailError = '';
    }
  }

  // ── Password ──────────────────────────────────────────────────────────────
  validatePassword(): void {
    if (!this.password) {
      this.passwordError = 'Password is required.';
    } else {
      this.passwordError = '';
    }
  }

  // ── Password visibility toggle ────────────────────────────────────────────
  togglePassword(input: HTMLInputElement): void {
    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FORM SUBMISSION
  // ══════════════════════════════════════════════════════════════════════════

  ngOnDestroy(): void { this.clearCountdown(); }

  onlogin(form: NgForm): void {
    if (this.isBlocked) return;
    // Touch every Angular control so template-driven validators render
    Object.values(form.controls).forEach(c => c.markAsTouched());

    // Run custom validators
    this.validateEmail();
    this.validatePassword();

    const hasFieldError = !!this.emailError || !!this.passwordError;

    if (hasFieldError || form.invalid) {
      this.loginError = 'Please fix the errors above before submitting.';
      this.Toast.showToast('info', 'Incomplete form', this.loginError);

      // Shake every invalid native input
      document.querySelectorAll<HTMLElement>('input.ng-invalid').forEach(el => {
        el.classList.remove('shake');
        void el.offsetWidth;           // force reflow so animation re-fires
        el.classList.add('shake');
        el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
      });

      // Scroll to and focus the first visible error field
      const firstInvalid = document.querySelector<HTMLElement>('.is-invalid, input.ng-invalid');
      if (firstInvalid) {
        setTimeout(() => {
          firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalid.focus();
        }, 100);
      }
      return;
    }

    // ── All valid — call the service ──────────────────────────────────────
    this.loginError = '';
    this.remainingAttempts = null;
    this.isLoading.set(true);

    this.loginService.loginuser(this.email.toLowerCase().trim(), this.password)
      .subscribe({
        next: (response: any) => {
          this.isLoading.set(false);
          const msg = (response?.message || '').toLowerCase();
          const isInactive = response?.code === 'ACCOUNT_INACTIVE' || response?.requiresActivation === true || msg.includes('not activated');

          if (isInactive) {
            this.unactiveEmail = this.email;
            this.showUnactivePopup = true;
            this.loginError = '';
          } else if (response.code === 'IP_BLOCKED') {
            this.startBlockCountdown(response.remainingMs ?? 2 * 60 * 1000);
            this.Toast.showToast('error', 'Access Blocked', 'Too many failed attempts. Please wait.');
          } else if (response.success === true) {
            this.Toast.showToast('success', 'Login', response.message);
            this.loginError = '';
            this.openroute();
          } else {
            if (response.remainingAttempts !== undefined && response.remainingAttempts !== null) {
              this.remainingAttempts = response.remainingAttempts;
            }
            this.loginError = response.message || 'Invalid credentials.';
            this.Toast.showToast('error', 'Login', this.loginError);
          }
        },
        error: (error) => {
          this.isLoading.set(false);
          const body = error?.error;
          const msg = (body?.message || '').toLowerCase();
          const isInactive = body?.code === 'ACCOUNT_INACTIVE' || body?.requiresActivation === true || msg.includes('not activated');

          if (isInactive) {
            this.unactiveEmail = this.email;
            this.showUnactivePopup = true;
            this.loginError = '';
          } else if (body?.code === 'IP_BLOCKED') {
            this.startBlockCountdown(body.remainingMs ?? 2 * 60 * 1000);
            this.Toast.showToast('error', 'Access Blocked', 'Too many failed attempts. Please wait.');
          } else {
            console.error('Login error:', error);
            this.loginError = body?.message || 'Server error. Please try again.';
            this.Toast.showToast('error', 'Login Failed', this.loginError);
          }
        }
      });
  }

  closeUnactivePopup(): void {
    this.showUnactivePopup = false;
  }

  openroute(): void {
    this.router.navigate(['/Home'], { state: { justLoggedIn: true } });
  }

  openrouteforgotpass(): void {
    this.accessService.allowNextAccess();
    this.router.navigate(['/ForgotPassword'], { state: { justCameFromLogin: true } });
  }

  private startBlockCountdown(remainingMs: number): void {
    this.clearCountdown();
    const target = Date.now() + remainingMs;
    this.isBlocked = true;
    this.loginError = '';
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        this.isBlocked = false;
        this.blockTimerString = '';
        this.loginError = '';
        this.clearCountdown();
        return;
      }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.blockTimerString = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };
    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}