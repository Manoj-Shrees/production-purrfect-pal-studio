import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../User/auth.service';
import { RouteAccessService } from '../User/route-access-service.service';
import { map, catchError, of } from 'rxjs';

export const customRouteGuardGuard: CanActivateFn = (route, state) => {
  const authService   = inject(AuthService);
  const accessService = inject(RouteAccessService);
  const router        = inject(Router);

 
  if (accessService.isNextAccessAllowed()) {
    accessService.consumeAccess(); // consume the single-use flag
    return true;
  }

  return authService.checkAuth().pipe(
    map(response => {
      if (response.isAuthenticated) {
        return true;
      }
      return router.createUrlTree(['/Login']);
    }),
    catchError(error => {
      console.error('Custom Route Guard - error occurred:', error);
      return of(router.createUrlTree(['/Login']));
    })
  );
};