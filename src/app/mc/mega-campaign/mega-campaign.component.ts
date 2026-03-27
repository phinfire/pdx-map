import { AsyncPipe } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import JSZip from 'jszip';
import { BehaviorSubject, combineLatest } from 'rxjs';
import { CustomRulerFile } from '../../../model/megacampaign/CustomRulerFile';
import { DiscordUser } from '../../../model/social/DiscordUser';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { MegaBrowserSessionService } from '../../../services/megacampaign/mega-browser-session.service';
import { MegaUtilService } from '../../../services/megacampaign/mega-util.service';
import { MegaService } from '../../../services/megacampaign/MegaService';
import { TableColumn } from '../../../util/table/TableColumn';
import { TableColumnBuilder } from '../../../util/table/TableColumnBuilder';
import { LineviewerComponent } from '../../lineviewer/lineviewer.component';
import { LineViewerData } from '../../lineviewer/model/LineViewerData';
import { Vic3SaveSeriesData } from '../../lineviewer/model/Vic3SaveSeriesData';
import { PlotViewComponent } from '../../plot-view/plot-view.component';
import { Plotable } from '../../../model/Plotable';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { AssignmentService } from '../../../services/megacampaign/AssignmentService';
import { MegaCampaign } from '../MegaCampaign';
import { MegaPlotService } from '../../../services/plotting/MegaPlotService';
import { StartAssignment } from '../StartAssignment';
import { PdxFileService } from '../../../services/pdx-file.service';
import { PlottingService } from '../../../services/plotting/PlottingService';
import { SaveSaverService } from '../../../services/save-saver.service';

@Component({
    selector: 'app-mega-campaign',
    imports: [MatButtonModule, AsyncPipe, TableComponent, MatIconModule, MatTooltipModule, PlotViewComponent, MatDividerModule, LineviewerComponent],
    templateUrl: './mega-campaign.component.html',
    styleUrl: './mega-campaign.component.scss'
})

export class MegaCampaignComponent implements AfterViewInit {

    titleService = inject(Title);
    router = inject(Router);
    megaService = inject(MegaService);
    megaSessionService = inject(MegaBrowserSessionService);
    assignmentService = inject(AssignmentService);
    authService = inject(DiscordAuthenticationService);
    megaPlotService = inject(MegaPlotService);
    fileService = inject(PdxFileService);
    ck3Service = inject(CK3Service);
    destroyRef = inject(DestroyRef);
    saveSaver = inject(SaveSaverService);
    megaUtils = inject(MegaUtilService);
    activatedRoute = inject(ActivatedRoute);
    plottingService = inject(PlottingService);
    campaign: MegaCampaign | null = null;
    userAssignment: StartAssignment | null = null;
    assignments: StartAssignment[] = [];
    traitPlotables: Plotable[] = [];
    canNavigatePrevious$ = new BehaviorSubject<boolean>(false);
    canNavigateNext$ = new BehaviorSubject<boolean>(false);

    user2Ruler: Map<DiscordUser, CustomRulerFile> = new Map();
    seriesData: LineViewerData<Date> | null = null;

    private cachedColumns: Map<number, TableColumn<StartAssignment>[]> = new Map();

    goToSignup = () => this.router.navigate(['/mc/signup']);
    goToStartSelection = () => this.router.navigate(['/mc/start-selection', this.campaign?.getId()]);

    private updateNavigationStates(campaign: MegaCampaign) {
        this.megaSessionService.canNavigate(campaign, -1)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(canGoPrevious => this.canNavigatePrevious$.next(canGoPrevious));

        this.megaSessionService.canNavigate(campaign, 1)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(canGoNext => this.canNavigateNext$.next(canGoNext));
    }

    navigatePrevious() {
        if (this.campaign) {
            this.megaSessionService.selectPreviousCampaign()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(prev => {
                    if (prev) {
                        this.router.navigate(['/mc', prev.getId()]);
                    }
                });
        }
    }

    navigateNext() {
        if (this.campaign) {
            this.megaSessionService.selectNextCampaign()
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(next => {
                    if (next) {
                        this.router.navigate(['/mc', next.getId()]);
                    }
                });
        }
    }

