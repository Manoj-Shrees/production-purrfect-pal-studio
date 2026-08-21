import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { UsersService } from '../Service/User/users.service';
import { LoggingService } from '../Service/Logs/logging.service';
import { ToastService } from '../Service/common/toast.service';
import { timeout } from 'rxjs/operators';
import { TimeoutError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-account-verified',
  standalone: false,
  templateUrl: './account-verified.component.html',
  styleUrl: './account-verified.component.css',
  animations: [
    trigger('fadeUp', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(12px)' }),
        animate('420ms cubic-bezier(0.4, 0, 0.2, 1)',
          style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ]
})
export class AccountVerifiedComponent implements OnInit {
  isverified:     boolean = false;
  isloading:      boolean = true;
  iserror:        boolean = false;
  isnetworkerror: boolean = false;
  isArtist:       boolean = false;
  verification_code: string = '';
  email: string = '';

  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userservice: UsersService,
    private loggingService: LoggingService,
    private Toast: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.verification_code = params['token'];
        this.email = params['id'];

        if (!this.verification_code || !this.email) {
          this.loggingService.error('Verification code or email is missing.');
          this.isloading      = false;
          this.iserror        = true;
          this.isnetworkerror = false;
          this.cdr.markForCheck();
          return;
        }

        this.activateAccount();
      });
  }

  activateAccount(): void {
    this.isloading      = true;
    this.iserror        = false;
    this.isnetworkerror = false;
    this.isverified     = false;
    this.isArtist       = false;
    this.cdr.markForCheck();

    this.userservice.activateuser(this.verification_code, this.email)
      .pipe(
        timeout(10000),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.loggingService.log('Account activated:', response);
          this.isArtist       = response?.role === 'artist' || response?.isArtist === true;
          this.isverified     = true;
          this.isloading      = false;
          this.iserror        = false;
          this.isnetworkerror = false;
          this.cdr.markForCheck();
          this.Toast.showToast('success', 'Account Verified',
            'Your account has been successfully verified.');
        },
        error: (err) => {
          this.isloading  = false;
          this.isverified = false;

          if (err instanceof TimeoutError) {
            this.loggingService.error('Activation request timed out.', err);
            this.isnetworkerror = true;
            this.iserror        = false;
            this.Toast.showToast('error', 'Connection Timeout',
              'The request took too long. Please check your connection and try again.');

          } else if (err instanceof HttpErrorResponse && err.status === 0) {
            this.loggingService.error('Network error — request blocked.', err);
            this.isnetworkerror = true;
            this.iserror        = false;
            this.Toast.showToast('error', 'Connection Error',
              'Could not reach the server. Please try again shortly.');

          } else {
            this.loggingService.error('Error activating account:', err);
            this.isnetworkerror = false;
            this.iserror        = true;
            this.Toast.showToast('error', 'Verification Failed',
              'This link is invalid or has already been used.');
          }

          this.cdr.markForCheck();
        }
      });
  }

  goToSignIn(): void {
    if (this.isArtist) {
      window.location.href = 'https://artist.purrfectpal.studio/login';
    } else {
      this.router.navigate(['/Login']);
    }
  }
}