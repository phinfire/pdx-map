import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaveViewComponent } from './save-view.component';

describe('SaveViewComponent', () => {
  let component: SaveViewComponent;
  let fixture: ComponentFixture<SaveViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaveViewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaveViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
