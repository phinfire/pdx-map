import { Router, ActivatedRoute } from '@angular/router';
import { Component, inject, ViewChild, HostListener, Input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { CdkDragDrop, DragDropModule, moveItemInArray, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SignupAssetsService, SignupAssetsData } from './../SignupAssetsService';
import { DiscordFieldComponent } from '../../discord-field/discord-field.component';
import { DiscordLoginComponent } from '../../discord-login/discord-login.component';
import { combineLatestWith, switchMap, Observable, filter, tap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { PolygonSelectComponent } from '../../viewers/polygon-select/polygon-select.component';
import { ColorConfigProvider } from '../../viewers/polygon-select/ColorConfigProvider';
import { TimerComponent } from '../../timer/timer.component';
import { MegaCampaign } from '../MegaCampaign';
import { ValueGradientColorConfig } from '../../viewers/polygon-select/ValueGradientColorConfig';
import { getMeshStatistics } from '../../../util/geometry/threeGeometry';
import { MegaBrowserSessionService } from '../mega-browser-session.service';
import { MCSignupService } from '../../../services/megacampaign/legacy-mc-signup-service.service';
import { CK3 } from '../../../model/ck3/game/CK3';
import { CK3Service } from '../../../services/gamedata/CK3Service';

export interface TableItem {
    key: string;
    name: string;
}

@Component({
    selector: 'app-mcsignup',
    imports: [PolygonSelectComponent, DiscordLoginComponent, MatButtonModule, MatIconModule, MatTableModule, DragDropModule, DiscordFieldComponent, MatProgressSpinnerModule, MatTooltipModule, TimerComponent],
    templateUrl: './mcsignup.component.html',
    styleUrl: './mcsignup.component.scss'
})
export class MCSignupComponent {

    private readonly SHOW_NUM_SIGNUPS_PER_REGION = true;

    @ViewChild(PolygonSelectComponent) polygonSelectComponent!: PolygonSelectComponent;

    @Input() campaign: MegaCampaign | null = null;

    private readonly MAX_SELECTIONS = 5;
    private _snackBar = inject(MatSnackBar);

    megaSessionService = inject(MegaBrowserSessionService);
    activatedRoute = inject(ActivatedRoute);
    discordAuthService = inject(DiscordAuthenticationService);
    signupAssetsService = inject(SignupAssetsService);
    mcSignupService = inject(MCSignupService);
    router = inject(Router);
    ck3Service = inject(CK3Service);

    displayedColumns: string[] = ['index', 'value'];
    dataSource: TableItem[] = [];
    aggregatedSignupsCount: number = 0;
    perRegionSignups: Map<string, number> = new Map();
    private key2Value: Map<string, number> = new Map();
    private currentMapData: SignupAssetsData | null = null;
    private ck3$: Observable<CK3> | null = null;

    get tableDataSource(): TableItem[] {
        const emptyRowsCount = this.MAX_SELECTIONS - this.dataSource.length;
        const emptyRows: TableItem[] = Array(emptyRowsCount).fill(null).map(() => ({
            key: '',
            name: '-'
        }));
        return [...this.dataSource, ...emptyRows];
    }

    getEmptyRows(): any[] {
        const emptyRowsCount = this.MAX_SELECTIONS - this.dataSource.length;
        return Array(emptyRowsCount).fill(null);
    }

    isDraggableRow = (index: number, item: TableItem) => item.key !== '';
    isEmptyRow = (index: number, item: TableItem) => item.key === '';

    selectionCallback = this.onSelect.bind(this);
    meshBuddiesProvider: (key: string) => string[] = (key: string) => {
        if (!this.currentMapData?.clusterManager) {
            return [key];
        }
        return this.currentMapData.clusterManager.getBuddies(key);
    };
    tooltipProvider: (key: string) => string = (key: string) => {
        const clusterManager = this.currentMapData!.clusterManager!;
        const clusterKey = clusterManager.getClusterKey(key)!;
        let tooltip = "<i>" + key + "</i><br><strong>" + clusterKey + "</strong>";
        if (this.perRegionSignups.has(clusterKey)) {
            const plural = this.perRegionSignups.get(clusterKey) !== 1 ? 's' : '';
            tooltip += `<br>(${this.perRegionSignups.get(clusterKey)} registered player${plural})`;
        } else {
            tooltip += "<br><small>(be the first to sign up!)</small>";
        }
        return tooltip;
    }

    colorConfigProviders: ColorConfigProvider[] = [new ColorConfigProvider(new Map<string, number>())]

    constructor() {
        let campaignSource$: Observable<MegaCampaign>;
        
        if (this.campaign) {
            campaignSource$ = new Observable<MegaCampaign>(observer => {
                observer.next(this.campaign!);
                observer.complete();
            });
        } else {
            campaignSource$ = this.megaSessionService.selectedMegaCampaign$.pipe(
                filter((campaign): campaign is MegaCampaign => campaign !== null)
            );
        }
        this.ck3$ = this.ck3Service.initializeCK3();

        campaignSource$.pipe(
            switchMap(campaign => {
                this.campaign = campaign;
                return this.signupAssetsService.getRegionNameList$().pipe(
                    combineLatestWith(
                        this.mcSignupService.getAggregatedRegistrations$(),
                        this.signupAssetsService.mapData$
                    )
                );
            }),
            takeUntilDestroyed()
        ).subscribe({
            next: ([regionNames, picks, currentData]) => {
                this.currentMapData = currentData;
                for (const name of regionNames) {
                    const regionValue = picks.get(name) || 0;
                    for (const clusterKey of currentData.clusterManager.getCluster2Keys(name)) {
                        this.key2Value.set(clusterKey, regionValue);
                    }
                }
                this.launchPolygonSelect(currentData);
            },
            error: (err) => {
                console.error('Error loading map data:', err);
            }
        });

        this.mcSignupService.getAggregatedRegistrations$().pipe(
            takeUntilDestroyed()
        ).subscribe({
            next: (picks: Map<string, number>) => {
                this.aggregatedSignupsCount = Array.from(picks.values()).reduce((a, b) => a + b, 0) / this.MAX_SELECTIONS;
                this.perRegionSignups = picks;
            },
            error: () => {
                this.aggregatedSignupsCount = -1;
            }
        });

        this.mcSignupService.userPicks$.pipe(
            takeUntilDestroyed()
        ).subscribe({
            next: (picks: string[]) => {
                this.dataSource = picks.map((key: string) => ({
                    key,
                    name: key
                }));
            },
            error: (err) => {
                console.error('Failed to load registration:', err);
            }
        });
    }

    goBack() {
        if (this.campaign) {
            this.router.navigate(['/mc', this.campaign.getId()]);
        } else {
            this.router.navigate(['/mc']);
        }
    }

    private launchPolygonSelect(data: SignupAssetsData) {
        if (!this.polygonSelectComponent || !data.meshes || !data.configProviders) {
            console.error('MCSignupComponent: Cannot launch - missing components or data');
            return;
        }
        const colorConfigProviders = [...data.configProviders, new ValueGradientColorConfig(this.key2Value)];
        this.polygonSelectComponent.launch(data.meshes, colorConfigProviders);
        const regionKeys = this.dataSource.map(item => item.key);
        for (const key of regionKeys) {
            const reprKey = data.clusterManager.getCluster2Keys(key)[0];
            this.polygonSelectComponent.setLockedState(reprKey, true, false);
        }
        const stats = getMeshStatistics(data.meshes);
        console.info(`Loaded ${stats.meshCount} polygon meshes with ${stats.triangleCount.toLocaleString()} triangles total`);
    }

    drop(event: CdkDragDrop<TableItem[]>) {
        moveItemInArray(this.dataSource, event.previousIndex, event.currentIndex);
        this.dataSource = [...this.dataSource];
    }

    onDragStarted(event: CdkDragStart) { }

    onDragEnded(event: CdkDragEnd) { }

    onSelect(key: string, locked: boolean) {
        if (!this.currentMapData?.clusterManager) {
            return;
        }
        const clusterKey = this.currentMapData.clusterManager.getClusterKey(key);
        if (!clusterKey) {
            return;
        }
        const picks = this.dataSource.map(item => item.key);
        const existingItem = picks.includes(clusterKey);
        let newPicks: string[];
        if (locked) {
            if (picks.length >= this.MAX_SELECTIONS && !existingItem) {
                this.polygonSelectComponent.setLockedState(key, false, false);
                this.openSnackBar("Maximum selections reached!", "OK");
                return;
            }
            if (!existingItem) {
                newPicks = [...picks, clusterKey];
            } else {
                newPicks = picks;
            }
        } else {
            newPicks = picks.filter(k => k !== clusterKey);
        }
        this.mcSignupService.setUserPicks(newPicks);
    }

    register() {
        if (!this.canRegister()) {
            this.openSnackBar("Cannot register: check login, selections, and campaign stage", "OK");
            return;
        }
        this.mcSignupService.registerUserPicks$(this.dataSource.map(item => item.key)).subscribe({
            next: () => {
                this.openSnackBar("Registration successful!", "OK");
            },
            error: (err: any) => {
                this.openSnackBar("Registration failed: " + (err?.message || "Unknown error"), "OK");
                console.error('Registration error:', err);
            }
        });
    }

    canRegister() {
        return this.discordAuthService.isLoggedIn() && this.dataSource.length == this.MAX_SELECTIONS && (this.campaign ? this.campaign.isInRegionSignupStage() : false);
    }

    getDisabledTooltip(): string {
        if (!(this.campaign ? this.campaign.isInRegionSignupStage() : false)) {
            return 'Signups are not open at this time.';
        }
        if (!this.discordAuthService.isLoggedIn()) {
            return 'Please log in with Discord to signup';
        }
        if (this.dataSource.length < this.MAX_SELECTIONS) {
            return `Please select ${this.MAX_SELECTIONS} regions (currently ${this.dataSource.length}/${this.MAX_SELECTIONS})`;
        }
        return '';
    }

    @HostListener('window:resize', ['$event'])
    onWindowResize(event: any) {
        if (this.polygonSelectComponent) {
            this.polygonSelectComponent.handleResize();
        }
    }

    openSnackBar(message: string, action: string) {
        this._snackBar.open(message, action, {
            duration: 3000,
        });
    }

    getDeadline() {
        return this.campaign ? this.campaign.getRegionDeadlineDate() : new Date();
    }
}