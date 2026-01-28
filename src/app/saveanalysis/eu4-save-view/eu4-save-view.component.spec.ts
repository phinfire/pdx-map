import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Eu4SaveViewComponent } from './eu4-save-view.component';

describe('Eu4SaveViewComponent', () => {
  let component: Eu4SaveViewComponent;
  let fixture: ComponentFixture<Eu4SaveViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Eu4SaveViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Eu4SaveViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
