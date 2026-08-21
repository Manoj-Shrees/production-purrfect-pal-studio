import { TestBed } from '@angular/core/testing';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthGuard } from './auth.guard';
import { of, throwError } from 'rxjs';
import { AuthService } from '../User/auth.service';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let authServiceSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authServiceSpy = jasmine.createSpyObj('AuthService', ['checkAuth']);
    routerSpy = jasmine.createSpyObj('Router', ['createUrlTree']);

    TestBed.configureTestingModule({
      providers: [
        AuthGuard,
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });

    guard = TestBed.inject(AuthGuard);
  });

  it('should allow route activation if user is authenticated', (done) => {
    authServiceSpy.checkAuth.and.returnValue(of({ isAuthenticated: true }));

    guard.canActivate().subscribe((result) => {
      expect(result).toBeTrue();
      done();
    });
  });

  it('should redirect to /Login if user is not authenticated', (done) => {
    const fakeTree = {} as UrlTree;
    authServiceSpy.checkAuth.and.returnValue(of({ isAuthenticated: false }));
    routerSpy.createUrlTree.and.returnValue(fakeTree);

    guard.canActivate().subscribe((result) => {
      expect(result).toBe(fakeTree);
      expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/Login']);
      done();
    });
  });

  it('should handle error and redirect to /Login', (done) => {
    const fakeTree = {} as UrlTree;
    authServiceSpy.checkAuth.and.returnValue(throwError(() => new Error('Auth check failed')));
    routerSpy.createUrlTree.and.returnValue(fakeTree);

    guard.canActivate().subscribe((result) => {
      expect(result).toBe(fakeTree);
      expect(routerSpy.createUrlTree).toHaveBeenCalledWith(['/Login']);
      done();
    });
  });
});