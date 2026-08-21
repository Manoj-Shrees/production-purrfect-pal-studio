import { TestBed } from '@angular/core/testing';

import { PODService } from './pod.service';

describe('PODService', () => {
  let service: PODService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PODService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
