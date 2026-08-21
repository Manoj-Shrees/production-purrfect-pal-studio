import { Injectable } from '@angular/core';
import { baseurl, fileheaders, headers } from '../servicebasemodel';
import { catchError, Observable, of, switchMap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { LoggingService } from '../Logs/logging.service';

interface LoginResponse {
  token: string;
  user: any;
}

interface ResetPasswordResponse {
  verified: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class LoginService {
  private url = baseurl;

  constructor(
    private http: HttpClient,
    private loggingService: LoggingService,
  ) {}

  loginuser(username: string, password: string) {
    const body = { username, password, role: 'user' };

    return this.http
      .post<LoginResponse>(this.url + '/login', body, {
        headers: headers,
        withCredentials: true,
      })
      .pipe(
        switchMap(response => {
          this.loggingService.log('Login successful:', response);
          if (response?.token && typeof localStorage !== 'undefined') {
            localStorage.setItem('usertoken', response.token);
          }
          return of(response);
        }),
      );
  }

  // ─── Forgot password: request reset link ────────────────────────────────────
  forgotpasslink(email: string): Observable<any> {
    const body = { email };

    return this.http
      .post(this.url + '/reset-password', body, { headers: headers })
      .pipe(
        switchMap(response => {
          this.loggingService.log('Forgot password link requested:', response);
          return of(response);
        }),
        catchError(error => {
          this.loggingService.error('forgotpasslink error:', error);
          return of({ message: 'http_error', token: null });
        }),
      );
  }

  // ─── Forgot password: verify token + update password ────────────────────────
  // FIX: this method was missing — the ForgotPasswordResetComponent depends on it.
  verfiyuserandupdatepass(
    newpass: string,
    token: string,
    email: string,
  ): Observable<ResetPasswordResponse> {
    const body = { newpass, token, email };

    return this.http
      .post<ResetPasswordResponse>(
        this.url + '/reset-password/verify',
        body,
        { headers: headers },
      )
      .pipe(
        switchMap(response => {
          this.loggingService.log('Password reset successful:', response);
          return of(response);
        }),
        catchError(error => {
          this.loggingService.error('Password reset error:', error);
          // Re-throw so the component's error handler can inspect status codes
          throw error;
        }),
      );
  }

  logoutuser(): Observable<any> {
    return this.http.post(this.url + '/logout', {}, {
      headers: fileheaders,
      withCredentials: true,
    }).pipe(
      switchMap(response => {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('usertoken');
        }
        return of(response);
      })
    );
  }

  signup(
    email: string,
    name: string,
    phone: string,
    password: string,
    role: string,
    date_of_birth: string,
  ) {
    const body = { email, name, phone, date_of_birth, password, role };

    return this.http.post(this.url + '/user/create', body, { headers: headers }).pipe(
      switchMap(response => {
        this.loggingService.log('Signup successful:', response);
        return of(response);
      }),
      catchError(error => of({ error })),
    );
  }

  verifyuser(email: string): Observable<any> {
    const body = { email };

    return this.http.post(this.url + '/activate', body, { headers: headers }).pipe(
      switchMap(response => {
        this.loggingService.log('Account verification successful:', response);
        return of(response);
      }),
      catchError(error => {
        this.loggingService.error('Account verification failed:', error);
        return of({ error });
      }),
    );
  }
}