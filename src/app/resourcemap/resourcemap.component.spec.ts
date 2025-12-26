import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResourcemapComponent } from './resourcemap.component';

describe('ResourcemapComponent', () => {
  let component: ResourcemapComponent;
  let fixture: ComponentFixture<ResourcemapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResourcemapComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResourcemapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
