import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaveViewSplashComponent } from './save-view-splash.component';

describe('SaveViewSplashComponent', () => {
  let component: SaveViewSplashComponent;
  let fixture: ComponentFixture<SaveViewSplashComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaveViewSplashComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaveViewSplashComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
