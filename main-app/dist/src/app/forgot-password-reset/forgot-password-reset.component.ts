import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
// FIX (Bug 3): The component was importing UsersService which didn't have
// verfiyuserandupdatepass. The method now lives in LoginService.
import { LoginService } from '../Service/User/login.service';
import { LoggingService } from '../Service/Logs/logging.service';

export type StrengthLevel = 'weak' | 'fair' | 'strong' | 'very-strong';

type PageState = 'form' | 'expired' | 'success';

/** Checks that the password contains at least one uppercase, one lowercase,
 *  one digit, and one special character. */
const passwordStrengthValidator: ValidatorFn = (control: AbstractControl) => {
  const v: string = control.value ?? '';
  const errors: Record<string, boolean> = {};
  if (!/[A-Z]/.test(v))         errors['missingUppercase'] = true;
  if (!/[a-z]/.test(v))         errors['missingLowercase'] = true;
  if (!/[0-9]/.test(v))         errors['missingNumber']    = true;
  if (!/[^A-Za-z0-9]/.test(v))  errors['missingSpecial']   = true;
  return Object.keys(errors).length ? errors : null;
};

/** Returns 0–4 based on how many strength criteria the password satisfies. */
function calcStrengthScore(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6)           score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;
  return score;
}

// Delay (ms) before auto-navigating to /Login after a successful reset.
const SUCCESS_REDIRECT_DELAY_MS = 2500;

@Component({
  selector: 'app-forgot-password-reset',
  standalone: false,
  templateUrl: './forgot-password-reset.component.html',
  styleUrl: './forgot-password-reset.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordResetComponent implements OnInit {

  pageState   = signal<PageState>('form');
  isLoading   = signal(false);
  serverError = signal('');

  isNewPasswordVisible     = signal(false);
  isConfirmPasswordVisible = signal(false);

  /** 0 = empty, 1 = weak, 2 = fair, 3 = strong, 4 = very strong */
  strengthScore = signal<number>(0);

  passwordForm: FormGroup;

  private useremail = '';
  private token     = '';

  get strengthLevel(): StrengthLevel {
    const s = this.strengthScore();
    if (s <= 1) return 'weak';
    if (s === 2) return 'fair';
    if (s === 3) return 'strong';
    return 'very-strong';
  }

  get strengthLabel(): string {
    const map: Record<StrengthLevel, string> = {
      weak: 'Weak', fair: 'Fair', strong: 'Strong', 'very-strong': 'Very strong',
    };
    return map[this.strengthLevel];
  }

  constructor(
    private activeroute: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private loginService: LoginService,
    private loggingService: LoggingService,
  ) {
    this.passwordForm = this.fb.group(
      {
        newPassword: [
          '',
          [Validators.required, Validators.minLength(8), passwordStrengthValidator],
        ],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: this.passwordMatchValidator },
    );

    // Update strength meter reactively as user types
    this.passwordForm.get('newPassword')!.valueChanges.subscribe(val => {
      this.strengthScore.set(calcStrengthScore(val ?? ''));
    });
  }

  ngOnInit(): void {
    this.activeroute.queryParams.subscribe(params => {
      const rawToken = params['token'];
      const rawEmail = params['id'];

      if (!rawToken || !rawEmail) {
        this.pageState.set('expired');
        return;
      }

      try {
        this.token     = decodeURIComponent(rawToken);
        this.useremail = decodeURIComponent(rawEmail);

        if (!this.token || !this.useremail) {
          throw new Error('Empty after decode');
        }

        this.pageState.set('form');
      } catch (err) {
        this.loggingService.error('Token decode error', err);
        this.pageState.set('expired');
      }
    });
  }

  togglePassword(
    input: HTMLInputElement,
    type: 'newPassword' | 'confirmPassword',
  ): void {
    if (type === 'newPassword') {
      this.isNewPasswordVisible.update(v => !v);
    } else {
      this.isConfirmPasswordVisible.update(v => !v);
    }
    input.type = input.type === 'password' ? 'text' : 'password';
  }

  onSubmit(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.resetPassword();
  }

  private resetPassword(): void {
    this.isLoading.set(true);
    this.serverError.set('');

    this.loginService
      .verfiyuserandupdatepass(
        this.passwordForm.value.newPassword,
        this.token,
        this.useremail,
      )
      .subscribe({
        next: response => {
          this.isLoading.set(false);

          // { verified: false } means the token expired or was already used
          if (response?.verified === false) {
            this.pageState.set('expired');
            return;
          }

          // Any truthy verified value (true, 1, "true") is a success
          if (response?.verified) {
            this.pageState.set('success');

            // FIX (Bug 4): Navigate to /Login automatically after the success
            // state is shown, giving the user time to read the confirmation.
            setTimeout(() => {
              this.router.navigate(['/Login']);
            }, SUCCESS_REDIRECT_DELAY_MS);

            return;
          }

          this.loggingService.error('Unexpected reset response', response);
          this.serverError.set('Something went wrong. Please try again.');
        },
        error: err => {
          this.isLoading.set(false);
          this.loggingService.error('Password reset HTTP error', err);

          const msg: string = err?.error?.message ?? '';
          const isExpired =
            msg.toLowerCase().includes('expired') ||
            msg.toLowerCase().includes('invalid') ||
            err?.status === 401 ||
            err?.status === 403;

          if (isExpired) {
            this.pageState.set('expired');
          } else {
            this.serverError.set('Unable to reset password. Please try again.');
          }
        },
      });
  }

  private passwordMatchValidator(form: AbstractControl) {
    const pw  = form.get('newPassword')?.value;
    const cpw = form.get('confirmPassword')?.value;
    return pw === cpw ? null : { mismatch: true };
  }

  get newPassword()     { return this.passwordForm.get('newPassword'); }
  get confirmPassword() { return this.passwordForm.get('confirmPassword'); }
}