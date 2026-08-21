import { TestBed } from '@angular/core/testing';

import { RouteAccessService } from './route-access-service.service';

describe('RouteAccessServiceService', () => {
  let service: RouteAccessService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RouteAccessService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
