import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';

import { ResetPasswordGuard } from './reset-password.guard';

describe('ResetPasswordGuard', () => {
  let guard: ResetPasswordGuard;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        ResetPasswordGuard,
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(ResetPasswordGuard);
  });

  function mockRouteWithToken(token: string | null): ActivatedRouteSnapshot {
    return {
      queryParamMap: {
        get: () => token
      }
    } as unknown as ActivatedRouteSnapshot;
  }

  it('should allow activation when token is valid (length > 10)', () => {
    const mockRoute = mockRouteWithToken('valid-token-123');

    const result = guard.canActivate(mockRoute);

    expect(result).toBeTrue();
  });

  it('should redirect when token is missing', () => {
    const fakeUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    const mockRoute = mockRouteWithToken(null);
    const result = guard.canActivate(mockRoute);

    expect(result).toBe(fakeUrlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/invalid-link']);
  });

  it('should redirect when token is too short', () => {
    const fakeUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    const mockRoute = mockRouteWithToken('short');
    const result = guard.canActivate(mockRoute);

    expect(result).toBe(fakeUrlTree);
    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/invalid-link']);
  });
});