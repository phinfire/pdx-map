import { Component, inject } from '@angular/core';
import { MegaService } from '../MegaService';
import { MegaCampaign } from '../MegaCampaign';
import { MCSignupComponent } from '../mcsignup/mcsignup.component';
import { McstartselectComponent } from '../mcstartselect/mcstartselect.component';
import { DiscordLoginComponent } from '../../discord-login/discord-login.component';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { AssignmentService } from '../AssignmentService';
import { StartAssignment } from '../StartAssignment';
import { MatButtonModule } from '@angular/material/button';
import { TableColumn } from '../../../util/table/TableColumn';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { SimpleTableColumn } from '../../../util/table/SimpleTableColumn';
import { MatIconModule } from '@angular/material/icon';
import { PlotViewComponent } from '../../plot-view/plot-view.component';
import { MegaPlotService } from '../MegaPlotService';
import { Plotable } from '../../plot-view/plot/Plotable';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { combineLatest } from 'rxjs';
import { CustomRulerFile } from '../../../services/gamedata/CustomRulerFile';
import { DiscordUser } from '../../../model/social/DiscordUser';
import { Title } from '@angular/platform-browser';

import JSZip from 'jszip';
import { MatTooltipModule } from '@angular/material/tooltip';

enum VIEW {
    ASSIGNMENT_TABLE,
    SIGNUP,
    START_SELECTION,
    PLOT_VIEW
}

@Component({
    selector: 'app-mega-campaign',
    imports: [MCSignupComponent, McstartselectComponent, DiscordLoginComponent, MatButtonModule, TableComponent, DiscordLoginComponent, MatIconModule, MatTooltipModule, PlotViewComponent],
    templateUrl: './mega-campaign.component.html',
    styleUrl: './mega-campaign.component.scss'
})

export class MegaCampaignComponent {
    public VIEW = VIEW;

    titleService = inject(Title);
    megaService = inject(MegaService);
    assignmentService = inject(AssignmentService);
    authService = inject(DiscordAuthenticationService);
    megaPlotService = inject(MegaPlotService);
    ck3Service = inject(CK3Service);

    campaign: MegaCampaign | null = null;
    userAssignment: StartAssignment | null = null;
    assignments: StartAssignment[] = [];
    traitPlotables: Plotable[] = [];

    user2Ruler: Map<DiscordUser, CustomRulerFile> = new Map();
    currentView: VIEW = VIEW.ASSIGNMENT_TABLE;


    goBackToPlayerList = () => this.setView(VIEW.ASSIGNMENT_TABLE);
    goToStartSelection = () => this.setView(VIEW.START_SELECTION);
    goToTraitHistogram = () => this.setView(VIEW.PLOT_VIEW);
    goToSignup = () => this.setView(VIEW.SIGNUP);

    setView(view: VIEW) {
        this.currentView = view;
    }

    ngOnInit() {
        this.titleService.setTitle('Mega Campaign');
        this.megaService.getAvailableCampaigns$().subscribe(campaigns => {
            this.campaign = campaigns[0];
        });
        this.assignmentService.allAssignments$.subscribe(assignments => {
            this.assignments = assignments.sort((a, b) => a.region_key < b.region_key ? -1 : (a.region_key > b.region_key ? 1 : 0));
            if (assignments != null) {
                const loggedInUser = this.authService.getLoggedInUser();
                this.userAssignment = loggedInUser ? assignments.find(a => a.user.id === loggedInUser.id) || null : null;
            }
        });
        combineLatest([this.assignmentService.allAssignments$, this.ck3Service.initializeCK3()]).subscribe(([assignments, ck3]) => {
            if (assignments != null && ck3 != null) {
                this.megaPlotService.generatePlotData(ck3, assignments).then((traitPlotables) => {
                    this.traitPlotables = traitPlotables;
                });
                this.user2Ruler.clear();
                assignments.forEach(async a => {
                    if (a.start_data && a.start_key) {
                        const rulerData = (a.start_data as { ruler: string }).ruler;
                        const fileService = this.megaPlotService.fileService;
                        const ck3Service = this.megaPlotService.ck3Service;
                        const json = await fileService.parseContentToJsonPromise(rulerData);
                        const ruler = ck3Service.parseCustomCharacter(json, ck3);
                        if (ruler) {
                            this.user2Ruler.set(a.user, ruler);
                            const message = this.megaService.getIllegalityReport(ruler);
                            if (message.length > 0) {
                                console.log(`Illegality report for ${a.user.getName()}: ${message}`);
                            }
                        }
                    }
                });
            }
        });
    }

    getFirstHalfLength(): number {
        return Math.ceil(this.assignments.length / 2);
    }

    getAssignments(col: number): StartAssignment[] {
        return this.assignments.slice(col * this.getFirstHalfLength(), (col + 1) * this.getFirstHalfLength());
    }

    getColumns(col: number): TableColumn<StartAssignment>[] {
        return [
            TableColumn.getIndexColumn<StartAssignment>(col == 0 ? 0 : this.getFirstHalfLength()),
            new SimpleTableColumn<StartAssignment>('img', '', a => a.user.getAvatarImageUrl(), null, true),
            new SimpleTableColumn<StartAssignment>('name', 'Player', a => a.user.getName()),
            new SimpleTableColumn<StartAssignment>('region', 'Region', a => a.region_key),
            new SimpleTableColumn<StartAssignment>('hasselectedstart', 'OK',
                (a: StartAssignment) => {
                    if (!a.start_key || !a.start_data) {
                        return '';
                    }
                    const ruler = this.user2Ruler.get(a.user);
                    if (!ruler) {
                        return '';
                    }
                    const illegalityReport = this.megaService.getIllegalityReport(ruler);
                    if (illegalityReport.length === 0) {
                        return '✅';
                    } else {
                        return '❌';
                    }
                }
            )
        ];
    }

    isInRegionSignupStage() {
        return this.campaign ? this.campaign.isInRegionSignupStage() : false;
    }

    isInStartSelectionStage() {
        return this.campaign ? this.campaign.isInStartSelectionStage() : false;
    }

    isInWaitingForFirstSessionStage() {
        return this.campaign ? this.campaign.isInWaitingForFirstSessionStage() : false;
    }

    isPlayingCk3() {
        return this.campaign ? this.campaign.isPlayingCk3() : false;
    }

    async downloadAllRulersAsZip() {
        const zip = new JSZip();
        for (const assignment of this.assignments) {
            if (assignment.start_data && (assignment.start_data as any).ruler) {
                const rulerData = (assignment.start_data as { ruler: string }).ruler;
                const userName = assignment.user.getName().replace(/[^a-zA-Z0-9_-]/g, '_');
                const fileName = assignment.start_key + "_" + `${userName || assignment.user.id}.ck3ruler`;
                zip.file(fileName, rulerData);
            }
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = "rulers" + new Date().toISOString() + ".zip";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }
}
