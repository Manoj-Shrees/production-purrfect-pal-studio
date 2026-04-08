import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of } from 'rxjs';
import { baseurl, headers } from '../servicebasemodel';
import { LoggingService } from '../Logs/logging.service';
import { LoginService } from '../User/login.service';

@Injectable({
  providedIn: 'root'
})

export class AuthService {
 private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable(); // subscribe in components
  url = baseurl;

  constructor(private http: HttpClient, private loggingService: LoggingService, private loginservice: LoginService) { }

  /** ✅ Set full user object */
  setUser(user: any): void {
    this.currentUserSubject.next(user);
    this.loggingService.log('User updated:', user);
  }

  /** ✅ Get current user snapshot (not observable) */
  getUser(): any {
    return this.currentUserSubject.value;
  }


checkAuth(): Observable<{ isAuthenticated: boolean, user?: any }> {
  return this.http.get<{ isAuthenticated: boolean, user?: any }>(
    `${this.url}/auth/status`,
    { withCredentials: true, headers: headers } // ⬅️ for cookie/session auth
  ).pipe(
    map((response: any) => {
      if (response.user && response.user.role === 'artist') {
        this.setUser(response.user); // ✅ keeps BehaviorSubject updated
        return { isAuthenticated: true, user: response.user };
      } else {
        this.setUser(null); // clear user globally
        return { isAuthenticated: false, user: null };
      }
    }),
    catchError(error => {
      this.loggingService.error('Auth check failed:', error);
      this.setUser(null); // ✅ ensure BehaviorSubject is cleared
      this.loginservice.logoutuser().subscribe(); // ⬅️ optional, only if backend requires
      return of({ isAuthenticated: false, user: null });
    })
  );
}


  getuseridfromserver(useremail: any): Observable<any> {

    const { user_id } = useremail;

    return this.http.get(this.url + '/user/email/' + user_id, { headers: headers }).pipe(
      map((response: any) => {
        //this.userId = response;
        this.loggingService.log('User ID from server:', user_id, response[0].ID);
        return response[0].ID;
      }),
      catchError(error => {
        this.loggingService.error('Error fetching user ID from server:', error);
        return of({ ID: 0 }); // Return a default object with ID
      })
    );

  }


}