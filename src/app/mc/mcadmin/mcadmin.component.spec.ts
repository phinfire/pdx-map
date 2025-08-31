import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MCAdminComponent } from './mcadmin.component';

describe('MCAdminComponent', () => {
  let component: MCAdminComponent;
  let fixture: ComponentFixture<MCAdminComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MCAdminComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MCAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
