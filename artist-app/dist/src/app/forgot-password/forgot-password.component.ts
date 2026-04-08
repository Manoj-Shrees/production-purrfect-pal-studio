import { Component } from '@angular/core';
import { catchError, of } from 'rxjs';
import { LoginService } from '../Service/User/login.service';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';

import * as LZString from 'lz-string';
import { LoggingService } from '../Service/Logs/logging.service';
import { RouteAccessService } from '../Service/Auth/route-access.service';

@Component({
  selector: 'app-forgot-password',
  standalone: false,

  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {

  email: string = '';
  name: string = '';
  isLoading: boolean = false;
  forgotpasserror: string = '';
  emailInvalid: boolean = false;
  isPasswordVisible: boolean = false;

  constructor(private loginService: LoginService, private router: Router,
     private accessService: RouteAccessService, private loggingService: LoggingService) { }

  forgotpass(event: Event, form: NgForm): void {

    if (form.invalid) {

      // Mark all fields as touched so errors show
      Object.values(form.controls).forEach(control => {
        control.markAsTouched();
      });

      // Scroll to first invalid field
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

      event.preventDefault(); // Prevents the default action of the anchor tag (navigating)

      this.isLoading = true;

      this.loginService.forgotpasslink(this.email.toLowerCase())
        .pipe(
          catchError((error) => {
            this.forgotpasserror = 'Login failed! Please check your credentials.';
            return of(error);
          })
        )
        .subscribe((response) => {

          if (response.message === 'Password reset email sent.') {
            // Store token or navigate the user after successful login
            this.loggingService.log('forgot pass mail send successfully', response.token);
            this.forgotpasserror = 'forgot pass mail send successfully'; // Clear any previous errors
            //this.Toast.showToast('success', 'Forgot Password', 'Password reset email sent successfully.');
            this.accessService.allowNextAccess();

            this.router.navigate(['/ForgotPasswordemailsend'], {
              queryParams: { email: LZString.compressToEncodedURIComponent(this.email.toLowerCase()) }
            });
          } else {
            this.forgotpasserror = 'user not found';
           // this.Toast.showToast('error', 'Forgot Password', 'User not found.');
          }
          this.isLoading = false;
        });

    }
  }


  // validate email
  validateEmail(email: string) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = !regex.test(email);
  }

  // toggle password visibility

  togglePassword(input: HTMLInputElement): void {
    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
  }


}

