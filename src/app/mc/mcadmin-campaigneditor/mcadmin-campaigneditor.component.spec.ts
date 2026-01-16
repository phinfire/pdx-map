import { ComponentFixture, TestBed } from '@angular/core/testing';

import { McadminCampaigneditorComponent } from './mcadmin-campaigneditor.component';

describe('McadminCampaigneditorComponent', () => {
  let component: McadminCampaigneditorComponent;
  let fixture: ComponentFixture<McadminCampaigneditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [McadminCampaigneditorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(McadminCampaigneditorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
