import { Component } from '@angular/core';
import { LoginService } from '../Service/User/login.service';
import { catchError, of } from 'rxjs';
import { Router } from '@angular/router';
import { NgForm } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { countrycodes } from './datamodel/list';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';
import { parsePhoneNumberFromString, AsYouType, CountryCode } from 'libphonenumber-js';

// ─────────────────────────────────────────────────────────────────────────────
// Password checklist shape — mirrors the five <div class="check-item"> items
// rendered in the template.
// ─────────────────────────────────────────────────────────────────────────────
interface PasswordChecks {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number:    boolean;
  symbol:    boolean;
}

@Component({
  selector:    'app-signup',
  standalone:  false,
  templateUrl: './signup.component.html',
  styleUrl:    './signup.component.css'
})
export class SignupComponent {

  // ── Form field models ────────────────────────────────────────────────────
  name:                string    = '';
  email:               string    = '';
  password:            string    = '';
  confirmPassword:     string    = '';
  selectedCountryIso:  string    = 'AU';
  selectedCountryCode: string    = '+61';
  phone:               string    = '';
  date_of_birth:       Date | null = null;
  role:                string    = 'user';

  // ── Date picker constraints ──────────────────────────────────────────────
  // Users must be 18+ and no older than 100 years.
  maxDate: Date;
  minDate: Date;

  // ── Password state ───────────────────────────────────────────────────────
  passwordChecks: PasswordChecks = {
    minLength: false,
    uppercase: false,
    lowercase: false,
    number:    false,
    symbol:    false
  };
  passwordValid: boolean = false;

  // ── Visibility toggles ───────────────────────────────────────────────────
  isPasswordVisible: boolean = false;
  isConfirmVisible:  boolean = false;

  // ── Phone helpers ─────────────────────────────────────────────────────────
  // Managed by libphonenumber-js formatting
  phoneInputMaxLength: number = 20;

  // ── UI / submission state ─────────────────────────────────────────────────
  isLoading:         boolean = false;
  showSuccessPopup:  boolean = false;
  showUnactivePopup: boolean = false;
  unactiveMessage:   string  = '';
  loginError:        string  = '';

  // ── Per-field error messages ──────────────────────────────────────────────
  nameError:            string = '';
  emailError:           string = '';
  confirmPasswordError: string = '';
  phoneError:           string = '';

  // ── Static data ───────────────────────────────────────────────────────────
  countrycodelist = countrycodes;

  private lastForm: NgForm | null = null;

