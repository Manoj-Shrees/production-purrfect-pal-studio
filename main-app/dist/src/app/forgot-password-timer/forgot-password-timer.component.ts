import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, interval, map, of, Subscription, take } from 'rxjs';
// FIX (Bug 2): Use namespace import `* as` for consistent behaviour across
// Angular builds (avoids "default import" ESM interop issues with lz-string).
import * as LZString from 'lz-string';
import { LoginService } from '../Service/User/login.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';

@Component({
  selector: 'app-forgot-password-timer',
  standalone: false,
  templateUrl: './forgot-password-timer.component.html',
  styleUrl: './forgot-password-timer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordTimerComponent implements OnInit, OnDestroy {

  countdown      = signal<number>(0);
  useremail      = signal<string>('');
  resendAttempts = signal<number>(0);

  readonly maxAttempts = 3;
  private countdownSub?: Subscription;

  constructor(
    private activeroute: ActivatedRoute,
    private loginService: LoginService,
    private loggingService: LoggingService,
    private Toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.activeroute.queryParams.subscribe(params => {
      const compressed = params['email'];
      if (compressed) {
        const decoded = LZString.decompressFromEncodedURIComponent(compressed);
        this.useremail.set(decoded ?? '');
      }
    });
  }

  ngOnDestroy(): void {
    this.countdownSub?.unsubscribe();
  }

  resendLink(): void {
    if (this.resendAttempts() >= this.maxAttempts) return;

    this.resendAttempts.update(n => n + 1);
    this.startCountdown(30);
    this.sendEmail();
  }

  private startCountdown(seconds: number): void {
    this.countdownSub?.unsubscribe();
    this.countdown.set(seconds);

    this.countdownSub = interval(1000)
      .pipe(take(seconds), map(i => seconds - 1 - i))
      .subscribe(timeLeft => this.countdown.set(timeLeft));
  }

  private sendEmail(): void {
    const email = this.useremail();
    if (!email) return;

    this.loginService
      .forgotpasslink(email.toLowerCase())
      .pipe(
        catchError(err => {
          this.loggingService.error('Resend error', err);
          return of({ message: 'http_error' });
        }),
      )
      .subscribe((response: any) => {
        // FIX (Bug 1 mirror): same broadened success check as
        // forgot-password.component.ts so the toast fires correctly.
        const isHttpError = response?.message === 'http_error';
        const msg: string = typeof response?.message === 'string'
          ? response.message.toLowerCase()
          : '';

        const sent =
          !isHttpError &&
          (msg.includes('sent')    ||
           msg.includes('shortly') ||
           msg.includes('receive') ||
           msg.includes('registered'));

        if (sent) {
          this.Toast.showToast(
            'success',
            'Forgot Password',
            'Reset email sent successfully.',
          );
        } else {
          this.Toast.showToast(
            'error',
            'Forgot Password',
            'Failed to send reset email.',
          );
        }
      });
  }
}