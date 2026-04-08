import { TestBed } from '@angular/core/testing';

import { ProfilerefreshService } from './profilerefresh.service';

describe('ProfilerefreshService', () => {
  let service: ProfilerefreshService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProfilerefreshService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