    private loadCampaign(campaignId: string | null) {
        this.seriesData = null;
        this.megaSessionService.selectCampaignById(campaignId).subscribe(campaign => {
            if (campaign) {
                this.campaign = campaign;
                this.updateNavigationStates(campaign);
                if (campaign.getVic3LobbyIdentifiers().length > 0) {
                    const numberOfSessions = campaign.getVic3LobbyIdentifiers().length;
                    this.saveSaver.getSaveFileByIdentifier$(this.campaign.getVic3LobbyIdentifiers()[numberOfSessions - 1]).subscribe(save => {
                        this.seriesData = Vic3SaveSeriesData.fromSaves([save]);
                    });
                }
            }
        });
    }

    ngOnInit() {
        this.titleService.setTitle('Mega Campaign');
        this.activatedRoute.paramMap
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(params => {
                const campaignId = params.get('campaignId');
                this.loadCampaign(campaignId);
            });

        combineLatest([this.assignmentService.allAssignments$, this.ck3Service.initializeCK3(), this.authService.loggedInUser$])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([assignments, ck3, loggedInUser]) => {
                if (assignments != null) {
                    this.assignments = assignments.sort((a, b) => a.regionKey < b.regionKey ? -1 : (a.regionKey > b.regionKey ? 1 : 0));
                    this.cachedColumns.clear();
                    this.userAssignment = loggedInUser ? assignments.find(a => a.user.id === loggedInUser.id) || null : null;
                    if (ck3 != null) {
                        this.user2Ruler.clear();
                        const rulerPromises = assignments.map(async a => {
                            if (a.startData && a.startKey) {
                                const rulerData = a.startData as string;
                                const json = await this.fileService.parseContentToJsonPromise(rulerData);
                                const ruler = this.ck3Service.parseCustomCharacter(json, ck3);
                                if (ruler) {
                                    this.user2Ruler.set(a.user, ruler);
                                    const message = this.megaUtils.getIllegalityReport(ruler);
                                    if (message.length > 0) {
                                        console.log(`Illegality report for ${a.user.getName()}: ${message}`);
                                    }
                                }
                            }
                        });
                        Promise.all(rulerPromises).then(() => {
                            this.megaPlotService.generatePlotData(Array.from(this.user2Ruler.values())).then((traitPlotables) => {
                                this.traitPlotables = traitPlotables;
                            });
                        });
                    }
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
            TableColumnBuilder.getIndexColumn(offset),
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
                .withCellValue(a => a.regionKey)
                .build(),
            new TableColumnBuilder<StartAssignment>('OK')
                .isSortable(false)
                .withCellValue((a: StartAssignment) => {
                    if (!a.startKey || !a.startData) {
                        return '';
                    }
                    const ruler = this.user2Ruler.get(a.user);
                    if (!ruler) {
                        return '';
                    }
                    const illegalityReport = this.megaUtils.getIllegalityReport(ruler);
                    return illegalityReport.length === 0 ? '✅' : '❌';
                })
                .isSortable(false)
                .withTooltip("Whether this user has uploaded a permitted ruler")
                .withCellTooltip((a: StartAssignment) => {
                    const ruler = this.user2Ruler.get(a.user);
                    if (!ruler) {
                        return '';
                    }
                    const illegalityReport = this.megaUtils.getIllegalityReport(ruler);
                    return illegalityReport.length === 0 ? null : illegalityReport;
                })
                .build()
        ];
        this.cachedColumns.set(col, columns);
        return columns;
    }

    ngAfterViewInit() {

    }

    async downloadAllRulersAsZip() {
        const zip = new JSZip();
        for (const assignment of this.assignments) {
            if (assignment.startData && assignment.startKey) {
                const rulerData = assignment.startData as string;
                const userName = assignment.user.getName().replace(/[^a-zA-Z0-9_-]/g, '_');
                const fileName = assignment.startKey + "_" + `${userName || assignment.user.id}.ck3ruler`;
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
