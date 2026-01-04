import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GambaComponent } from './gamba.component';

describe('GambaComponent', () => {
  let component: GambaComponent;
  let fixture: ComponentFixture<GambaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GambaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GambaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
