import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavefileadminComponent } from './savefileadmin.component';

describe('SavefileadminComponent', () => {
  let component: SavefileadminComponent;
  let fixture: ComponentFixture<SavefileadminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavefileadminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SavefileadminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
