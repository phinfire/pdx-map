import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JominiKioskComponent } from './jomini-kiosk.component';

describe('JominiKioskComponent', () => {
  let component: JominiKioskComponent;
  let fixture: ComponentFixture<JominiKioskComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JominiKioskComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JominiKioskComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
