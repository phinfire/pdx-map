import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParadoxComponent } from './paradox.component';
import { provideRouter } from '@angular/router';

describe('ParadoxComponent', () => {
  let component: ParadoxComponent;
  let fixture: ComponentFixture<ParadoxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParadoxComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParadoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
