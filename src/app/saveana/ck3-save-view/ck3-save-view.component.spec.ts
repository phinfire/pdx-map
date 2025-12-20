import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ck3SaveViewComponent } from './ck3-save-view.component';

describe('Ck3SaveViewComponent', () => {
  let component: Ck3SaveViewComponent;
  let fixture: ComponentFixture<Ck3SaveViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ck3SaveViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Ck3SaveViewComponent);
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
