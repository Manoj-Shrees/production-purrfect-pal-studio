import { TestBed } from '@angular/core/testing';

import { MyCartService } from './my-cart.service';

describe('MyCartService', () => {
  let service: MyCartService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MyCartService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
