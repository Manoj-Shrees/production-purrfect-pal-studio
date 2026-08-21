import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, interval, map, of, Subscription, take } from 'rxjs';
import { LoginService } from '../Service/User/login.service';
import * as LZString from 'lz-string';
import { LoggingService } from '../Service/Logs/logging.service';

@Component({
  selector: 'app-account-verification',
  standalone: false,
  
  templateUrl: './account-verification.component.html',
  styleUrl: './account-verification.component.css'
})
export class AccountVerificationComponent {
  
  
    countdown = signal <number> (0);
    subscription!: Subscription;
    isResendDisabled: boolean = false;
    useremail: string = '';
    resendAttempts: number = 0;
    errormsg = '';
    readonly maxAttempts = 3;


  constructor(private activeroute: ActivatedRoute, private loginService: LoginService, private router: Router, private loggingService: LoggingService) {}

  ngOnInit(): void {

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
    this.loggingService.log('Password reset link sent again');

    this.loginService.verifyuser(this.useremail)
          .pipe(
            catchError((error) => {
              return of(error);
            })
          )
          .subscribe((response) => {
    
            if (response.message === 'Verification email sent.') {
              // Store token or navigate the user after successful login
         
            } else {
              this.errormsg = 'Error sending reset link. Please try again later.';
            }
          });
    
        }
      }
  
  
  
  
  }
