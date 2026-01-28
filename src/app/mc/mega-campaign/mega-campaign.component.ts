import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Title } from '@angular/platform-browser';
import { combineLatest } from 'rxjs';
import { DiscordUser } from '../../../model/social/DiscordUser';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { CustomRulerFile } from '../../../services/gamedata/CustomRulerFile';
import { TableColumn } from '../../../util/table/TableColumn';
import { PlotViewComponent } from '../../plot-view/plot-view.component';
import { Plotable } from '../../plot-view/Plotable';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { AssignmentService } from '../AssignmentService';
import { MCSignupComponent } from '../mcsignup/mcsignup.component';
import { McstartselectComponent } from '../mcstartselect/mcstartselect.component';
import { MegaCampaign } from '../MegaCampaign';
import { MegaPlotService } from '../MegaPlotService';
import { MegaService } from '../MegaService';
import { StartAssignment } from '../StartAssignment';

import { MatTooltipModule } from '@angular/material/tooltip';
import JSZip from 'jszip';
import { TableColumnBuilder } from '../../../util/table/TableColumnBuilder';

enum VIEW {
    ASSIGNMENT_TABLE,
    SIGNUP,
    START_SELECTION,
    PLOT_VIEW
}

@Component({
    selector: 'app-mega-campaign',
    imports: [MCSignupComponent, McstartselectComponent, MatButtonModule, TableComponent, MatIconModule, MatTooltipModule, PlotViewComponent],
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
    destroyRef = inject(DestroyRef);

    campaign: MegaCampaign | null = null;
    userAssignment: StartAssignment | null = null;
    assignments: StartAssignment[] = [];
    traitPlotables: Plotable[] = [];

    user2Ruler: Map<DiscordUser, CustomRulerFile> = new Map();
    currentView: VIEW = VIEW.ASSIGNMENT_TABLE;

    private cachedColumns: Map<number, TableColumn<StartAssignment>[]> = new Map();


    goBackToPlayerList = () => this.setView(VIEW.ASSIGNMENT_TABLE);
    goToStartSelection = () => this.setView(VIEW.START_SELECTION);
    goToTraitHistogram = () => this.setView(VIEW.PLOT_VIEW);
    goToSignup = () => this.setView(VIEW.SIGNUP);

    setView(view: VIEW) {
        this.currentView = view;
    }

    ngOnInit() {
        this.titleService.setTitle('Mega Campaign');
        this.megaService.getAvailableCampaigns$()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(campaigns => {
                this.campaign = campaigns[0];
            });
        combineLatest([this.assignmentService.allAssignments$, this.ck3Service.initializeCK3()])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([assignments, ck3]) => {
                if (assignments != null) {
                    this.assignments = assignments.sort((a, b) => a.region_key < b.region_key ? -1 : (a.region_key > b.region_key ? 1 : 0));
                    this.cachedColumns.clear();
                    const loggedInUser = this.authService.getLoggedInUser();
                    this.userAssignment = loggedInUser ? assignments.find(a => a.user.id === loggedInUser.id) || null : null;
                }
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
        if (this.cachedColumns.has(col)) {
            return this.cachedColumns.get(col)!;
        }

        const offset = col == 0 ? 0 : this.getFirstHalfLength();
        const columns = [
            new TableColumnBuilder<StartAssignment>('Index')
                .withCellValue((a, index) => offset + index + 1)
                .isSortable(false)
                .build(),
            new TableColumnBuilder<StartAssignment>('')
                .withCellValue(a => a.user.getAvatarImageUrl())
                .showCellAsImage()
                .isSortable(false)
                .build(),
            new TableColumnBuilder<StartAssignment>('Player')
                .withCellValue(a => a.user.getName())
                .isSortable(false)
                .build(),
            new TableColumnBuilder<StartAssignment>('Region')
                .isSortable(false)
                .withCellValue(a => a.region_key)
                .build(),
            new TableColumnBuilder<StartAssignment>('OK')
                .isSortable(false)
                .withCellValue((a: StartAssignment) => {
                    if (!a.start_key || !a.start_data) {
                        return '';
                    }
                    const ruler = this.user2Ruler.get(a.user);
                    if (!ruler) {
                        return '';
                    }
                    const illegalityReport = this.megaService.getIllegalityReport(ruler);
                    return illegalityReport.length === 0 ? '✅' : '❌';
                })
                .isSortable(false)
                .build()
        ];

        this.cachedColumns.set(col, columns);
        return columns;
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
