import { Component, inject, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
import { combineLatest, filter } from 'rxjs';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { PdxFileService } from '../../../services/pdx-file.service';
import { CustomRulerFile } from '../../../model/megacampaign/CustomRulerFile';
import { ClusterManager } from '../mcsignup/ClusterManager';
import { CK3 } from '../../../model/ck3/game/CK3';
import { AssignmentService } from '../AssignmentService';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ValueGradientColorConfig } from '../../viewers/polygon-select/ValueGradientColorConfig';
import { MegaService } from '../../../services/megacampaign/MegaService';
import { MegaBrowserSessionService } from '../../../services/megacampaign/mega-browser-session.service';

@Component({
    selector: 'app-mcstartselect',
    imports: [PolygonSelectComponent, TimerComponent, MatProgressSpinnerModule, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './mcstartselect.component.html',
    styleUrl: './mcstartselect.component.scss'
})
export class McstartselectComponent implements OnInit, AfterViewInit {

    @ViewChild('polygonSelect') polygonSelectComponent!: PolygonSelectComponent;

    discordAuthService = inject(DiscordAuthenticationService);
    signupAssetsService = inject(SignupAssetsService);
    ck3Service = inject(CK3Service);
    fileService = inject(PdxFileService);
    assignmentService = inject(AssignmentService);
    snackBar = inject(MatSnackBar);
    megaService = inject(MegaService);
    megaSessionService = inject(MegaBrowserSessionService);
    activatedRoute = inject(ActivatedRoute);
    router = inject(Router);

    campaign: MegaCampaign | null = null;
    assignment: StartAssignment | null = null;

    prepackagedLocalAssignment: StartAssignment | null = null;
    rendererReady = false;
    selectedPosition: string | null = null;
    ruler: CustomRulerFile | null = null;
    clusterManager: ClusterManager | null = null;
    ck3: CK3 | null = null;

    private key2Value: Map<string, number> = new Map();
    protected rulerFileContent: string | null = null;

    colorConfigProvider = new ColorConfigProvider(new Map<string, number>());
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
        const campaignId = this.activatedRoute.snapshot.paramMap.get('campaignId');
        if (!campaignId) {
            console.error('McstartselectComponent: No campaign ID in route params');
            return;
        }
        combineLatest([
            this.megaSessionService.selectCampaignById(campaignId),
            combineLatest([
                this.assignmentService.allAssignments$,
                this.discordAuthService.loggedInUser$
            ]).pipe(
                filter(([assignments]) => assignments.length > 0),
                filter(([assignments, user]) => {
                    if (!user) return false;
                    const userAssignment = assignments.find(a => a.user.id === user.id);
                    return !!userAssignment;
                })
            )
        ]).subscribe({
            next: ([campaign, [assignments, user]]) => {
                if (!campaign) {
                    console.error('McstartselectComponent: Campaign not found');
                    return;
                }
                if (!user) {
                    console.error('McstartselectComponent: User not logged in');
                    return;
                }
                const userAssignment = assignments.find(a => a.user.id === user.id);
                if (!userAssignment) {
                    console.error('McstartselectComponent: No assignment found for user');
                    return;
                }
                this.campaign = campaign;
                this.assignment = userAssignment;
                this.loadAndLaunchMapData();
            },
            error: (error) => {
                console.error('McstartselectComponent: Error loading data:', error);
            }
        });
        this.ck3Service.initializeCK3().subscribe(ck3 => {
            this.ck3 = ck3;
        });
        this.assignmentService.getMyStartPosition$().subscribe({
            next: (position) => {
                console.log('Fetched my start position:', position);
                if (position?.startData) {
                    try {
                        if (position.startData) {
                            this.rulerFileContent = position.startData;
                            this.loadRulerFromContent(position.startData);
                        }
                    } catch (error) {
                        console.error('McstartselectComponent: Error parsing start data:', error);
                    }
                }
            },
            error: (error) => {
                console.log('McstartselectComponent: No previously saved start position (this is normal on first load)');
            }
        });
    }

    private loadAndLaunchMapData() {
        console.log('Loading map data for assignment:', this.assignment);
        if (!this.assignment || !this.assignment.regionKey) {
            console.error('McstartselectComponent: No assignment or region key');
            return;
        }
        
        this.signupAssetsService.loadRegionMapData$(this.assignment.regionKey).subscribe({
            next: (data) => {
                console.log('Map data loaded:', data);
                this.launchPolygonSelect(data);
            },
            error: (error) => {
                console.error('McstartselectComponent: Error loading map data:', error);
            }
        });
    }

    private loadRulerFromContent(rulerData: string) {
        this.ck3Service.initializeCK3().subscribe(ck3 => {
            this.fileService.parseContentToJsonPromise(rulerData).then(json => {
                try {
                    const character = this.ck3Service.parseCustomCharacter(json, ck3);
                    this.ruler = character;
                    console.log('Ruler loaded from start position:', character);
                } catch (e) {
                    console.error('Failed to parse ruler from content:', e);
                    this.ruler = null;
                }
            }).catch(error => {
                console.error('Failed to parse ruler content:', error);
                this.ruler = null;
            });
        });
    }

    ngAfterViewInit() {
        // polygon select is now launched during ngOnInit when all data is ready
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
        this.ck3 = data.ck3SaveData?.getCK3() || null;
        
        this.polygonSelectComponent.launch(data.meshes, colorConfigProviders);
        if (this.assignment?.startKey) {
            console.log('Setting locked state for start key:', this.assignment.startKey);
            this.polygonSelectComponent.setLockedStates([this.assignment.startKey], true);
        }
        
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
        if (this.ck3 && this.ck3.hasLocalisation(traitName)) {
            return this.ck3.localise(traitName);
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
        const authHeader = this.discordAuthService.getAuthenticationHeader();
        if (!authHeader || !authHeader['Authorization']) {
            alert('You must be logged in to upload your selection.');
            return;
        }
        this.assignmentService.setMyStartPosition$(this.selectedPosition, this.rulerFileContent || "").subscribe({
            next: (success) => {
                if (success) {
                    this.snackBar.open('Selection uploaded successfully!', 'Close', { duration: 3000 });
                } else {
                    this.snackBar.open('Error uploading selection. Please try again.', 'Close', { duration: 3000 });
                }
            },
            error: (err) => {
                console.error('Error uploading selection:', err);
                this.snackBar.open('Error uploading selection. Please try again.', 'Close', { duration: 3000 });
            }
        });
    }

    clearRuler() {
        this.ruler = null;
        this.rulerFileContent = null;
    }
}