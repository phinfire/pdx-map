import { ComponentFixture, TestBed } from '@angular/core/testing';

import { McstartselectComponent } from './mcstartselect.component';

describe('McstartselectComponent', () => {
  let component: McstartselectComponent;
  let fixture: ComponentFixture<McstartselectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [McstartselectComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(McstartselectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
