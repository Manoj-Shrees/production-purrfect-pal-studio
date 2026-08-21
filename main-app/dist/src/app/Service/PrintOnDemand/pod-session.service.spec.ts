import { TestBed } from '@angular/core/testing';

import { PodSessionService } from './pod-session.service';

describe('PodSessionService', () => {
  let service: PodSessionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PodSessionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
