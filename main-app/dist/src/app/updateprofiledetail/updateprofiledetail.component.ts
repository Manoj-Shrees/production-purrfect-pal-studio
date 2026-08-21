import { DatePipe } from '@angular/common';
import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { ProfileService } from '../Service/Profile/profile.service';
import { catchError, of } from 'rxjs';
import { AuthService } from '../Service/User/auth.service';
import { UsersService } from '../Service/User/users.service';
import { Router } from '@angular/router';
import { LoggingService } from '../Service/Logs/logging.service';
import { countrycodes } from '../signup/datamodel/list';
import { ToastService } from '../Service/common/toast.service';
import { NgForm } from '@angular/forms';
import { parsePhoneNumberFromString, AsYouType, CountryCode } from 'libphonenumber-js';

@Component({
  selector: 'app-updateprofiledetail',
  standalone: false,
  templateUrl: './updateprofiledetail.component.html',
  styleUrls: ['./updateprofiledetail.component.css']
})
export class UpdateprofiledetailComponent {

  @Input() data!: { email: string; };
  @ViewChild('close_button')
  private close_button!: ElementRef;

  public hideModel() {
    this.close_button.nativeElement.click();
    this.reloadRoute();
  }

  email: string = '';
  name: string = '';
  selectedCountryIso: string = 'AU';
  selectedCountryCode: string = '+61';
  phone_number: string = '';
  loginError: string = '';
  isLoading: boolean = false;
  dob: Date = new Date();
  location: string = '';
  skills: any;
  isskillselected: boolean = false;
  artStyle: string = '';
  bio: string = '';
  emailInvalid: boolean = false;
  ispasswordmatch: boolean = false;
  maxDate: Date;
  minDate: Date;
  userdata: any;

  countrycodelist = countrycodes;

  constructor(
    private usersdetail: ProfileService,
    private datepipe: DatePipe,
    private router: Router,
    private loggingService: LoggingService,
    private Toast: ToastService,
    private authService: AuthService,
    private userservice: UsersService
  ) {
    const today = new Date();
    this.maxDate = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
    this.minDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());
  }

  ngOnInit(): void {
    this.getuserdata(this.data.email);
  }

  reloadRoute() {
    const currentUrl = this.router.url;
    this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
      this.router.navigate([currentUrl]);
    });
  }

  getuserdata(user_id: string) {
    this.loggingService.log(user_id);

    this.userservice.getuserdetailbyid(user_id).pipe().subscribe((data) => {
      this.userdata = data;

      // ── Pre-fill name ──────────────────────────────────────────
      this.name = data[0].Name;

      // ── Pre-fill DOB ───────────────────────────────────────────
      this.dob = new Date(data[0].date_of_birth);

      // ── Pre-fill phone: extract country code then format ───────
      const fullPhone: string = data[0].phone || '';
      const parsed = parsePhoneNumberFromString(fullPhone);
      if (parsed && parsed.country) {
        this.selectedCountryIso = parsed.country;
        const matched = this.countrycodelist.find(c => c.iso === parsed.country);
        if (matched) {
          this.selectedCountryCode = matched.code;
        } else {
          this.selectedCountryCode = `+${parsed.countryCallingCode}`;
        }
        this.phone_number = this.formatPhoneString(parsed.nationalNumber as string);
      } else {
        // Fallback: just strip non-digits and display as-is
        const matchedCode = this.countrycodelist.find(c => fullPhone.startsWith(c.code));
        if (matchedCode) {
          this.selectedCountryIso = matchedCode.iso;
          this.selectedCountryCode = matchedCode.code;
          const rawDigits = fullPhone.replace(matchedCode.code, '');
          this.phone_number = this.formatPhoneString(rawDigits);
        } else {
          this.selectedCountryIso = 'AU';
          this.selectedCountryCode = '+61';
          this.phone_number = this.formatPhoneString(fullPhone);
        }
      }
    });
  }

  onCountryIsoChange(): void {
    const found = this.countrycodelist.find(c => c.iso === this.selectedCountryIso);
    if (found) {
      this.selectedCountryCode = found.code;
    }
    this.phone_number = '';
  }

  onCountryCodeChange(): void {
    const found = this.countrycodelist.find(c => c.code === this.selectedCountryCode);
    if (found) {
      this.selectedCountryIso = found.iso;
    }
    this.phone_number = '';
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

  onupdate(form: NgForm): void {
    if (form.invalid) {
      this.loginError = 'Please fill in all required fields';
      this.Toast.showToast('error', 'Update Failed', this.loginError);

      Object.values(form.controls).forEach(control => control.markAsTouched());

      const firstInvalidControl: HTMLElement | null = document.querySelector(
        'input.ng-invalid, textarea.ng-invalid, select.ng-invalid, mat-form-field .ng-invalid'
      );

      if (firstInvalidControl) {
        setTimeout(() => {
          firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalidControl.focus();
        }, 100);
      }
    } else {
      this.isLoading = true;

      const userinfo = {
        name: this.name,
        phone: this.selectedCountryCode + this.phone_number.replace(/\D/g, ''),
        date_of_birth: this.formatDate('' + this.dob),
      };

      this.loggingService.log(userinfo);

      this.usersdetail.update_pro_data(this.data.email, userinfo)
        .pipe(catchError((error) => of(error)))
        .subscribe((response) => {
          if (response) {
            this.loggingService.log('User updated successfully:', response);
            this.loginError = 'Profile updated successfully';
            this.Toast.showToast('success', 'Profile Update', 'Profile updated successfully.');
            this.isLoading = true;
            setTimeout(() => {
              this.isLoading = false;
              this.hideModel();
            }, 1000);
          } else {
            this.loginError = 'Invalid login credentials!';
            this.Toast.showToast('error', 'Update Failed', this.loginError);
            this.loggingService.error('Error updating user:', response);
            this.isLoading = false;
          }
        });
    }
  }

  // ── Event-based formatter (used by the input's (input) binding) ───────────
  formatPhoneNumber(event: any) {
    const inputEl = event.target as HTMLInputElement;
    const rawValue = inputEl.value;
    const formatted = this.formatPhoneString(rawValue);

    const prevCursor = inputEl.selectionStart || 0;
    const oldLength = inputEl.value.length;

    inputEl.value = formatted;
    this.phone_number = formatted;

    const newCursor = prevCursor + (formatted.length - oldLength);
    setTimeout(() => inputEl.setSelectionRange(newCursor, newCursor));
  }

  allowNumbersOnly(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  isPhoneLengthValid(): boolean {
    if (!this.phone_number) return false;
    const digitsOnly = this.phone_number.replace(/\D/g, '');
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
    if (!this.phone_number) return false;
    if (!this.isPhoneLengthValid()) return false;
    try {
      const parsed = parsePhoneNumberFromString(this.phone_number, this.selectedCountryIso as CountryCode);
      return parsed ? parsed.isPossible() : false;
    } catch {
      return false;
    }
  }

  getPhoneErrorMessage(): string {
    if (!this.phone_number) {
      return 'Phone number is required.';
    }
    if (!this.isPhoneLengthValid()) {
      const countryObj = this.countrycodelist.find(c => c.iso === this.selectedCountryIso);
      const expected = countryObj ? countryObj.lengths : '';
      return `Phone number must be ${expected} digits.`;
    }
    return 'Please enter a valid phone number.';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return this.datepipe.transform(date, 'YYYY-MM-dd')!;
  }
}