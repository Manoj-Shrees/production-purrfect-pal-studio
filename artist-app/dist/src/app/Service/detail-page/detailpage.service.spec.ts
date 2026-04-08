import { TestBed } from '@angular/core/testing';

import { DetailpageService } from './detailpage.service';

describe('DetailpageService', () => {
  let service: DetailpageService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DetailpageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
