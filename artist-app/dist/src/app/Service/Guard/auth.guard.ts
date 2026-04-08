import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../Auth/auth.service';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})

export class authGuard implements CanActivate {


  constructor(private authService: AuthService, private router: Router) { }

  canActivate(): Observable<boolean | UrlTree> {
    return this.authService.checkAuth().pipe(
      tap(response => console.log('Auth Guard - response:', response)),
      map(response => {
        if (response.isAuthenticated) {
          // Optional: Store user info globally here if needed
          return true;
        } else {
          return this.router.createUrlTree(['/login']);
        }
      }),
      catchError(error => {
        console.error('Auth Guard - error occurred:', error);
        return of(this.router.createUrlTree(['/login']));
      })
    );
  }

}
