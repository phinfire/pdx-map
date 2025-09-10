import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MegaCampaignComponent } from './mega-campaign.component';

describe('MegaCampaignComponent', () => {
  let component: MegaCampaignComponent;
  let fixture: ComponentFixture<MegaCampaignComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MegaCampaignComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MegaCampaignComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
