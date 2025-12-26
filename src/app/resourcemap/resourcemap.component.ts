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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-resourcemap',
  imports: [SlabMapViewComponent, MatSelectModule, MatFormFieldModule],
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
  selectedResource = 'arable_land';
  private resourceTypes: Map<string, ResourceType> = new Map();
  private resourceViewModes: Map<string, ViewMode<any>> = new Map();
  private resourceColorConfigs: Map<string, ColorConfigProvider> = new Map();

  ngOnInit() {
    this.vic3GameFilesService.getAllAvailableResources().subscribe(resources => {
      this.availableResources = resources;
      this.selectedResource = resources[0] ?? '';
    });

    this.vic3GameFilesService.getResourceTypes().subscribe(types => {
      this.resourceTypes = types;
    });

    this.vic3GameFilesService.getMapStateRegions().subscribe((regions) => {
      for (const resource of this.availableResources) {
        const key2Value = new Map<string, number>();
        
        for (const region of regions) {
          const value = region.getMineralResourceSlot(resource);
          key2Value.set(region.getName(), value);
        }

        const colorConfig = new ValueGradientColorConfig(key2Value);
        const viewMode: ViewMode<any> = {
          getColorConfig: () => colorConfig,
          getTooltip: () => (key: string) => {
            const value = key2Value.get(key) || 0;
            return `<b>${key}</b><br>${this.formatResourceName(resource)}: ${value}`;
          }
        };
        this.resourceViewModes.set(resource, viewMode);
        this.resourceColorConfigs.set(resource, colorConfig);
      }

      this.updateViewModes();
    });
  }

  getResourceCategory(resource: string): string {
    const type = this.resourceTypes.get(resource);
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

  getUniqueResourceCategories(): string[] {
    const categories = new Set<string>();
    for (const resource of this.availableResources) {
      categories.add(this.getResourceCategory(resource));
    }
    const categoryOrder = ['Arable', 'Capped', 'Discoverable', 'Other'];
    return categoryOrder.filter(cat => categories.has(cat));
  }

  getResourcesByCategory(category: string): string[] {
    return this.availableResources.filter(resource => this.getResourceCategory(resource) === category);
  }

  onResourceSelected(resource: string) {
    this.selectedResource = resource;
    this.updateViewModes();
  }

  private updateViewModes() {
    const viewMode = this.resourceViewModes.get(this.selectedResource);
    const colorConfig = this.resourceColorConfigs.get(this.selectedResource);
    if (viewMode && colorConfig) {
      this.viewModes = [viewMode];
      this.colorConfigProviders = [colorConfig];
    }
  }

  formatResourceName(resource: string): string {
    const formatted = resource.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return formatted.substring(3, formatted.length).split(" ")[0];
  }
}
