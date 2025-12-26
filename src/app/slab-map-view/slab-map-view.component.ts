import { Component, inject, Input, ViewChild } from '@angular/core';
import { PolygonSelectComponent } from '../viewers/polygon-select/polygon-select.component';
import { makeGeoJsonPolygons } from '../../util/geometry/threeGeometry';
import { MapService } from '../map.service';
import { ColorConfigProvider } from '../viewers/polygon-select/ColorConfigProvider';
import { BehaviorConfigProvider } from '../viewers/polygon-select/BehaviorConfigProvider';
import { ViewMode } from './ViewMode';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-slab-map-view',
    imports: [PolygonSelectComponent],
    templateUrl: './slab-map-view.component.html',
    styleUrl: './slab-map-view.component.scss'
})
export class SlabMapViewComponent {

    mapService = inject(MapService);

    @Input() geoJsonFetcher!: () => Observable<any>;
    @Input() viewModes: ViewMode<any>[] = [];
    @Input() colorConfigProviders: ColorConfigProvider[] = [];
    @Input() behaviorConfig: BehaviorConfigProvider = new BehaviorConfigProvider(0.75);
    @ViewChild('polygonSelect') polygonSelectComponent!: PolygonSelectComponent;

    key2Province: Map<string, any> = new Map<string, any>();

    protected currentViewMode: ViewMode<any> | null = null;
    protected currentTooltipProvider: (key: string) => string = (key: string) => key;
    defaultTooltip = (key: string) => key;

    getCustomButtons() {
        return this.viewModes.length > 1 ? [
        {
            icon: 'arrow_forward',
            title: 'Next view mode',
            action: () => {
                if (this.viewModes.length > 1) {
                    const currentIndex = this.viewModes.indexOf(this.currentViewMode!);
                    const nextIndex = (currentIndex + 1) % this.viewModes.length;
                    this.currentViewMode = this.viewModes[nextIndex];
                    this.currentTooltipProvider = this.currentViewMode.getTooltip();
                    this.polygonSelectComponent.colorConfigProvider = this.colorConfigProviders[nextIndex];
                    this.polygonSelectComponent.refreshAllColors();
                }
            }
        }
    ] : [];
    }

    selectionCallback = (key: string) => {
        this.polygonSelectComponent.setLockedState(key, false, false);
    }
    meshBuddiesProvider: (key: string) => string[] = (key: string) => {
        return [key];
    };

    ngOnChanges() {
        if (this.viewModes.length === 0 || !this.colorConfigProviders.length) {
            return;
        }

        this.currentViewMode = this.viewModes[0];
        this.currentTooltipProvider = this.currentViewMode.getTooltip();

        this.geoJsonFetcher().subscribe((geoJson) => {
            const meshes = makeGeoJsonPolygons(geoJson, this.colorConfigProviders[0], () => null, () => false, 0.75);
            this.polygonSelectComponent.launch(meshes, this.colorConfigProviders, this.behaviorConfig);
        });
    }
}
