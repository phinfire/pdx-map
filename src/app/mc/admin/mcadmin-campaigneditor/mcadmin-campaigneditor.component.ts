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
    editingDates = {
        regionDeadline: new Date(),
        startDeadline: new Date(),
        firstSession: new Date()
    };

    addExampleCampaign(): void {
        const now = new Date();
        const regionDeadline = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const startDeadline = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
        const firstSession = new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000);

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
        this.editingDates = {
            regionDeadline: new Date(campaign.getRegionDeadlineDate()),
            startDeadline: new Date(campaign.getStartDeadlineDate()),
            firstSession: new Date(campaign.getFirstSessionDate())
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
            signupDeadlineDate: this.editingDates.regionDeadline,
            pickDeadline: this.editingDates.startDeadline,
            firstSessionDate: this.editingDates.firstSession
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

    hasUnsavedChanges(): boolean {
        return this.selectedCampaign != null && (
            this.selectedCampaign.getRegionDeadlineDate().getTime() !== this.editingDates.regionDeadline.getTime() ||
            this.selectedCampaign.getStartDeadlineDate().getTime() !== this.editingDates.startDeadline.getTime() ||
            this.selectedCampaign.getFirstSessionDate().getTime() !== this.editingDates.firstSession.getTime()
        );
    }

    deleteSelectedCampaign(): void {
        if (!this.selectedCampaign) {
            return;
        }
        if (confirm(`Delete campaign "${this.selectedCampaign.getName()}"?`)) {
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

    resetEditors(): void {
        if (this.selectedCampaign) {
            this.selectCampaign(this.selectedCampaign);
        }
    }

    onDateTimeChange(): void {
        console.log("Editing dates changed:" + [
            this.editingDates.regionDeadline.toISOString(),
            this.editingDates.startDeadline.toISOString(),
            this.editingDates.firstSession.toISOString()
        ].join('\n'));
    }
}