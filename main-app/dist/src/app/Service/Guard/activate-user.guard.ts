import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';

export class activateUserGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const token = route.queryParamMap.get('token');

    if (token && token.length > 10) { // Optional: add real validation
      return true;
    }

    // Redirect to login or error page if token is missing/invalid
    return this.router.createUrlTree(['/invalid-link']);
  }
}
