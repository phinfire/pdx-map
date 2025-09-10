import { Component, inject, Input, ViewChild, AfterViewInit } from '@angular/core';
import { MegaCampaign } from '../MegaCampaign';
import { MCSignupService } from '../../../services/MCSignupService';
import { PolygonSelectComponent } from '../../viewers/polygon-select/polygon-select.component';
import { TimerComponent } from '../../timer/timer.component';
import { RendererConfigProvider } from '../../viewers/polygon-select/RendererConfigProvider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SignupAssetsService, SignupAssetsData } from '../SignupAssetsService';
import { StartAssignment } from '../StartAssignment';
import { DynamicColorConfig } from '../../viewers/polygon-select/DynamicColorConfig';
import { combineLatest } from 'rxjs';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { PdxFileService } from '../../../services/pdx-file.service';
import { CustomRulerFile } from '../../../services/gamedata/CustomRulerFile';
import { ClusterManager } from '../mcsignup/ClusterManager';

@Component({
    selector: 'app-mcstartselect',
    imports: [PolygonSelectComponent, TimerComponent, MatProgressSpinnerModule, MatButtonModule, MatTooltipModule],
    templateUrl: './mcstartselect.component.html',
    styleUrl: './mcstartselect.component.scss'
})
export class McstartselectComponent implements AfterViewInit {

    @ViewChild('polygonSelect') polygonSelectComponent!: PolygonSelectComponent;

    signupService = inject(MCSignupService);
    signupAssetsService = inject(SignupAssetsService);
    ck3Service = inject(CK3Service);
    fileService = inject(PdxFileService);

    @Input() campaign: MegaCampaign | null = null;
    @Input() assignment!: StartAssignment;

    rendererReady = false;
    selectedPosition: string | null = null;
    ruler: CustomRulerFile | null = null;
    clusterManager: ClusterManager | null = null;

    private key2Value: Map<string, number> = new Map();
    private pendingMapData: SignupAssetsData | null = null;

    colorConfigProvider = new RendererConfigProvider(new Map<string, number>());
    selectionCallback = this.onSelect.bind(this);
    meshBuddiesProvider: (key: string) => string[] = (key: string) => {
        if (this.clusterManager) {
            return this.clusterManager.getBuddies(key);
        }
        return [key];
    }
    tooltipProvider: (key: string) => string = (key: string) => {
        const data = this.signupAssetsService.getCurrentData();
        if (!data?.ck3) {
            return key;
        }
        const ck3 = data.ck3;
        return ck3.localise(key);
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
    }

    ngAfterViewInit() {
        this.tryLaunchPolygonSelect();
    }

    private tryLaunchPolygonSelect() {
        if (this.pendingMapData && this.polygonSelectComponent) {
            this.launchPolygonSelect(this.pendingMapData);
            this.pendingMapData = null;
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
            new DynamicColorConfig(this.key2Value)
        ];
        this.clusterManager = data.clusterManager;
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

        const data = this.signupAssetsService.getCurrentData();
        if (data?.ck3) {
            return data.ck3.localise(this.selectedPosition);
        }
        return this.selectedPosition;
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
            }).catch(error => {
                alert('Error parsing ruler file. Please check the file format.');
            });
        });
    }
}