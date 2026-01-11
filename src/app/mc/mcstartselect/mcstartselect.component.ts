import { Component, inject, Input, ViewChild, AfterViewInit } from '@angular/core';
import { MegaCampaign } from '../MegaCampaign';
import { PolygonSelectComponent } from '../../viewers/polygon-select/polygon-select.component';
import { TimerComponent } from '../../timer/timer.component';
import { ColorConfigProvider } from '../../viewers/polygon-select/ColorConfigProvider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SignupAssetsService, SignupAssetsData } from '../SignupAssetsService';
import { StartAssignment } from '../StartAssignment';
import { combineLatest } from 'rxjs';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { PdxFileService } from '../../../services/pdx-file.service';
import { CustomRulerFile } from '../../../services/gamedata/CustomRulerFile';
import { ClusterManager } from '../mcsignup/ClusterManager';
import { CK3 } from '../../../model/ck3/CK3';
import { MCSignupService } from '../MCSignupService';
import { AssignmentService } from '../AssignmentService';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ValueGradientColorConfig } from '../../viewers/polygon-select/ValueGradientColorConfig';

@Component({
    selector: 'app-mcstartselect',
    imports: [PolygonSelectComponent, TimerComponent, MatProgressSpinnerModule, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './mcstartselect.component.html',
    styleUrl: './mcstartselect.component.scss'
})
export class McstartselectComponent implements AfterViewInit {

    @ViewChild('polygonSelect') polygonSelectComponent!: PolygonSelectComponent;

    discordAuthService = inject(DiscordAuthenticationService);
    signupService = inject(MCSignupService);
    signupAssetsService = inject(SignupAssetsService);
    ck3Service = inject(CK3Service);
    fileService = inject(PdxFileService);
    assignmentService = inject(AssignmentService);
    snackBar = inject(MatSnackBar);

    @Input() campaign: MegaCampaign | null = null;
    @Input() assignment!: StartAssignment;
    @Input() goBackFunction: (() => void) | null = null;

    prepackagedLocalAssignment: StartAssignment | null = null;
    rendererReady = false;
    selectedPosition: string | null = null;
    ruler: CustomRulerFile | null = null;
    clusterManager: ClusterManager | null = null;
    ck3: CK3 | null = null;

    private key2Value: Map<string, number> = new Map();
    private pendingMapData: SignupAssetsData | null = null;
    protected rulerFileContent: string | null = null;

    colorConfigProvider = new ColorConfigProvider(new Map<string, number>());
    selectionCallback = this.onSelect.bind(this);
    meshBuddiesProvider: (key: string) => string[] = (key: string) => {
        if (this.clusterManager) {
            return this.clusterManager.getBuddies(key);
        }
        return [key];
    }
    tooltipProvider: (key: string) => string = (key: string) => {
        if (this.clusterManager) {
            return this.clusterManager.getBuddies(key).map(k => this.ck3 ? this.ck3.localise(k) : k).join(' & ');
        }
        return this.ck3 ? this.ck3.localise(key) : key;
    }

    ngOnInit() {
        if (!this.assignment || !this.assignment.region_key) {
            console.error('McstartselectComponent: No assignment or region key provided');
            return;
        }
        combineLatest([
            this.signupAssetsService.loadRegionMapData$(this.assignment.region_key)
        ]).subscribe({
            next: ([currentData]) => {
                this.pendingMapData = currentData;
                this.tryLaunchPolygonSelect();
            },
            error: (error) => {
                console.error('McstartselectComponent: Error loading map data:', error);
            }
        });
        if (this.assignment && this.assignment.start_data) {
            const rulerData = (this.assignment.start_data as { ruler: string }).ruler;
            if (this.assignment && this.assignment.start_data && rulerData) {
                this.rulerFileContent = rulerData;
                this.ck3Service.initializeCK3().subscribe(ck3 => {
                    this.fileService.importFilePromise(new File([rulerData], 'ruler.ck3ruler')).then(result => {
                        try {
                            const character = this.ck3Service.parseCustomCharacter(result.json, ck3);
                            this.ruler = character;
                        } catch (e) {
                            console.error('Failed to parse ruler from start_data:', e);
                            this.ruler = null;
                        }
                    })
                });
            }
        }
    }

    ngOnChanges(changes: any) {
        if (changes.assignment) {
            if (!(this.assignment && this.prepackagedLocalAssignment && this.assignment.start_key !== this.prepackagedLocalAssignment.start_key)) {

            }
        }
    }

    ngAfterViewInit() {
        this.tryLaunchPolygonSelect();
    }

    private tryLaunchPolygonSelect() {
        if (this.pendingMapData && this.polygonSelectComponent) {
            this.launchPolygonSelect(this.pendingMapData);
            this.pendingMapData = null;
            console.log('Setting locked states for start key:', this.assignment.start_key);
            this.polygonSelectComponent.setLockedStates(this.assignment.start_key ? [this.assignment.start_key] : [], true);
        }
    }

    private launchPolygonSelect(data: SignupAssetsData) {
        if (!this.polygonSelectComponent || !data.meshes || !data.clusterManager) {
            console.error('McstartselectComponent: Cannot launch - missing components or data');
            return;
        }
        if (data.meshes.length === 0) {
            console.warn('McstartselectComponent: No meshes found for the assigned region');
            return;
        }
        for (const mesh of data.meshes) {
            this.key2Value.set(mesh.key, 1);
        }
        const colorConfigProviders = [
            ...data.configProviders,
            new ValueGradientColorConfig(this.key2Value)
        ];
        this.clusterManager = data.clusterManager;
        this.ck3 = data.ck3;
        this.polygonSelectComponent.launch(data.meshes, colorConfigProviders);
        this.rendererReady = true;
    }

    onSelect(key: string, locked: boolean) {
        if (this.selectedPosition != null && locked) {
            const oldCluster = this.clusterManager ? this.clusterManager.getClusterKey(this.selectedPosition) : [this.selectedPosition];
            const newCluster = this.clusterManager ? this.clusterManager.getClusterKey(key) : [key];
            if (oldCluster !== newCluster) {
                this.polygonSelectComponent.setLockedStates([this.selectedPosition], false);
            }
        }
        this.selectedPosition = locked ? key : null;
    }

    hasSelectedPosition(): boolean {
        return this.selectedPosition !== null;
    }

    getSelectedPositionName(): string {
        if (!this.selectedPosition) return '';
        return this.ck3 ? this.ck3.localise(this.selectedPosition) : this.selectedPosition;
    }

    getLocalizedTraitName(traitName: string): string {
        const data = this.signupAssetsService.getCurrentData();
        if (data?.ck3 && data.ck3.hasLocalisation(traitName)) {
            return data.ck3.localise(traitName);
        }
        return traitName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        if (!file.name.endsWith('.ck3ruler')) {
            alert('Please select a .ck3ruler file.');
            return;
        }

        this.ck3Service.initializeCK3().subscribe(ck3 => {
            this.fileService.importFilePromise(file).then(result => {
                const character = this.ck3Service.parseCustomCharacter(result.json, ck3);
                this.ruler = character;
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.rulerFileContent = e.target?.result as string;
                    console.log('Ruler file content loaded:', this.rulerFileContent);
                };
                reader.readAsText(file);
            }).catch(error => {
                alert('Error parsing ruler file. Please check the file format.');
            });
        });
    }

    uploadSelection() {
        if (!this.selectedPosition || !this.assignment) {
            alert('No position selected or assignment missing.');
            return;
        }
        if (!this.discordAuthService.isLoggedIn()) {
            alert('You must be logged in to upload your selection.');
            return;
        }
        const packagedAssignment: StartAssignment = {
            user: this.discordAuthService.getLoggedInUser()!,
            region_key: this.assignment.region_key,
            start_key: this.selectedPosition,
            start_data: { ruler: this.rulerFileContent }
        };
        console.log('Uploading selection:', packagedAssignment);
        this.assignmentService.updateMyAssignment$(packagedAssignment).subscribe({
            next: () => {
                this.snackBar.open('Selection uploaded successfully!', 'Close', { duration: 3000 });
            },
            error: (err) => {
                console.error('Error uploading selection:', err);
                this.snackBar.open('Error uploading selection. Please try again.', 'Close', { duration: 3000 });
            }
        });
    };

    clearRuler() {
        this.ruler = null;
        this.rulerFileContent = null;
    }
}