import { Router } from '@angular/router';
import { Component, inject, ViewChild, OnInit, HostListener, AfterViewInit, Input } from '@angular/core';

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
import { combineLatest } from 'rxjs';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { ValueGradientColorConfig } from '../../viewers/polygon-select/DynamicColorConfig';
import { PolygonSelectComponent } from '../../viewers/polygon-select/polygon-select.component';
import { ColorConfigProvider } from '../../viewers/polygon-select/ColorConfigProvider';
import { TimerComponent } from '../../timer/timer.component';
import { MegaCampaign } from '../MegaCampaign';
import { MegaService } from '../MegaService';
import { MCSignupService } from '../MCSignupService';

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
export class MCSignupComponent implements OnInit, AfterViewInit {

    @ViewChild(PolygonSelectComponent) polygonSelectComponent!: PolygonSelectComponent;

    @Input() campaign?: MegaCampaign;
    @Input() goBackFunction: (() => void) | null = null;

    private readonly MAX_SELECTIONS = 5;
    private _snackBar = inject(MatSnackBar);

    megaService = inject(MegaService);

    displayedColumns: string[] = ['index', 'value'];
    dataSource: TableItem[] = [];
    subsToUnsubFromOnDestroy: any[] = [];
    aggregatedSignupsCount: number = 0;
    perRegionSignups: Map<string, number> = new Map();

    private key2Value: Map<string, number> = new Map();

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
        const data = this.signupAssetsService.getCurrentData();
        if (!data?.clusterManager) {
            return [key];
        }
        return data.clusterManager.getBuddies(key);
    };
    tooltipProvider: (key: string) => string = (key: string) => {
        const data = this.signupAssetsService.getCurrentData();
        const ck3 = data!.ck3;
        const clusterManager = data!.clusterManager!;
        const clusterKey = clusterManager.getClusterKey(key)!;
        let tooltip = "<i>" + ck3.localise(key) + "</i><br><strong>" + clusterKey + "</strong>";
        if (this.perRegionSignups.has(clusterKey)) {
            const plural = this.perRegionSignups.get(clusterKey) !== 1 ? 's' : '';
            tooltip += `<br>(${this.perRegionSignups.get(clusterKey)} registered player${plural})`;
        } else {
            tooltip += "<br><small>(be the first to sign up!)</small>";
        }
        return tooltip;
    }

    colorConfigProviders: ColorConfigProvider[] = [new ColorConfigProvider(new Map<string, number>())]

    constructor(
        protected discordAuthService: DiscordAuthenticationService,
        private signupAssetsService: SignupAssetsService,
        private mcSignupService: MCSignupService,
        private router: Router
    ) { }

    goBack() {
        // Remove '/signup' from the end of the current URL and navigate
        const url = this.router.url.replace(/\/signup$/, '');
        this.router.navigateByUrl(url);
    }

    ngOnInit() {
        if (!this.campaign) {
            this.megaService.getCurrentCampaign$().subscribe(campaign => {
                if (this.campaign || campaign === null) {
                    return;
                }
                this.campaign = campaign;
            });
        }
        combineLatest([
            this.signupAssetsService.getRegionNameList$(),
            this.mcSignupService.getAggregatedRegistrations$(),
            this.signupAssetsService.loadMapData$()
        ]).subscribe({
            next: ([regionNames, picks, currentData]) => {
                for (const name of regionNames) {
                    const regionValue = picks.get(name) || 0;
                    for (const clusterKey of currentData.clusterManager.getCluster2Keys(name)) {
                        this.key2Value.set(clusterKey, regionValue);
                    }
                }
                this.launchPolygonSelect(currentData);
            }
        });

        this.mcSignupService.getAggregatedRegistrations$().subscribe({
            next: (picks: Map<string, number>) => {
                this.aggregatedSignupsCount = Array.from(picks.values()).reduce((a, b) => a + b, 0) / this.MAX_SELECTIONS;
                this.perRegionSignups = picks;
            },
            error: () => {
                this.aggregatedSignupsCount = -1;
            }
        });

        const userPicksSub = this.mcSignupService.userPicks$.subscribe({
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
        this.subsToUnsubFromOnDestroy.push(userPicksSub);
    }

    ngOnDestroy() {
        for (const sub of this.subsToUnsubFromOnDestroy) {
            sub.unsubscribe();
        }
    }

    ngAfterViewInit() {
        // Initialization moved to ngOnInit to avoid ExpressionChangedAfterItHasBeenCheckedError
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
        const stats = this.signupAssetsService.getMeshStatistics(data.meshes);
        console.info(`Loaded ${stats.meshCount} polygon meshes with ${stats.triangleCount.toLocaleString()} triangles total`);
    }

    drop(event: CdkDragDrop<TableItem[]>) {
        moveItemInArray(this.dataSource, event.previousIndex, event.currentIndex);
        this.dataSource = [...this.dataSource];
    }

    onDragStarted(event: CdkDragStart) { }

    onDragEnded(event: CdkDragEnd) { }

    onSelect(key: string, locked: boolean) {
        const data = this.signupAssetsService.getCurrentData();
        if (!data?.clusterManager) {
            return;
        }
        const clusterKey = data.clusterManager.getClusterKey(key);
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