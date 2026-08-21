import { Injectable } from '@angular/core';
import { CanActivate, UrlTree } from '@angular/router';
import { Router } from '@angular/router';
import { catchError, map, tap } from 'rxjs/operators';
import { AuthService } from '../User/auth.service';
import { Observable, of } from 'rxjs';
import { LoginService } from '../User/login.service';
import { LoggingService } from '../Logs/logging.service';
import { ToastService } from '../common/toast.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {

  constructor(
    private authService: AuthService,
    private loginservice: LoginService,
    private Toast: ToastService,
    private router: Router,
    private loggingService: LoggingService,
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.checkAuth().pipe(
      tap(response => this.loggingService.log('Auth Guard - response:', response)),
      map(response => {
        if (response.isAuthenticated) {
          return true;
        }

        // FIX: logoutuser() returns an Observable — calling it without
        // .subscribe() creates the Observable but never executes the HTTP
        // request. The server-side logout (cookie/session invalidation)
        // never fires. Added .subscribe() so the request actually runs.
        this.loginservice.logoutuser().subscribe();

        this.Toast.showToast('info', 'Login Required', 'Please login to add items to your cart.');

        // NOTE: verify '/Login' matches your route definition exactly.
        // The artist app uses '/login' (lowercase). If your customer app
        // router also uses lowercase, change this to '/login'.
        return this.router.createUrlTree(['/Login']);
      }),
      catchError(error => {
        this.loggingService.error('Auth Guard - error occurred:', error);

        // FIX: same .subscribe() fix applied here — without it the logout
        // request in the error path was also silently dropped.
        this.loginservice.logoutuser().subscribe();

        return of(this.router.createUrlTree(['/Login']));
      })
    );
  }
}