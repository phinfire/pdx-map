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

const RESOURCE_GROUPS: Record<string, { members: string[], displayName: string }> = {
    'grains': {
        members: ['bg_maize_farms', 'bg_millet_farms', 'bg_rice_farms', 'bg_rye_farms', 'bg_wheat_farms'],
        displayName: 'Grain',
    },
    'gold': {
        members: ['bg_gold_mining', 'bg_gold_fields'],
        displayName: 'Gold',
    },
};

const RESOURCE_GROUP_CATEGORIES: Record<string, string> = {
    'gold': 'Discoverable',
};

@Component({
    selector: 'app-resourcemap',
    imports: [SlabMapViewComponent, MatIconButton, MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './resourcemap.component.html',
    styleUrl: './resourcemap.component.scss',
})
export class ResourcemapComponent implements OnInit {
    viewModeProvider = inject(ViewModeProvider);
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
    private resourceToGoodMap: Map<string, Good> = new Map();

    resourcesByCategory: Map<string, string[]> = new Map();
    categoryOrder = ['Arable', 'Capped', 'Discoverable', 'Other'];

    ngOnInit() {
        this.vic3GameFilesService.getAllAvailableResources().subscribe(resources => {
            this.availableResources = resources;
            for (const resource of resources) {
                this.vic3GameFilesService.mapResourceToGood(resource).subscribe(good => {
                    if (good) {
                        console.log(`Mapped resource ${resource} to good ${good.key}`);
                        this.resourceToGoodMap.set(resource, good);
                    }
                });
            }
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
                        if (resourceGroup) {
                            const presentGrains = resourceGroup.members
                                .filter(res => {
                                    const regions_arr = Array.from(regions);
                                    const region = regions_arr.find(r => r.getName() === key);
                                    return region && region.getMineralResourceSlot(res) > 0;
                                })
                                .map(res => this.formatResourceName(res))
                                .join(', ');

                            const tooltip = presentGrains
                                ? `<b>${key}</b><br>${this.formatResourceName(displayResource)}: ${totalValue} (${presentGrains})`
                                : `<b>${key}</b><br>${this.formatResourceName(displayResource)}: ${totalValue}`;
                            return tooltip;
                        } else {
                            return `<b>${key}</b><br>${this.formatResourceName(displayResource)}: ${totalValue}`;
                        }
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
        if (RESOURCE_GROUPS[resource]) {
            if (RESOURCE_GROUP_CATEGORIES[resource]) {
                return RESOURCE_GROUP_CATEGORIES[resource];
            }
            const firstMemberType = this.resourceTypes.get(RESOURCE_GROUPS[resource].members[0]);
            return this.mapTypeToCategory(firstMemberType);
        }

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

    getIconPath(resource: string) {
        const good = this.resourceToGoodMap.get(resource);
        if (good) {
            return good.getIconUrl();
        }
        return null;
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

    formatResourceName(resource: string): string {
        const good = this.resourceToGoodMap.get(resource);
        if (good) {
            return good.key.charAt(0).toUpperCase() + good.key.slice(1);
        }
        if (RESOURCE_GROUPS[resource]) {
            return RESOURCE_GROUPS[resource].displayName;
        }
        return resource.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
}
