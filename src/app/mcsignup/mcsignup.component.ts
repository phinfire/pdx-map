import { Component, inject, ViewChild, OnInit, HostListener, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { PolygonSelectComponent } from '../polygon-select/polygon-select.component';
import { RendererConfigProvider } from '../polygon-select/RendererConfigProvider';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { CdkDragDrop, DragDropModule, moveItemInArray, CdkDragStart, CdkDragEnd } from '@angular/cdk/drag-drop';
import { DiscordLoginComponent } from '../discord-login/discord-login.component';
import { DiscordAuthenticationService } from '../services/discord-auth.service';
import { DiscordFieldComponent } from '../discord-field/discord-field.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SignupAssetsService, SignupAssetsData } from './SignupAssetsService';
import { MCSignupService } from '../services/MCSignupService';

export interface TableItem {
    key: string;
    name: string;
}

@Component({
    selector: 'app-mcsignup',
    imports: [CommonModule, PolygonSelectComponent, DiscordLoginComponent, MatButtonModule, MatIconModule, MatTableModule, DragDropModule, DiscordFieldComponent, MatProgressSpinnerModule, MatTooltipModule],
    templateUrl: './mcsignup.component.html',
    styleUrl: './mcsignup.component.scss'
})
export class MCSignupComponent implements OnInit, AfterViewInit {

    @ViewChild(PolygonSelectComponent) polygonSelectComponent!: PolygonSelectComponent;

    private readonly MAX_SELECTIONS = 5;
    private _snackBar = inject(MatSnackBar);

    displayedColumns: string[] = ['index', 'value'];
    dataSource: TableItem[] = [];
    userPicksSub: any;
    aggregatedSignupsCount: number = 0;
    perRegionSignups: Map<string, number> = new Map();

    endDate = new Date('2025-09-12T23:59:59');
    timeLeft: {days: string, hours: string, minutes: string, seconds: string} = {days: "00", hours: "00", minutes: "00", seconds: "00"};
    private timeIntervalId: any;


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

    configProvider: RendererConfigProvider;

    constructor(
        protected discordAuthService: DiscordAuthenticationService,
        private signupAssetsService: SignupAssetsService,
        private mcSignupService: MCSignupService
    ) {
        const colorMap = new Map<string, number>();
        this.configProvider = new RendererConfigProvider(colorMap);
    }

    ngOnInit() {
        this.mcSignupService.getAggregatedRegistrations$().subscribe({
            next: (picks: Map<string, number>) => {
                this.aggregatedSignupsCount = Array.from(picks.values()).reduce((a, b) => a + b, 0) / this.MAX_SELECTIONS;
                this.perRegionSignups = picks;
            },
            error: () => {
                this.aggregatedSignupsCount = -1;
            }
        });
        this.signupAssetsService.loadMapData().subscribe({
            next: (data: SignupAssetsData) => {
                if (this.polygonSelectComponent) {
                    this.initializeMapWithData(data);
                }
            },
            error: (error) => {
                console.error('Error loading map data:', error);
            }
        });
        this.userPicksSub = this.mcSignupService.userPicks$.subscribe({
            next: (picks: string[]) => {
                this.dataSource = picks.map((key: string) => ({
                    key,
                    name: key
                }));
                this.dataSource = [...this.dataSource];
                if (this.polygonSelectComponent) {
                    this.polygonSelectComponent.setLockedStates(this.dataSource.map(item => item.key), true, false);
                }
            },
            error: (err) => {
                console.error('Failed to load registration:', err);
            }
        });

        this.updateTimeLeft();
        this.timeIntervalId = setInterval(() => {
            this.updateTimeLeft();
        }, 100);
    }
    ngOnDestroy() {
        if (this.timeIntervalId) {
            clearInterval(this.timeIntervalId);
        }
        if (this.userPicksSub) {
            this.userPicksSub.unsubscribe();
        }
    }

    private updateTimeLeft() {
        const now = new Date();
        let diff = Math.max(0, this.endDate.getTime() - now.getTime());
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        diff -= days * (1000 * 60 * 60 * 24);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * (1000 * 60 * 60);
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * (1000 * 60);
        const seconds = Math.floor(diff / 1000);
        this.timeLeft = { days: this.padZero(days), hours: this.padZero(hours), minutes: this.padZero(minutes), seconds: this.padZero(seconds) };
    }

    private padZero(num: number): string {
        return num.toString().padStart(2, '0');
    }

    ngAfterViewInit() {
        setTimeout(() => {
            this.initializeMap();
        }, 100);
    }

    private initializeMap() {
        if (!this.polygonSelectComponent) {
            setTimeout(() => this.initializeMap(), 100);
            return;
        }
        if (this.isDataReady()) {
            const data = this.signupAssetsService.getCurrentData();
            if (data) {
                this.initializeMapWithData(data);
                const regionKeys = this.dataSource.map(item => item.key);
                for (const key of regionKeys) {
                    const reprKey = data?.clusterManager.getCluster2Keys(key)[0];
                    this.polygonSelectComponent.setLockedState(reprKey, true, false);
                }
            }
        }
    }

    private initializeMapWithData(data: SignupAssetsData) {
        if (!this.polygonSelectComponent || !data.meshes || !data.configProvider) {
            return;
        }
        this.configProvider = data.configProvider;
        this.polygonSelectComponent.setMeshes(data.meshes);
        setTimeout(() => {
            this.polygonSelectComponent.forceResize();
            this.polygonSelectComponent.fitCameraToPolygons(0.1);
        }, 100);
        setTimeout(() => {
            this.polygonSelectComponent.forceResize();
        }, 500);
        const stats = this.signupAssetsService.getMeshStatistics(data.meshes);
        console.log(`Loaded ${stats.meshCount} polygon meshes with ${stats.triangleCount.toLocaleString()} triangles total`);
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
        // Update picks in service
        this.mcSignupService.setUserPicks(newPicks);
    }

    register() {
        if (!this.canRegister()) {
            this.openSnackBar("Cannot register: check login and selections", "OK");
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
        return this.discordAuthService.isLoggedIn() && this.dataSource.length == this.MAX_SELECTIONS;
    }

    getDisabledTooltip(): string {
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
            this.polygonSelectComponent.forceResize();
        }
    }

    openSnackBar(message: string, action: string) {
        this._snackBar.open(message, action, {
            duration: 3000,
        });
    }

    isDataReady() {
        return this.signupAssetsService.isDataReady();
    }

    isLoading() {
        return this.signupAssetsService.isLoading();
    }

    getRegisteredPlayersCount() {
        return -1;
    }
}