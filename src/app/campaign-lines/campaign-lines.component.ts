import { Component, inject } from '@angular/core';
import { LineviewerComponent } from '../lineviewer/lineviewer.component';
import { Eu4SaveSeriesData } from '../lineviewer/model/Eu4SaveSeriesData';
import { MegaCampaignService } from '../mc/MegaCampaignService';
import { MegaService } from '../mc/MegaService';

@Component({
    selector: 'app-campaign-lines',
    imports: [LineviewerComponent],
    templateUrl: './campaign-lines.component.html',
    styleUrl: './campaign-lines.component.scss',
    providers: [Eu4SaveSeriesData],
})
export class CampaignLinesComponent {
    
    protected seriesData = inject(Eu4SaveSeriesData);
    private megaService = inject(MegaCampaignService);
    private legacyMegaService = inject(MegaService);

    ngOnInit() {
        
    }
}