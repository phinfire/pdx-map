import { Component, inject } from '@angular/core';
import { MegaService } from '../../MegaService';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
    selector: 'app-mcadmin-campaigneditor',
    imports: [AsyncPipe, DatePipe, MatListModule, MatIconModule, MatTooltipModule],
    templateUrl: './mcadmin-campaigneditor.component.html',
    styleUrl: './mcadmin-campaigneditor.component.scss',
})
export class MCAdminCampaigneditorComponent {
    private megaService = inject(MegaService);

    campaigns$ = this.megaService.getAvailableCampaigns$();
}