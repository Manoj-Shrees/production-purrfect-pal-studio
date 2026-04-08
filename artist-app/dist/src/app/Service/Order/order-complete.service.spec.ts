import { TestBed } from '@angular/core/testing';
import { OrderCompleteService } from './order-complete.service';
import { DatePipe } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('OrderCompleteService', () => {
  let service: OrderCompleteService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DatePipe]
    });
    service = TestBed.inject(OrderCompleteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
