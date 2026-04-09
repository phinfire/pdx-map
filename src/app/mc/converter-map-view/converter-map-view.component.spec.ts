import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConverterMapViewComponent } from './converter-map-view.component';

describe('ConverterMapViewComponent', () => {
  let component: ConverterMapViewComponent;
  let fixture: ComponentFixture<ConverterMapViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConverterMapViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConverterMapViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
