import { Component, inject, OnInit } from '@angular/core';
import { combineLatest } from 'rxjs';
import { Vic3GameFilesService } from '../../model/vic/Vic3GameFilesService';
import { LabeledAndIconed } from '../../ui/LabeledAndIconed';
import { MapService } from '../map.service';
import { SlabMapViewComponent } from '../slab-map-view/slab-map-view.component';
import { ViewMode } from '../slab-map-view/ViewMode';
import { BehaviorConfigProvider } from '../viewers/polygon-select/BehaviorConfigProvider';
import { ValueGradientColorConfig } from '../viewers/polygon-select/ValueGradientColorConfig';

const EXCLUDED_RESOURCES = ['bg_monuments'];

@Component({
    selector: 'app-resourcemap',
    imports: [SlabMapViewComponent],
    templateUrl: './resourcemap.component.html',
    styleUrl: './resourcemap.component.scss',
})
export class ResourcemapComponent implements OnInit {

    mapService = inject(MapService);
    vic3GameFilesService = inject(Vic3GameFilesService);

    geoJsonFetcher = () => this.mapService.fetchVic3GeoJson(true);
    viewModes: LabeledAndIconed<ViewMode>[] = [];
    behaviorConfig = new BehaviorConfigProvider(0.75);

    ngOnInit() {
        combineLatest([
            this.vic3GameFilesService.getGoods(),
            this.vic3GameFilesService.getAllAvailableResources(),
            this.vic3GameFilesService.getMapStateRegions()
        ]).subscribe(([goods, resources, stateRegions]) => {
            const viewModes = [];
            for (const resource of resources) {
                if (EXCLUDED_RESOURCES.includes(resource)) {
                    continue;
                }
                const resourceGood = this.vic3GameFilesService.mapResourceToGood(resource)!;
                const state2Value = new Map<string, number>();
                for (const state of stateRegions) {
                    const value = state.getMaxAvailableResourceSlots(resource);
                    state2Value.set(state.getIdentifier(), value);
                }
                const colorConfig = new ValueGradientColorConfig(state2Value);
                const viewMode: ViewMode = {
                    getColorConfig: () => colorConfig,
                    getTooltip: () => (key: string) => {
                        const state = stateRegions.find(s => s.getIdentifier() === key);
                        if (!state) {
                            return key;
                        }
                        const totalValue = state2Value.get(key) || 0;
                        return "<b>" + state.getHumanReadableName() + "</b><br>" +
                            `${this.formatResourceName(resource)} Slots: ${totalValue}`;
                    }
                };
                const url = goods.find(g => g.key === resourceGood)!.getIconUrl();
                viewModes.push(new LabeledAndIconed<ViewMode>(null,
                    this.formatResourceName(resource),
                    url,
                    viewMode
                ));
            }
            this.viewModes = viewModes;
        });
    }

    formatResourceName(resource: string): string {
        return resource.replace("building_", "").replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
    
}
