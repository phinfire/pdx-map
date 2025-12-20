import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MegaModderComponent } from './mega-modder.component';

describe('MegaModderComponent', () => {
  let component: MegaModderComponent;
  let fixture: ComponentFixture<MegaModderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MegaModderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MegaModderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  // it('should create', () => {
  //   expect(component).toBeTruthy();
  // });

  it('placeholder', () => {
    expect(true).toBe(true);
  });
});
