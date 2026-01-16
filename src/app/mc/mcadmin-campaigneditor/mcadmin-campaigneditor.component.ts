import { Component } from '@angular/core';

@Component({
    selector: 'app-mcadmin-campaigneditor',
    imports: [],
    templateUrl: './mcadmin-campaigneditor.component.html',
    styleUrl: './mcadmin-campaigneditor.component.scss',
})
export class McadminCampaigneditorComponent {

    getCk3Identifier() {
        return ["ck3"]
    }

    getEu4Identifier() {
        return ["eu4"]
    }

    getVic3SessionIdentifiers() {
        return ["vic3"]
    }
}
