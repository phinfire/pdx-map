import { TestBed } from '@angular/core/testing';

import { SaveDatabaseService } from './savedatabase.service';

describe('SavedatabaseService', () => {
  let service: SaveDatabaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SaveDatabaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
