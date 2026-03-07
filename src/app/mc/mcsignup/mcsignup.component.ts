import { CdkDragDrop, CdkDragEnd, CdkDragStart, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, inject, Input, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatestWith, filter, map, Observable, of, switchMap } from 'rxjs';
import { CK3 } from '../../../model/ck3/game/CK3';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { McSignupService } from '../../../services/megacampaign/mc-signup.service';
import { getMeshStatistics } from '../../../util/geometry/threeGeometry';
import { DiscordFieldComponent } from '../../discord-field/discord-field.component';
import { DiscordLoginComponent } from '../../discord-login/discord-login.component';
import { TimerComponent } from '../../timer/timer.component';
import { ColorConfigProvider } from '../../viewers/polygon-select/ColorConfigProvider';
import { PolygonSelectComponent } from '../../viewers/polygon-select/polygon-select.component';
import { ValueGradientColorConfig } from '../../viewers/polygon-select/ValueGradientColorConfig';
import { MegaBrowserSessionService } from '../mega-browser-session.service';
import { MegaCampaign } from '../MegaCampaign';
import { SignupAssetsData, SignupAssetsService } from './../SignupAssetsService';

export interface TableItem {
    key: string;
    name: string;
}

@Component({
    selector: 'app-mcsignup',
    imports: [PolygonSelectComponent, DiscordLoginComponent, MatButtonModule, MatIconModule, MatTableModule, DragDropModule, DiscordFieldComponent, MatProgressSpinnerModule, MatTooltipModule, TimerComponent, AsyncPipe],
    templateUrl: './mcsignup.component.html',
    styleUrl: './mcsignup.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MCSignupComponent {



    @ViewChild(PolygonSelectComponent) polygonSelectComponent!: PolygonSelectComponent;

    @Input() campaign: MegaCampaign | null = null;

    private _snackBar = inject(MatSnackBar);
    private cdr = inject(ChangeDetectorRef);
    private destroyRef = inject(DestroyRef);

    megaSessionService = inject(MegaBrowserSessionService);
    activatedRoute = inject(ActivatedRoute);
    discordAuthService = inject(DiscordAuthenticationService);
    signupAssetsService = inject(SignupAssetsService);
    mcSignupService = inject(McSignupService);
    router = inject(Router);
    ck3Service = inject(CK3Service);

    private readonly MAX_SELECTIONS = 5;
    private key2Value: Map<string, number> = new Map();
    private currentMapData: SignupAssetsData | null = null;
    private ck3: CK3 | null = null;
    displayedColumns: string[] = ['index', 'value'];
    dataSource: TableItem[] = [];

    isLoggedIn$ = this.discordAuthService.isLoggedIn$();
    loggedInUser$ = this.discordAuthService.loggedInUser$;

    aggregatedSignupsCount$ = this.mcSignupService.aggregatedSignupsCount$;

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

    meshBuddiesProvider: (key: string) => string[] = (key: string) => {
        if (!this.currentMapData?.clusterManager) {
            return [key];
        }
        return this.currentMapData.clusterManager.getBuddies(key);
    };
    tooltipProvider: (key: string) => string = (key: string) => {
        const clusterManager = this.currentMapData!.clusterManager!;
        const clusterKey = clusterManager.getClusterKey(key)!;
        const countyName = this.ck3 ? this.ck3.localise(key) : key;
        return "<i>" + countyName + "</i><br><strong>" + clusterKey + "</strong>";
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
            campaignSource$ = this.activatedRoute.params.pipe(
                switchMap(params => {
                    if (params['campaignId']) {
                        return this.megaSessionService.selectCampaignById(params['campaignId']);
                    }
                    return this.megaSessionService.selectedMegaCampaign$;
                }),
                filter((campaign): campaign is MegaCampaign => campaign !== null)
            );
        }
        this.ck3Service.initializeCK3().subscribe(ck => {
            this.ck3 = ck;
            this.cdr.markForCheck();
        });

        campaignSource$.pipe(
            switchMap(campaign => {
                this.campaign = campaign;
                return campaign.getRegionNameList$().pipe(
                    combineLatestWith(
                        this.signupAssetsService.mapData$
                    )
                );
            }),
            takeUntilDestroyed()
        ).subscribe({
            next: ([regionNames, currentData]) => {
                this.currentMapData = currentData;
                this.launchPolygonSelect(currentData);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading map data:', err);
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
                this.cdr.markForCheck();
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
        this.dataSource = newPicks.map(key => ({ key, name: key }));
    }

    register() {
        if (!this.canRegister()) {
            this.openSnackBar("Cannot register: check login, selections, and campaign stage", "OK");
            return;
        }
        this.loggedInUser$.pipe(
            filter(user => user !== null),
            switchMap(user => 
                this.mcSignupService.registerUserPicks$(user!.id, this.dataSource.map(item => item.key))
            ),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: () => {
                this.openSnackBar("Registration successful!", "OK");
            },
            error: (err: any) => {
                this.openSnackBar("Registration failed:\n" + (err?.message || "Unknown error"), "OK");
                console.error('Registration error:', err);
            }
        });
    }

    canRegister() {
        // This will be checked in template with observable
        return this.dataSource.length == this.MAX_SELECTIONS && (this.campaign ? this.campaign.isInRegionSignupStage() : false);
    }

    getDisabledTooltip(): string {
        if (!(this.campaign ? this.campaign.isInRegionSignupStage() : false)) {
            return 'Signups are not open at this time.';
        }
        // Note: isLoggedIn$ needs to be checked in the template or via a getters
        if (this.dataSource.length < this.MAX_SELECTIONS) {
            return `Please select ${this.MAX_SELECTIONS} regions (currently ${this.dataSource.length}/${this.MAX_SELECTIONS})`;
        }
        return '';
    }

    openSnackBar(message: string, action: string) {
        this._snackBar.open(message, action, {
            duration: 10000,
        });
    }

    getDeadline() {
        return this.campaign ? this.campaign.getRegionDeadlineDate() : new Date();
    }

    getFinalAssignmentDate() {
        const date = new Date(this.getDeadline().getTime() + 24 * 60 * 60 * 1000);
        return date.getDay() + ". " + (date.getMonth() + 1);
    }
}