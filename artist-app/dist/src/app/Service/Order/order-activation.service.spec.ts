import { TestBed } from '@angular/core/testing';

import { OrderActivationService } from './order-activation.service';

describe('OrderActivationService', () => {
  let service: OrderActivationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderActivationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
