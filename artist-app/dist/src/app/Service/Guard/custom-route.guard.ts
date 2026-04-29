import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../Auth/auth.service';
import { map, catchError, of } from 'rxjs';

export const customRouteGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.checkAuth().pipe(
    map(response => {
      if (response.isAuthenticated) {
        return true;
      }
      return router.createUrlTree(['/login']);
    }),
    catchError(error => {
      console.error('Custom Route Guard - error occurred:', error);
      return of(router.createUrlTree(['/login']));
    })
  );
};