  // ─────────────────────────────────────────────────────────────────────────
  constructor(
    private loginService:   LoginService,
    private router:         Router,
    private datePipe:       DatePipe,
    private loggingService: LoggingService,
    private Toast:          ToastService
  ) {
    const today = new Date();
    this.maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
    this.minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  VALIDATORS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Full Name ─────────────────────────────────────────────────────────────
  validateName(): void {
    const trimmed = this.name.trim();
    if (!trimmed) {
      this.nameError = 'Full name is required.';
    } else if (trimmed.length < 2) {
      this.nameError = 'Name must be at least 2 characters.';
    } else if (!/^[a-zA-Z\s'\-]+$/.test(trimmed)) {
      this.nameError = 'Name can only contain letters, spaces, hyphens, and apostrophes.';
    } else {
      this.nameError = '';
    }
  }

  // ── Email ─────────────────────────────────────────────────────────────────
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
    const p = this.password;

    this.passwordChecks = {
      minLength: p.length >= 8,
      uppercase: /[A-Z]/.test(p),
      lowercase: /[a-z]/.test(p),
      number:    /\d/.test(p),
      symbol:    /[\W_]/.test(p)
    };
    this.passwordValid = Object.values(this.passwordChecks).every(Boolean);

    if (this.confirmPassword.length > 0) {
      this.passwordMatchValidator();
    }
  }

  // ── Confirm Password (live, on input) ─────────────────────────────────────
  passwordMatchValidator(): void {
    if (this.confirmPassword.length > 0 && this.password !== this.confirmPassword) {
      this.confirmPasswordError = 'Passwords do not match.';
    } else {
      this.confirmPasswordError = '';
    }
  }

  // ── Confirm Password (on blur) ────────────────────────────────────────────
  validateConfirmPassword(): void {
    if (!this.confirmPassword) {
      this.confirmPasswordError = 'Please confirm your password.';
    } else {
      this.passwordMatchValidator();
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PHONE
  // ══════════════════════════════════════════════════════════════════════════

  // Resets the phone field whenever the country ISO changes.
  onCountryIsoChange(): void {
    const found = this.countrycodelist.find(c => c.iso === this.selectedCountryIso);
    if (found) {
      this.selectedCountryCode = found.code;
    }
    this.phone               = '';
    this.phoneError          = '';
  }

  // Legacy helper in case it is called from elsewhere
  onCountryCodeChange(): void {
    const found = this.countrycodelist.find(c => c.code === this.selectedCountryCode);
    if (found) {
      this.selectedCountryIso = found.iso;
    }
    this.phone               = '';
    this.phoneError          = '';
  }

  // Blocks non-numeric keystrokes.
  allowNumbersOnly(event: KeyboardEvent): boolean {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  formatPhoneString(raw: string): string {
    const digits = raw.replace(/\D/g, '');
    const countryObj = this.countrycodelist.find(c => c.iso === this.selectedCountryIso);
    const lengthsStr = countryObj ? countryObj.lengths : '10';

    const maxLen = lengthsStr.includes('-') 
      ? parseInt(lengthsStr.split('-')[1], 10) 
      : parseInt(lengthsStr, 10);

    const truncatedDigits = digits.slice(0, maxLen);

    if (maxLen <= 8) {
      let formatted = truncatedDigits.substring(0, 4);
      if (truncatedDigits.length > 4) formatted += '-' + truncatedDigits.substring(4, 8);
      return formatted;
    } else if (maxLen === 9) {
      let formatted = truncatedDigits.substring(0, 3);
      if (truncatedDigits.length > 3) formatted += '-' + truncatedDigits.substring(3, 6);
      if (truncatedDigits.length > 6) formatted += '-' + truncatedDigits.substring(6, 9);
      return formatted;
    } else if (maxLen === 10) {
      let formatted = truncatedDigits.substring(0, 3);
      if (truncatedDigits.length > 3) formatted += '-' + truncatedDigits.substring(3, 6);
      if (truncatedDigits.length > 6) formatted += '-' + truncatedDigits.substring(6, 10);
      return formatted;
    } else {
      let formatted = truncatedDigits.substring(0, 4);
      if (truncatedDigits.length > 4) formatted += '-' + truncatedDigits.substring(4, 8);
      if (truncatedDigits.length > 8) formatted += '-' + truncatedDigits.substring(8, 12);
      return formatted;
    }
  }

  // Auto-formats the phone number with dashes as the user types.
  formatPhoneNumber(event: any): void {
    const inputEl = event.target as HTMLInputElement;
    const rawValue = inputEl.value;
    const formatted = this.formatPhoneString(rawValue);

    const prevCursor = inputEl.selectionStart || 0;
    const oldLength  = inputEl.value.length;

    inputEl.value = formatted;
    this.phone    = formatted;

    const newCursor = prevCursor + (formatted.length - oldLength);
    setTimeout(() => inputEl.setSelectionRange(newCursor, newCursor));
  }

  isPhoneLengthValid(): boolean {
    if (!this.phone) return false;
    const digitsOnly = this.phone.replace(/\D/g, '');
    const len = digitsOnly.length;

    const countryObj = this.countrycodelist.find(c => c.iso === this.selectedCountryIso);
    if (!countryObj) return false;

    const lengthsStr = countryObj.lengths;
    if (lengthsStr.includes('-')) {
      const [minStr, maxStr] = lengthsStr.split('-');
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      return len >= min && len <= max;
    } else {
      const exact = parseInt(lengthsStr, 10);
      return len === exact;
    }
  }

  isPhoneValid(): boolean {
    if (!this.phone) return false;
    if (!this.isPhoneLengthValid()) return false;
    try {
      const parsed = parsePhoneNumberFromString(this.phone, this.selectedCountryIso as CountryCode);
      return parsed ? parsed.isPossible() : false;
    } catch {
      return false;
    }
  }

  validatePhone(): void {
    if (!this.phone) {
      this.phoneError = 'Phone number is required.';
    } else if (!this.isPhoneLengthValid()) {
      const countryObj = this.countrycodelist.find(c => c.iso === this.selectedCountryIso);
      const expected = countryObj ? countryObj.lengths : '';
      this.phoneError = `Phone number must be ${expected} digits.`;
    } else if (!this.isPhoneValid()) {
      this.phoneError = 'Please enter a valid phone number.';
    } else {
      this.phoneError = '';
    }
  }

  // ── Password visibility toggles ───────────────────────────────────────────
  togglePassword(input: HTMLInputElement): void {
    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
  }

  toggleConfirm(input: HTMLInputElement): void {
    this.isConfirmVisible = !this.isConfirmVisible;
    input.type = this.isConfirmVisible ? 'text' : 'password';
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  FORM SUBMISSION
  // ══════════════════════════════════════════════════════════════════════════

  onsignup(form: NgForm): void {
    Object.values(form.controls).forEach(c => c.markAsTouched());

    // Run only the validators for fields that exist in this form
    this.validateName();
    this.validateEmail();
    this.validatePassword();
    this.validateConfirmPassword();
    this.validatePhone();

    const hasFieldError =
      !!this.nameError            ||
      !!this.emailError           ||
      !this.passwordValid         ||
      !!this.confirmPasswordError ||
      !!this.phoneError;

    // date_of_birth is managed by Angular's mat-datepicker directives
    const dobInvalid = form.controls['date_of_birth']?.invalid ?? false;

    if (hasFieldError || dobInvalid) {
      this.loginError = 'Please fix the errors above before submitting.';
      this.Toast.showToast('info', 'Incomplete form', this.loginError);

      document.querySelectorAll<HTMLElement>('input.ng-invalid').forEach(el => {
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
        el.addEventListener('animationend', () => el.classList.remove('shake'), { once: true });
      });

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
    this.lastForm   = form;
    this.isLoading  = true;
    this.loginError = '';

    const formattedDob = this.date_of_birth
      ? this.formatDate(this.date_of_birth.toISOString())
      : '';

    this.loginService.signup(
      this.email.toLowerCase().trim(),
      this.name.trim(),
      this.selectedCountryCode + this.phone.replace(/\D/g, ''),
      this.password,
      this.role,
      formattedDob
    ).pipe(
      catchError(error => {
        const errPayload = error?.error?.error || error?.error || error;
        if (errPayload?.isUnactive || errPayload?.requiresActivation || (typeof errPayload?.message === 'string' && errPayload.message.toLowerCase().includes('activate'))) {
          this.showUnactivePopup = true;
          this.unactiveMessage   = errPayload.message || 'You have already signed up. Please activate your account. We have resent the activation link to your email.';
          this.loginError        = this.unactiveMessage;
          this.Toast.showToast('info', 'Account Exists', this.unactiveMessage);
        } else {
          this.loginError = errPayload?.message || 'Signup failed! User already exists.';
          this.Toast.showToast('error', 'Signup Failed', this.loginError);
        }
        this.isLoading = false;
        return of(null);
      })
    ).subscribe((response: any) => {
      if (!response) return;
      const resPayload = response?.error?.error || response?.error || response;

      if (resPayload?.isUnactive || resPayload?.requiresActivation) {
        this.showUnactivePopup = true;
        this.unactiveMessage   = resPayload.message || 'You have already signed up. Please activate your account. We have resent the activation link to your email.';
        this.loginError        = this.unactiveMessage;
        this.Toast.showToast('info', 'Account Exists', this.unactiveMessage);
        this.isLoading         = false;
      } else if (response.message === 'Signed up in successfully' || response.message === 'signed up successfully') {
        this.Toast.showToast('success', 'Signup', 'Signed up successfully. Please verify your email.');
        this.loggingService.log('User signed up', response.token);
        this.isLoading        = false;
        this.showSuccessPopup = true;
        this.resetForm();
      } else {
        this.loginError = response.message || 'Signup failed! User already exists.';
        this.isLoading  = false;
      }
    });
  }

  closeUnactivePopupAndGoLogin(): void {
    this.showUnactivePopup = false;
    this.router.navigate(['/Login']);
  }

  // ── Reset every field and error back to initial state ────────────────────
  resetForm(): void {
    this.name                = '';
    this.email               = '';
    this.password            = '';
    this.confirmPassword     = '';
    this.selectedCountryIso  = 'AU';
    this.selectedCountryCode = '+61';
    this.phone               = '';
    this.date_of_birth       = null;
    this.role                = 'user';

    this.isPasswordVisible = false;
    this.isConfirmVisible  = false;

    this.passwordChecks = {
      minLength: false, uppercase: false,
      lowercase: false, number:    false, symbol: false
    };
    this.passwordValid = false;

    this.nameError            = '';
    this.emailError           = '';
    this.confirmPasswordError = '';
    this.phoneError           = '';
    this.loginError           = '';

    this.phoneInputMaxLength = 20;

    if (this.lastForm) {
      this.lastForm.resetForm();
    }
  }

  // ── Navigate to login after popup is dismissed ────────────────────────────
  closePopupAndGoLogin(): void {
    this.showSuccessPopup = false;
    this.router.navigate(['/Login']);
  }

  // ── Date formatting helper ────────────────────────────────────────────────
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return this.datePipe.transform(date, 'YYYY-MM-dd')!;
  }
}