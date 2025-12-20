import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TableComponent } from './vic3-country-table.component';

type TestData = any;

describe('Vic3CountryTableComponent', () => {
  let component: TableComponent<TestData>;
  let fixture: ComponentFixture<TableComponent<TestData>>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
