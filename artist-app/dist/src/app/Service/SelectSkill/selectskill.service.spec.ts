import { TestBed } from '@angular/core/testing';

import { SelectskillService } from './selectskill.service';

describe('SelectskillService', () => {
  let service: SelectskillService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SelectskillService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
