import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, of, Subscription } from 'rxjs';
import LZString from 'lz-string';
import { catchError, map, take } from 'rxjs/operators';
import { LoginService } from '../Service/User/login.service';
import { LoggingService } from '../Service/Logs/logging.service';


@Component({
  selector: 'app-forgot-password-timer',
  standalone: false,

  templateUrl: './forgot-password-timer.component.html',
  styleUrl: './forgot-password-timer.component.css'
})
export class ForgotPasswordTimerComponent {


  countdown = signal<number>(0);
  subscription!: Subscription;
  isResendDisabled: boolean = false;
  useremail: string = '';
  resendAttempts: number = 0;
  errormsg = '';
  readonly maxAttempts = 3;


  constructor(private activeroute: ActivatedRoute, private loginService: LoginService,
     private router: Router, private loggingService: LoggingService) { }

  ngOnInit(): void {
    // Recieving Data from My Cart Page
    this.activeroute.queryParams.subscribe(params => {
      const compressedEmail = params['email'];
      if (compressedEmail) {
        this.useremail = LZString.decompressFromEncodedURIComponent(compressedEmail);
        this.loggingService.log('Decompressed email:', this.useremail);
        // Use the email as needed
      }
    });
  }


  startCountdown() {
    this.isResendDisabled = true;

    this.subscription = interval(1000).pipe(
      take(30),
      map(i => 29 - i) // Countdown from 29 to 0
    ).subscribe(timeLeft => {
      this.countdown.set(timeLeft);

      if (timeLeft === 0) {
        this.isResendDisabled = false;
      }
    });
  }

  resendLink() {

    if (this.resendAttempts > this.maxAttempts) {
      this.loggingService.warn('Maximum resend attempts reached. Please try again later.');
      this.countdown.set(0);
    }

    else {

      this.resendAttempts += 1;

      this.countdown.set(30); // Reset countdown to 30 seconds

      // Cancel previous subscription (if still running)
      if (this.subscription) {
        this.subscription.unsubscribe();
      }

      this.startCountdown();

      // Add resend logic


      this.loginService.forgotpasslink(this.useremail.toLowerCase())
        .pipe(
          catchError((error) => {
            return of(error);
          })
        )
        .subscribe((response) => {

          if (response.message === 'Password reset email sent.') {
            // Store token or navigate the user after successful login
            this.loggingService.log('forgot pass mail send successfully', response.token);
            //this.Toast.showToast('success', 'Forgot Password', 'Password reset email sent successfully.');

          } else {
            //this.Toast.showToast('error', 'Forgot Password', 'Failed to send password reset email.');
          }

        });



    }
  }
}