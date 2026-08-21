import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { customRouteGuardGuard } from './custom-route-guard.guard';

describe('customRouteGuardGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => customRouteGuardGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
