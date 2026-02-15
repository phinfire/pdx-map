import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { tap } from 'rxjs';
import { MegaService } from '../../MegaService';
import { AsyncPipe } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MegaCampaign } from '../../MegaCampaign';
import { DateTimePickerComponent } from '../../../date-time-picker/date-time-picker.component';

@Component({
    selector: 'app-mcadmin-campaigneditor',
    imports: [
        AsyncPipe, FormsModule, RouterModule, MatListModule, MatIconModule, MatTooltipModule, MatButtonModule, MatDatepickerModule, MatTimepickerModule, MatNativeDateModule, MatInputModule, MatFormFieldModule, DateTimePickerComponent,
    ],
    templateUrl: './mcadmin-campaigneditor.component.html',
    styleUrl: './mcadmin-campaigneditor.component.scss',
})
export class MCAdminCampaigneditorComponent {
    private megaService = inject(MegaService);

    campaigns$ = this.megaService.getAvailableCampaigns$().pipe(
        tap(campaigns => {
            if (campaigns.length > 0 && !this.selectedCampaign) {
                this.selectCampaign(campaigns[campaigns.length - 1]);
            }
        })
    );
    selectedCampaign: MegaCampaign | null = null;
    editingCampaignData = {
        regionDeadline: new Date(),
        startDeadline: new Date(),
        firstSession: new Date(),
        ck3MapGeoJsonUrl: '',
        nationsJsonUrl: '',
        ck3RegionsConfigUrl: ''
    };

    createNewCampaign(): void {
        const now = new Date();
        const regionDeadline = new Date(now.getTime());
        const startDeadline = new Date(now.getTime());
        const firstSession = new Date(now.getTime());

        this.megaService.createCampaign$(`Example Campaign ${Date.now()}`).subscribe({
            next: (result) => {
                if (result && result.id) {
                    const updatePayload = {
                        signupsOpen: false,
                        signupDeadlineDate: regionDeadline.toISOString(),
                        pickDeadline: startDeadline.toISOString(),
                        firstSessionDate: firstSession.toISOString()
                    };
                    this.megaService.updateCampaign$(result.id, updatePayload).subscribe({
                        next: () => {
                            this.campaigns$ = this.megaService.getAvailableCampaigns$();
                        },
                        error: () => {
                            this.campaigns$ = this.megaService.getAvailableCampaigns$();
                        }
                    });
                } else {
                    this.campaigns$ = this.megaService.getAvailableCampaigns$();
                }
            },
            error: () => { }
        });
    }

    selectCampaign(campaign: MegaCampaign): void {
        this.selectedCampaign = campaign;
        this.editingCampaignData = {
            regionDeadline: new Date(campaign.getRegionDeadlineDate()),
            startDeadline: new Date(campaign.getStartDeadlineDate()),
            firstSession: new Date(campaign.getFirstSessionDate()),
            ck3MapGeoJsonUrl: campaign.getCk3MapGeoJsonUrl() || '',
            nationsJsonUrl: campaign.getNationsJsonUrl() || '',
            ck3RegionsConfigUrl: campaign.getCk3RegionsConfigUrl() || ''
        };
    }

    renameCampaign(campaign: MegaCampaign): void {
        const campaignId = campaign.getId();
        if (!campaignId) {
            return;
        }
        const newName = prompt(`Rename campaign "${campaign.getName()}" to:`, campaign.getName());
        if (newName && newName.trim() && newName !== campaign.getName()) {
            this.megaService.updateCampaign$(campaignId, { name: newName.trim() }).subscribe({
                next: () => {
                    this.campaigns$ = this.megaService.getAvailableCampaigns$().pipe(
                        tap(campaigns => {
                            const updatedCampaign = campaigns.find(c => c.getId() === campaignId);
                            if (updatedCampaign) {
                                this.selectedCampaign = updatedCampaign;
                            }
                        })
                    );
                }
            });
        }
    }

    deleteCampaign(campaign: MegaCampaign): void {
        const campaignId = campaign.getId();
        if (!campaignId) {
            return;
        }

        if (confirm(`Delete campaign "${campaign.getName()}"?`)) {
            this.megaService.deleteCampaign$(campaignId).subscribe({
                next: () => {
                    if (this.selectedCampaign === campaign) {
                        this.selectedCampaign = null;
                    }
                    this.campaigns$ = this.megaService.getAvailableCampaigns$();
                }
            });
        }
    }

    updateCampaignDates(): void {
        if (!this.selectedCampaign || !this.selectedCampaign.getId()) {
            return;
        }

        const campaignId = this.selectedCampaign.getId()!;
        const updatePayload = {
            signupDeadlineDate: this.editingCampaignData.regionDeadline,
            pickDeadline: this.editingCampaignData.startDeadline,
            firstSessionDate: this.editingCampaignData.firstSession
        };

        this.megaService.updateCampaignDates$(campaignId, updatePayload).subscribe({
            next: () => {
                this.campaigns$ = this.megaService.getAvailableCampaigns$().pipe(
                    tap(campaigns => {
                        const updatedCampaign = campaigns.find(c => c.getId() === campaignId);
                        if (updatedCampaign) {
                            this.selectedCampaign = updatedCampaign;
                        }
                    })
                );
            }
        });
    }

    updateCampaignUrls(): void {
        if (!this.selectedCampaign || !this.selectedCampaign.getId()) {
            return;
        }

        const campaignId = this.selectedCampaign.getId()!;
        const updatePayload: any = {};
        
        if (this.editingCampaignData.ck3MapGeoJsonUrl) {
            updatePayload.ck3MapGeoJsonUrl = this.editingCampaignData.ck3MapGeoJsonUrl;
        }
        if (this.editingCampaignData.nationsJsonUrl) {
            updatePayload.nationsJsonUrl = this.editingCampaignData.nationsJsonUrl;
        }
        if (this.editingCampaignData.ck3RegionsConfigUrl) {
            updatePayload.ck3RegionsConfigUrl = this.editingCampaignData.ck3RegionsConfigUrl;
        }

        if (Object.keys(updatePayload).length === 0) {
            return;
        }

        this.megaService.updateCampaign$(campaignId, updatePayload).subscribe({
            next: () => {
                this.campaigns$ = this.megaService.getAvailableCampaigns$().pipe(
                    tap(campaigns => {
                        const updatedCampaign = campaigns.find(c => c.getId() === campaignId);
                        if (updatedCampaign) {
                            this.selectedCampaign = updatedCampaign;
                        }
                    })
                );
            }
        });
    }

    deleteSelectedCampaign(): void {
        if (this.selectedCampaign && confirm(`Delete campaign "${this.selectedCampaign.getName()}"?`)) {
            const campaignId = this.selectedCampaign.getId();
            if (!campaignId) {
                return;
            }
            this.megaService.deleteCampaign$(campaignId).subscribe({
                next: () => {
                    this.selectedCampaign = null;
                    this.campaigns$ = this.megaService.getAvailableCampaigns$();
                }
            });
        }
    }

    onDateTimeChange(): void {
        if (this.selectedCampaign) {
            this.updateCampaignDates();
        }
    }

    onUrlChange(): void {
        if (this.selectedCampaign) {
            this.updateCampaignUrls();
        }
    }
}