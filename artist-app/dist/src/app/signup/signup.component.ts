import { Component } from '@angular/core';
import { LoginService } from '../Service/User/login.service';
import { catchError, of, finalize } from 'rxjs';
import { Router } from '@angular/router';
import { FormControl, NgForm } from '@angular/forms';
import { SelectskillService } from '../Service/SelectSkill/selectskill.service';
import { InfoService } from '../Service/ArtistProfile/info.service';
import { ProfileService } from '../Service/ArtistProfile/profile.service';
import { countrycodes } from './datamodel/list';
import { ChangeDetectorRef } from '@angular/core';
import { LoggingService } from '../Service/Logs/logging.service';



@Component({
  selector: 'app-signup',
  standalone: false,
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css',
})

export class SignupComponent {

  email: string = '';
  name: string = '';
  phone: string = '';
  password: string = '';
  confirmPassword: string = '';
  role: string = 'artist';
  loginError: string = '';
  isLoading: boolean = false;
  date_of_birth: Date = new Date();
  selectedFile!: File;
  nameField: any;
  location: string = '';
  skills: any;
  isskillselected: boolean = false;
  art_style: string = '';
  bio: string = '';
  emailInvalid: boolean = false;
  ispasswordmatch: boolean = false;
  maxDate: Date;
  minDate: Date;
  User_ID: any = 1;
  touplodprofileimg: any;
  isPasswordVisible: boolean = false;
  isConfirmVisible: boolean = false;

  selectedCountryCode: string = '+61';

  countrycodelist = countrycodes;

  imagePreview: string | ArrayBuffer | null = null;



  constructor(private loginService: LoginService, private router: Router, private cdr: ChangeDetectorRef,
    private skillselected: SelectskillService, private profileimage: ProfileService, private logger: LoggingService) {
    const today = new Date();
    this.maxDate = new Date(
      today.getFullYear() - 13,
      today.getMonth(),
      today.getDate()
    );

    this.minDate = new Date(
      today.getFullYear() - 100,
      today.getMonth(),
      today.getDate()
    );
  }


  onsignup(form: NgForm): void {

    this.isskillselected = true;
    this.skills = this.skillselected.getskill();

    if (form.invalid) {
      this.loginError = 'Please fill in all required fields';
      this.cdr.detectChanges();

      Object.values(form.controls).forEach(control => {
        control.markAsTouched();
      });

      const firstInvalidControl: HTMLElement | null = document.querySelector(
        'input.ng-invalid, textarea.ng-invalid, select.ng-invalid, mat-form-field .ng-invalid'
      );

      if (firstInvalidControl) {
        setTimeout(() => {
          firstInvalidControl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalidControl.focus();
        }, 100);
      }
    }
    else {
      this.isLoading = true;
      this.cdr.detectChanges(); // ← show loader immediately

      if (this.touplodprofileimg && this.email) {
        this.uploadimage();
      } else {
        this.loginError = 'Something is missing';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }
  }

  openroute() {
    this.router.navigate(['/Login']);
  }


  createuser(fileurl: string) {

    const signupData = {
      email: this.email,
      name: this.name,
      phone: this.selectedCountryCode + ' ' + this.phone,
      password: this.password,
      profile_url: fileurl,
      role: this.role,
      date_of_birth: this.date_of_birth.toISOString().split('T')[0],
      skill: this.skills.value,
      location: this.location,
      art_style: this.art_style,
      bio: this.bio,
      User_ID: this.User_ID,
    };

    this.loginService.signup(signupData)
      .pipe(
        catchError((error) => {
          this.loginError = 'Signup failed! Please check your credentials.';
          this.cdr.detectChanges();
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges(); // ← hide loader after every outcome
        })
      )
      .subscribe((response: any) => {
        if (!response) return;

        if (response.message === 'signed up successfully') {
          this.loginError = 'Signed up successfully';
          this.cdr.detectChanges();
          setTimeout(() => {
            this.verifyuser();
          }, 1000);
          this.router.navigate(['/login']);
        } else {
          this.loginError = 'Something is wrong!';
          this.cdr.detectChanges();
        }
      });
  }


  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    this.touplodprofileimg = [file];

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.cdr.detectChanges();
    };

