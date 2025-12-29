import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlliancehelperComponent } from './alliancehelper.component';

describe('AlliancehelperComponent', () => {
  let component: AlliancehelperComponent;
  let fixture: ComponentFixture<AlliancehelperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlliancehelperComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlliancehelperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
