import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from '@angular/router';

import { activateUserGuard } from './activate-user.guard';     

describe('activateUserGuard', () => {
  let guard: activateUserGuard;
  let routerSpy: jasmine.SpyObj<Router>;
  let mockRoute: ActivatedRouteSnapshot;

  beforeEach(() => {
    // Create a mock Router with a spy on createUrlTree
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        activateUserGuard,
        { provide: Router, useValue: routerSpy }
      ]
    });

    guard = TestBed.inject(activateUserGuard);

    // Create a mock route
    mockRoute = {
      queryParamMap: {
        get: (key: string) => null
      }
    } as unknown as ActivatedRouteSnapshot;
  });

  it('should allow activation when token is valid', () => {
    mockRoute.queryParamMap.get = () => 'valid-token-123456';

    const result = guard.canActivate(mockRoute);

    expect(result).toBeTrue();
  });

  it('should deny activation and redirect when token is missing or too short', () => {
    mockRoute.queryParamMap.get = () => null;
    const fakeUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    const result = guard.canActivate(mockRoute);

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/invalid-link']);
    expect(result).toBe(fakeUrlTree);
  });

  it('should deny activation if token is shorter than 10 characters', () => {
    mockRoute.queryParamMap.get = () => 'short';
    const fakeUrlTree = {} as UrlTree;
    routerSpy.createUrlTree.and.returnValue(fakeUrlTree);

    const result = guard.canActivate(mockRoute);

    expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/invalid-link']);
    expect(result).toBe(fakeUrlTree);
  });
});