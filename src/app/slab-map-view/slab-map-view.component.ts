import { Component, inject, Input, ViewChild } from '@angular/core';
import { Vic3Save } from '../../model/vic/Vic3Save';
import { Ck3Save } from '../../model/Ck3Save';
import { PolygonSelectComponent } from '../viewers/polygon-select/polygon-select.component';
import { makeGeoJsonPolygons } from '../../util/geometry/threeGeometry';
import { MapService } from '../map.service';
import { ColorConfigProvider } from '../viewers/polygon-select/ColorConfigProvider';
import { Eu4Save } from '../../model/eu4/Eu4Save';
import { BehaviorConfigProvider } from '../viewers/polygon-select/BehaviorConfigProvider';
import { ViewMode } from './ViewMode';
import { ICk3Save } from '../../model/ck3/save/ICk3Save';
import { ViewModeProvider } from './ViewModeProvider';

@Component({
    selector: 'app-slab-map-view',
    imports: [PolygonSelectComponent],
    templateUrl: './slab-map-view.component.html',
    styleUrl: './slab-map-view.component.scss'
})
export class SlabMapViewComponent {

    mapService = inject(MapService);
    viewModeProvider = inject(ViewModeProvider);

    @Input() save: Ck3Save | Vic3Save | Eu4Save | null = null;
    @ViewChild('polygonSelect') polygonSelectComponent!: PolygonSelectComponent;

    key2Province: Map<string, any> = new Map<string, any>();

    protected viewMode: ViewMode<any> = new class implements ViewMode<any> {

        getColorConfig(): ColorConfigProvider {
            return new ColorConfigProvider(new Map<string, number>());
        }
        getTooltip(): (key: string) => string {
            return (key: string) => {
                return "";
            };
        }

    };

    private viewModes: ViewMode<any>[] = [];

    getCustomButtons() {
        return [
        {
            icon: 'arrow_forward',
            title: 'Next view mode',
            action: () => {
                if (this.viewModes.length > 1) {
                    const currentIndex = this.viewModes.indexOf(this.viewMode);
                    const nextIndex = (currentIndex + 1) % this.viewModes.length;
                    this.viewMode = this.viewModes[nextIndex];
                }
            }
        }
    ];
    }

    selectionCallback = (key: string) => {
        
    }
    meshBuddiesProvider: (key: string) => string[] = (key: string) => {
        return [key];
    };

    ngOnChanges() {
        if (this.save) {
            if (this.save instanceof Eu4Save) {
                this.mapService.fetchEU4GeoJson(true, false).subscribe((geoJson) => {
                    //this.colorConfigProvider = this.buildColorProviderForEu4();
                    //this.key2Province = this.buildProvinceMapForEu4();
                    //const meshes = makeGeoJsonPolygons(geoJson, this.colorConfigProvider, () => null, () => false, 0.75);
                    //this.polygonSelectComponent.launch(meshes, [this.colorConfigProvider!], new BehaviorConfigProvider(0.75));
                });
            } else if (this.save instanceof Ck3Save) {
                this.mapService.fetchCK3GeoJson(true, false).subscribe((geoJson) => {
                    this.viewModes = this.viewModeProvider.buildViewModesForCk3(this.save as ICk3Save);
                    this.viewMode = this.viewModes[0];
                    const meshes = makeGeoJsonPolygons(geoJson, this.viewMode.getColorConfig(), () => null, () => false, 0.75);
                    this.polygonSelectComponent.launch(meshes, [this.viewMode.getColorConfig()], new BehaviorConfigProvider(0.75));
                });
            }
        }
    }
}
