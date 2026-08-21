// forgot-password.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { catchError, of } from 'rxjs';
import { LoginService } from '../Service/User/login.service';
import { UsersService } from '../Service/User/users.service';
import { NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { RouteAccessService } from '../Service/User/route-access-service.service';
import * as LZString from 'lz-string';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';

@Component({
  selector: 'app-forgot-password',
  standalone: false,
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordComponent {
  email = '';

  isLoading    = signal(false);
  emailInvalid = signal(false);
  serverError  = signal('');
  shakeEmail   = signal(false);

  private readonly EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private loginService: LoginService,
    private usersService: UsersService,
    private router: Router,
    private accessService: RouteAccessService,
    private loggingService: LoggingService,
    private toast: ToastService,
  ) {}

  onEmailChange(value: string): void {
    this.emailInvalid.set(value.length > 0 && !this.EMAIL_RE.test(value));
    if (this.serverError()) this.serverError.set('');
  }

  forgotpass(event: Event, form: NgForm): void {
    event.preventDefault();

    if (form.invalid || this.emailInvalid()) {
      Object.values(form.controls).forEach(c => c.markAsTouched());
      this.triggerShake();
      return;
    }

    this.isLoading.set(true);
    this.serverError.set('');

    const targetEmail = this.email.toLowerCase();

    // Check user role before sending forgot pass email
    this.usersService.getuserdetailbyid(targetEmail).pipe(
      catchError(err => {
        this.loggingService.error('Error checking user role in forgot-password', err);
        return of(null);
      })
    ).subscribe((data: any) => {
      const user = Array.isArray(data) && data.length > 0 ? data[0] : data;
      const role = user?.role || user?.Role;

      if (role === 'artist') {
        this.isLoading.set(false);
        this.toast.showToast('info', 'Artist Portal', 'Redirecting to the Artist Portal...');
        setTimeout(() => {
          window.location.href = 'https://artist.purrfectpal.studio';
        }, 1500);
        return;
      }

      this.sendResetLink(targetEmail);
    });
  }

  private sendResetLink(email: string): void {
    this.loginService
      .forgotpasslink(email)
      .pipe(
        catchError(err => {
          this.loggingService.error('forgotpasslink HTTP error', err);
          return of({ message: 'http_error', token: null });
        }),
      )
      .subscribe((response: any) => {
        this.isLoading.set(false);

        const isHttpError = response?.message === 'http_error';
        const msg: string = typeof response?.message === 'string'
          ? response.message.toLowerCase()
          : '';

        const sent =
          !isHttpError &&
          (msg.includes('sent')       ||   // future-proof
           msg.includes('shortly')    ||   // current GENERIC_OK
           msg.includes('receive')    ||   // current GENERIC_OK
           msg.includes('registered'));    // current GENERIC_OK

        if (sent) {
          this.loggingService.log('Reset email sent successfully');
          this.toast.showToast('success', 'Forgot Password', 'Password reset email sent.');
          this.accessService.allowNextAccess();
          this.router.navigate(['/ForgotPasswordemailsend'], {
            queryParams: {
              email: LZString.compressToEncodedURIComponent(email),
            },
          });
          return;
        }

        // All failure paths: stay on page, show error
        const errorMsg = isHttpError
          ? 'Unable to reach the server. Please try again.'
          : (response?.message ?? 'Something went wrong. Please try again.');

        this.serverError.set(errorMsg);

        if (!isHttpError) {
          this.toast.showToast('error', 'Forgot Password', errorMsg);
        }

        this.triggerShake();
      });
  }

  private triggerShake(): void {
    this.shakeEmail.set(true);
    setTimeout(() => this.shakeEmail.set(false), 500);
  }
}