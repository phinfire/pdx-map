import { Component } from '@angular/core';
import { McadminStartassignmentsComponent } from '../mcadmin-startassignments/mcadmin-startassignments.component';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MCAdminCampaigneditorComponent } from '../mcadmin-campaigneditor/mcadmin-campaigneditor.component';

@Component({
    selector: 'app-mcadmin',
    imports: [McadminStartassignmentsComponent, MatExpansionModule, MatIconModule, MCAdminCampaigneditorComponent],
    templateUrl: './mcadmin.component.html',
    styleUrl: './mcadmin.component.scss'
})
export class MCAdminComponent {

}