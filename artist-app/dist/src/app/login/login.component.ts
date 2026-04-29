import { ChangeDetectorRef, Component, NgZone, OnInit } from '@angular/core';
import { LoginService } from '../Service/User/login.service';
import { catchError, finalize, of } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../Service/Auth/auth.service';
import { RouteAccessService } from '../Service/Auth/route-access.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {

  email: string = '';
  password: string = '';
  loginError: string = '';
  isLoading: boolean = false;
  emailInvalid: boolean = false;
  isPasswordVisible: boolean = false;

  constructor(
    private login: LoginService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,                     // ✅ Fix 1: inject NgZone
    private accessService: RouteAccessService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.authService.checkAuth().subscribe(response => {
      if (response.isAuthenticated && response.user) {
        this.authService.setUser(response.user);
        this.ngZone.run(() => this.router.navigate(['/jobs']));
      }
    });
  }

  onlogin() {
    // ✅ Fix 2: reset flags on every attempt so stale state never blocks
    this.loginError = '';
    this.emailInvalid = false;

    if (!this.email || !this.password) {
      this.loginError = 'Please enter your email and password to login.';
      this.cdr.detectChanges();
      return;
    }

    if (this.emailInvalid) {
      this.loginError = 'Please enter a valid email address.';
      this.cdr.detectChanges();
      return;
    }

    this.isLoading = true;
    this.cdr.detectChanges(); // ✅ show loader immediately

    this.login
      .loginuser(this.email, this.password)
      .pipe(
        catchError(() => {
          // ✅ Fix 3: NgZone.run() guarantees Angular sees state changes
          this.ngZone.run(() => {
            this.loginError = 'Login failed! Please check your credentials.';
            this.cdr.detectChanges();
          });
          return of(null);
        }),
        finalize(() => {
          // ✅ Fix 4: finalize MUST also run inside zone + trigger detection
          this.ngZone.run(() => {
            this.isLoading = false;
            this.cdr.detectChanges(); // <-- this was the loader bug
          });
        })
      )
      .subscribe((response: any) => {
        if (!response) return; // catchError already handled UI

        this.ngZone.run(() => {
          if (response.message === 'Logged in successfully') {
            this.router.navigate(['/jobs']);
          } else {
            this.loginError = 'Invalid login credentials!';
            this.cdr.detectChanges();
          }
        });
      });
  }

  validateEmail(email: string): void {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    this.emailInvalid = !regex.test(email);
  }

  togglePassword(input: HTMLInputElement): void {
    this.isPasswordVisible = !this.isPasswordVisible;
    input.type = this.isPasswordVisible ? 'text' : 'password';
  }

  openforgotpassroute(): void {
    this.accessService.allowNextAccess();
    this.router.navigate(['/forgot-password']);
  }
}