    reader.readAsDataURL(file);

    input.value = '';
  }

  // ✅ Bug fixed: cdr.detectChanges() added so password-mismatch error shows instantly
  passwordMatchValidator() {
    if (this.password !== this.confirmPassword) {
      this.ispasswordmatch = true;
    } else {
      this.ispasswordmatch = false;
    }
    this.cdr.detectChanges();
  }


  verifyuser(): void {

    this.isLoading = true;
    this.cdr.detectChanges(); // ← show loader immediately

    this.loginService
      .activationlink(this.email, this.name)
      .pipe(
        catchError((error) => {
          this.loginError = 'Error verifying user. Please try again.';
          this.cdr.detectChanges(); // ✅ Bug fixed: was missing
          return of(null);
        }),
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges(); // ✅ Bug fixed: was missing — loader stayed forever
        })
      )
      .subscribe((response: any) => {
        if (!response) return;

        if (response.message === 'verification  email sent.') {
          this.loginError = 'Activation link sent successfully';
          this.cdr.detectChanges(); // ✅ Bug fixed: was missing
          this.openroute();
        } else {
          this.loginError = 'Error verifying user.';
          this.cdr.detectChanges(); // ✅ Bug fixed: was missing
        }
      });
  }

  validateEmail(email: string) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = !regex.test(email);
    this.cdr.detectChanges(); // ✅ Bug fixed: email error now shows without clicking elsewhere
  }


  adjustHeight(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  uploadimage() {
    this.profileimage.upload(this.touplodprofileimg, this.email).subscribe(
      (response) => {
        this.logger.log('Profile image updated successfully:', response.files[0].path);
        const filepath = "http://localhost:8080/" + response.files[0].path;
        this.createuser(filepath);
      },
      (error) => {
        this.logger.error('Error updating profile image:', error);
        this.loginError = 'Failed to upload profile image. Please try again.';
        this.isLoading = false;
        this.cdr.detectChanges(); // ✅ Bug fixed: was missing
      }
    );
  }


  togglePassword(input: HTMLInputElement): void {
    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
  }

  toggleConfirm(input: HTMLInputElement): void {
    this.isConfirmVisible = !this.isConfirmVisible;
    input.type = this.isConfirmVisible ? 'text' : 'password';
  }

  allowNumbersOnly(event: KeyboardEvent) {
    if (!/[0-9]/.test(event.key)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  formatPhoneNumber(event: any) {
    const inputEl = event.target as HTMLInputElement;
    const isIndonesia = this.selectedCountryCode === '+62';
    const maxDigits = isIndonesia ? 11 : 10;

    let digits = inputEl.value.replace(/\D/g, '');
    digits = digits.slice(0, maxDigits);

    let formatted = '';
    if (isIndonesia) {
      if (digits.length >= 1) formatted += digits.substring(0, 3);
      if (digits.length >= 4) formatted += ' ' + digits.substring(3, 7);
      if (digits.length >= 8) formatted += ' ' + digits.substring(7, 11);
    } else {
      if (digits.length >= 1) formatted += digits.substring(0, 3);
      if (digits.length >= 4) formatted += ' ' + digits.substring(3, 6);
      if (digits.length >= 7) formatted += ' ' + digits.substring(6, 10);
    }

    const prevCursor = inputEl.selectionStart || 0;
    const oldLength = inputEl.value.length;

    inputEl.value = formatted;
    this.phone = formatted;

    inputEl.maxLength = isIndonesia ? 13 : 12;

    const newCursor = prevCursor + (formatted.length - oldLength);

    setTimeout(() => {
      inputEl.setSelectionRange(newCursor, newCursor);
    });
  }


  isPhoneValid(): boolean {
    if (!this.phone) return false;
    const digits = this.phone.replace(/\D/g, '');
    return this.selectedCountryCode === '+62'
      ? digits.length === 11
      : digits.length === 10;
  }

}