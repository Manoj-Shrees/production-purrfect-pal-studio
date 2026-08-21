import { TestBed } from '@angular/core/testing';

import { OrderTrackingService } from './order-tracking.service';

describe('OrderTrackingService', () => {
  let service: OrderTrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OrderTrackingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
