import { AfterViewInit, Component, DestroyRef, ElementRef, inject, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import JSZip from 'jszip';
import { combineLatest } from 'rxjs';
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
import { Plotable } from '../../plot-view/Plotable';
import { PlottingService } from '../../plot-view/PlottingService';
import { SaveSaverService } from '../../save-saver.service';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { AssignmentService } from '../AssignmentService';
import { MegaCampaign } from '../MegaCampaign';
import { MegaPlotService } from '../MegaPlotService';
import { StartAssignment } from '../StartAssignment';

@Component({
    selector: 'app-mega-campaign',
    imports: [MatButtonModule, TableComponent, MatIconModule, MatTooltipModule, PlotViewComponent, MatDividerModule, LineviewerComponent],
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

    user2Ruler: Map<DiscordUser, CustomRulerFile> = new Map();
    seriesData: LineViewerData<Date> | null = null;

    private cachedColumns: Map<number, TableColumn<StartAssignment>[]> = new Map();

    goToSignup = () => this.router.navigate(['/mc/signup']);
    goToStartSelection = () => this.router.navigate(['/mc/start-selection']);

    ngOnInit() {
        this.titleService.setTitle('Mega Campaign');
        const campaignId = this.activatedRoute.snapshot.paramMap.get('campaignId');
        console.log('MegaCampaignComponent initialized with campaignId:', campaignId);
        this.megaSessionService.selectCampaignById(campaignId).subscribe(campaign => {
            if (campaign) {
                this.campaign = campaign;
                this.saveSaver.getSaveFileByIdentifier$(this.campaign.getVic3SaveIdentifiersInChronologicalOrder()[2]).subscribe(save => {
                    this.seriesData = Vic3SaveSeriesData.fromSaves([save]);
                });
            }
        });
        combineLatest([this.assignmentService.allAssignments$, this.ck3Service.initializeCK3(), this.authService.loggedInUser$])
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(([assignments, ck3, loggedInUser]) => {
                if (assignments != null) {
                    this.assignments = assignments.sort((a, b) => a.region_key < b.region_key ? -1 : (a.region_key > b.region_key ? 1 : 0));
                    this.cachedColumns.clear();
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
                                const message = this.megaUtils.getIllegalityReport(ruler);
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
                    const illegalityReport = this.megaUtils.getIllegalityReport(ruler);
                    return illegalityReport.length === 0 ? '✅' : '❌';
                })
                .isSortable(false)
                .withTooltip("Whether this user has uploaded a permitted ruler")
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
