import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { McadminStartassignmentsComponent } from '../mcadmin-startassignments/mcadmin-startassignments.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MCAdminCampaigneditorComponent } from '../mcadmin-campaigneditor/mcadmin-campaigneditor.component';
import { MegaBrowserSessionService } from '../../../../services/megacampaign/mega-browser-session.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-mcadmin',
    imports: [McadminStartassignmentsComponent, MatExpansionModule, MatIconModule, MCAdminCampaigneditorComponent],
    templateUrl: './mcadmin.component.html',
    styleUrl: './mcadmin.component.scss'
})
export class MCAdminComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private sessionService = inject(MegaBrowserSessionService);
    private destroy$ = new Subject<void>();

    ngOnInit() {
        const campaignId = this.route.snapshot.params['campaignId'];
        if (campaignId) {
            this.sessionService.selectCampaignById(campaignId).pipe(
                takeUntil(this.destroy$)
            ).subscribe();
        }
    }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

}