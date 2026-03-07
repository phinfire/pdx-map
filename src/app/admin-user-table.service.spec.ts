import { TestBed } from '@angular/core/testing';

import { AdminUserTableService } from './admin-user-table.service';

describe('AdminUserTableService', () => {
  let service: AdminUserTableService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdminUserTableService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
