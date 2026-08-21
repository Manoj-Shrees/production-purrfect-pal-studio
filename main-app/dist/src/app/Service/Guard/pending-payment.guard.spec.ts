import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { CanComponentDeactivate, PendingPaymentGuard } from './pending-payment.guard';
import { of } from 'rxjs';

describe('PendingPaymentGuard', () => {
  let guard: PendingPaymentGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PendingPaymentGuard]
    });

    guard = TestBed.inject(PendingPaymentGuard);
  });

  it('should allow deactivation if component.canDeactivate returns true', () => {
    const mockComponent: CanComponentDeactivate = {
      canDeactivate: () => true
    };

    const result = guard.canDeactivate(mockComponent);
    expect(result).toBeTrue();
  });

  it('should allow deactivation if component.canDeactivate returns Observable<true>', (done) => {
    const mockComponent: CanComponentDeactivate = {
      canDeactivate: () => of(true)
    };

    const result = guard.canDeactivate(mockComponent);

    expect(result).toBeInstanceOf(Object); // an Observable

    (result as any).subscribe((res: boolean) => {
      expect(res).toBeTrue();
      done();
    });
  });

  it('should prevent deactivation if component.canDeactivate returns false', () => {
    const mockComponent: CanComponentDeactivate = {
      canDeactivate: () => false
    };

    const result = guard.canDeactivate(mockComponent);
    expect(result).toBeFalse();
  });

  it('should allow deactivation if component.canDeactivate is not defined', () => {
    const mockComponent: any = {}; // no canDeactivate method
    const result = guard.canDeactivate(mockComponent);
    expect(result).toBeTrue();
  });
});