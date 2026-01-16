import { Component, inject, Input, ViewChild } from '@angular/core';
import { PolygonSelectComponent } from '../viewers/polygon-select/polygon-select.component';
import { makeGeoJsonPolygons } from '../../util/geometry/threeGeometry';
import { MapService } from '../map.service';
import { ColorConfigProvider } from '../viewers/polygon-select/ColorConfigProvider';
import { BehaviorConfigProvider } from '../viewers/polygon-select/BehaviorConfigProvider';
import { ViewMode } from './ViewMode';
import { Observable } from 'rxjs';
import { LabeledAndIconed } from '../../ui/LabeledAndIconed';
import { CustomButton } from '../viewers/polygon-select/CustomButton';

@Component({
    selector: 'app-slab-map-view',
    imports: [PolygonSelectComponent],
    templateUrl: './slab-map-view.component.html',
    styleUrl: './slab-map-view.component.scss'
})
export class SlabMapViewComponent {

    mapService = inject(MapService);

    @Input() geoJsonFetcher!: () => Observable<any>;
    @Input() viewModes: LabeledAndIconed<ViewMode>[] = [];
    protected colorConfigProviders: ColorConfigProvider[] = [];
    @Input() behaviorConfig: BehaviorConfigProvider = new BehaviorConfigProvider(0.75);
    @Input() selectionCallback: (key: string) => void = (key: string) => {
        this.polygonSelectComponent.setLockedState(key, false, false);
    };
    @ViewChild('polygonSelect') polygonSelectComponent!: PolygonSelectComponent;

    customButtonsForPolySelect: CustomButton[] = [];

    key2Province: Map<string, any> = new Map<string, any>();

    protected currentViewMode: LabeledAndIconed<ViewMode> | null = null;
    protected currentTooltipProvider: (key: string) => string = (key: string) => key;
    defaultTooltip = (key: string) => key;

    getCustomButtons() : CustomButton[] {
       return this.viewModes.map((vm, index) => ({
            icon: vm.icon,
            isImage: true,
            title: vm.label,
            canBeToggled: true,
            isToggled: index == 0,
            action: () => {
                this.currentViewMode = vm;
                this.currentTooltipProvider = vm.target.getTooltip();
                this.polygonSelectComponent.colorConfigProvider = this.colorConfigProviders[index];
                this.polygonSelectComponent.refreshAllColors();
            }
       }));
    }

    meshBuddiesProvider: (key: string) => string[] = (key: string) => {
        return [key];
    };

    ngOnChanges() {
        if (this.viewModes.length === 0) {
            return;
        }
        this.customButtonsForPolySelect = this.getCustomButtons();
        this.colorConfigProviders = this.viewModes.map(vm => vm.target.getColorConfig());
        this.currentViewMode = this.viewModes[0];
        this.currentTooltipProvider = this.currentViewMode.target.getTooltip();
        this.geoJsonFetcher().subscribe((geoJson) => {
            const meshes = makeGeoJsonPolygons(geoJson, this.colorConfigProviders[0], () => null, () => false, 0.75);
            this.polygonSelectComponent.launch(meshes, this.colorConfigProviders, this.behaviorConfig);
        });
    }

    onCustomButtonClick(btn: CustomButton) {
        if (btn.canBeToggled) {
            if (btn.isToggled) {
                return;
            }
            this.customButtonsForPolySelect.forEach(b => {
                if (b !== btn) {
                    b.isToggled = false;
                }
            });
            btn.isToggled = true;
        }
    }
}
