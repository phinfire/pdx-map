import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LineviewerComponent } from './lineviewer.component';

describe('LineviewerComponent', () => {
  let component: LineviewerComponent;
  let fixture: ComponentFixture<LineviewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineviewerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LineviewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
