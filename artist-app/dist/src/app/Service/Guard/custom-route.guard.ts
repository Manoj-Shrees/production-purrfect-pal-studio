import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { RouteAccessService } from '../Auth/route-access.service';


export const customRouteGuard: CanActivateFn = (route, state) => {
  const accessService = inject(RouteAccessService);
  const router = inject(Router);

  const canEnter = accessService.consumeAccess();

  return canEnter ? true : router.createUrlTree(['']);
};
