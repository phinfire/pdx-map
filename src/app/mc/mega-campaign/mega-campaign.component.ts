import { Component, inject } from '@angular/core';
import { MegaService } from '../MegaService';
import { MegaCampaign } from '../MegaCampaign';
import { MCSignupComponent } from '../mcsignup/mcsignup.component';
import { McstartselectComponent } from '../mcstartselect/mcstartselect.component';
import { DiscordLoginComponent } from '../../discord-login/discord-login.component';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { AssignmentService } from '../../../services/AssignmentService';
import { StartAssignment } from '../StartAssignment';

@Component({
    selector: 'app-mega-campaign',
    imports: [MCSignupComponent, McstartselectComponent, DiscordLoginComponent],
    templateUrl: './mega-campaign.component.html',
    styleUrl: './mega-campaign.component.scss'
})
export class MegaCampaignComponent {

    megaService = inject(MegaService);
    assignmentService = inject(AssignmentService);
    authService = inject(DiscordAuthenticationService);

    campaign: MegaCampaign | null = null;
    userAssignment: StartAssignment | null = null;

    ngOnInit() {
        this.megaService.getAvailableCampaigns$().subscribe(campaigns => {
            this.campaign = campaigns[0];
        });
        this.assignmentService.myAssignment$.subscribe(assignment => {
            if (assignment != null) {
                this.userAssignment = assignment;
            }
        });
    }

    isInRegionSignupStage() {
        return this.campaign ? new Date() <= this.campaign.getRegionDeadlineDate() : false;
    }

    isInStartSelectionStage() {
        return this.campaign ? new Date() > this.campaign.getRegionDeadlineDate() && new Date() <= this.campaign.getStartDeadlineDate() : false;
    }

    isInWaitingForFirstSessionStage() {
        return this.campaign ? new Date() > this.campaign.getStartDeadlineDate() && new Date() <= this.campaign.getFirstSessionDate() : false;
    }

    isPlayingCk3() {
        return this.campaign ? new Date() > this.campaign.getFirstSessionDate() : false;
    }
}
