import { Component, inject, OnInit } from '@angular/core';
import { SlabMapViewComponent } from '../slab-map-view/slab-map-view.component';
import { ViewModeProvider } from '../slab-map-view/ViewModeProvider';
import { ViewMode } from '../slab-map-view/ViewMode';
import { ColorConfigProvider } from '../viewers/polygon-select/ColorConfigProvider';
import { BehaviorConfigProvider } from '../viewers/polygon-select/BehaviorConfigProvider';
import { MapService } from '../map.service';
import { Vic3GameFilesService } from '../../model/vic/Vic3GameFilesService';
import { ResourceType } from '../../model/vic/enum/ResourceType';
import { ValueGradientColorConfig } from '../viewers/polygon-select/DynamicColorConfig';
import { MatButtonModule, MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Good } from '../../model/vic/game/Good';
const EXCLUDED_RESOURCES = ['bg_monuments'];

const RESOURCE_GROUPS: Record<string, { members: string[] }> = {
    'grain': {
        members: ['bg_maize_farms', 'bg_millet_farms', 'bg_rice_farms', 'bg_rye_farms', 'bg_wheat_farms',
                   'building_maize_farm', 'building_millet_farm', 'building_rice_farm', 'building_rye_farm', 'building_wheat_farm']
    }
};

@Component({
    selector: 'app-resourcemap',
    imports: [SlabMapViewComponent, MatIconButton, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './resourcemap.component.html',
    styleUrl: './resourcemap.component.scss',
})
export class ResourcemapComponent implements OnInit {
    
    mapService = inject(MapService);
    vic3GameFilesService = inject(Vic3GameFilesService);

    geoJsonFetcher = () => this.mapService.fetchVic3GeoJson(true);
    viewModes: ViewMode<any>[] = [];
    colorConfigProviders: ColorConfigProvider[] = [];
    behaviorConfig = new BehaviorConfigProvider(0.75);

    availableResources: string[] = [];
    selectedResource: string | null = null;
    private resourceTypes: Map<string, ResourceType> = new Map();
    private resourceViewModes: Map<string, ViewMode<any>> = new Map();
    private resourceColorConfigs: Map<string, ColorConfigProvider> = new Map();
    private goodsMap: Map<string, Good> = new Map();

    resourcesByCategory: Map<string, string[]> = new Map();
    categoryOrder = ['Arable', 'Capped', 'Discoverable', 'Other'];

    ngOnInit() {
        this.vic3GameFilesService.getGoods().subscribe(goods => {
            this.goodsMap.clear();
            for (const good of goods) {
                this.goodsMap.set(good.key, good);
            }
        });
        this.vic3GameFilesService.getAllAvailableResources().subscribe(resources => {
            this.availableResources = resources;
            this.buildResourcesByCategory();
        });
        this.vic3GameFilesService.getResourceTypes().subscribe(types => {
            this.resourceTypes = types;
            this.buildResourcesByCategory();
        });
        this.vic3GameFilesService.getMapStateRegions().subscribe((regions) => {
            const displayedResources = this.getDisplayedResources();
            for (const displayResource of displayedResources) {
                const resourceGroup = RESOURCE_GROUPS[displayResource];
                const actualResources = resourceGroup ? resourceGroup.members : [displayResource];
                const key2Value = new Map<string, number>();

                for (const region of regions) {
                    let totalValue = 0;
                    for (const actualResource of actualResources) {
                        totalValue += region.getMineralResourceSlot(actualResource);
                    }
                    key2Value.set(region.getName(), totalValue);
                }
                const colorConfig = new ValueGradientColorConfig(key2Value);
                const viewMode: ViewMode<any> = {
                    getColorConfig: () => colorConfig,
                    getTooltip: () => (key: string) => {
                        const totalValue = key2Value.get(key) || 0;
                        return `<b>${key}</b><br>${this.formatResourceName(displayResource)}: ${totalValue}`;
                    }
                };
                this.resourceViewModes.set(displayResource, viewMode);
                this.resourceColorConfigs.set(displayResource, colorConfig);
            }

            this.updateViewModes();
        });
    }

    private getDisplayedResources(): string[] {
        const displayed = new Set<string>();
        for (const groupKey of Object.keys(RESOURCE_GROUPS)) {
            displayed.add(groupKey);
        }
        for (const resource of this.availableResources) {
            if (EXCLUDED_RESOURCES.includes(resource)) {
                continue;
            }
            
            let isInGroup = false;
            for (const groupData of Object.values(RESOURCE_GROUPS)) {
                if (groupData.members.includes(resource)) {
                    isInGroup = true;
                    break;
                }
            }
            
            if (!isInGroup) {
                displayed.add(resource);
            }
        }
        
        return Array.from(displayed);
    }

    getResourceCategory(resource: string): string {
        const type = this.resourceTypes.get(resource);
        return this.mapTypeToCategory(type);
    }

    private mapTypeToCategory(type: ResourceType | undefined): string {
        switch (type) {
            case ResourceType.ARABLE:
                return 'Arable';
            case ResourceType.CAPPED:
                return 'Capped';
            case ResourceType.UNCAPPED:
                return 'Discoverable';
            default:
                return 'Other';
        }
    }

    private buildResourcesByCategory() {
        this.resourcesByCategory.clear();
        const displayedResources = this.getDisplayedResources();
        for (const category of this.categoryOrder) {
            this.resourcesByCategory.set(category,
                displayedResources.filter(resource => this.getResourceCategory(resource) === category)
            );
        }
    }

    toggleResource(resource: string) {
        if (this.selectedResource === resource) {
            this.selectedResource = null;
            this.viewModes = [];
            this.colorConfigProviders = [];
        } else {
            this.selectedResource = resource;
            this.updateViewModes();
        }
    }

    isResourceSelected(resource: string): boolean {
        return this.selectedResource === resource;
    }

    private updateViewModes() {
        if (!this.selectedResource) {
            this.viewModes = [];
            this.colorConfigProviders = [];
            return;
        }
        const viewMode = this.resourceViewModes.get(this.selectedResource);
        const colorConfig = this.resourceColorConfigs.get(this.selectedResource);
        if (viewMode && colorConfig) {
            this.viewModes = [viewMode];
            this.colorConfigProviders = [colorConfig];
        }
    }

    getIconPath(resource: string): string | null {
        const resourceGroup = RESOURCE_GROUPS[resource];
        const resourceToMap = resourceGroup ? resourceGroup.members[0] : resource;
        const goodName = this.vic3GameFilesService.mapResourceToGood(resourceToMap);
        if (!goodName) {
            return null;
        }
        const good = this.goodsMap.get(goodName);
        if (good) {
            return good.getIconUrl();
        }
        return null;
    }

    formatResourceName(resource: string): string {
        if (RESOURCE_GROUPS[resource]) {
            return resource.charAt(0).toUpperCase() + resource.slice(1);
        }
        return resource.replace("building_", "").replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
}
