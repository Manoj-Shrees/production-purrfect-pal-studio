import { TestBed } from '@angular/core/testing';

import { SociallinkService } from './sociallink.service';

describe('SociallinkService', () => {
  let service: SociallinkService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SociallinkService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
