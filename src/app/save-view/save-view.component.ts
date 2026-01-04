import { Component, inject, Input, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatTabsModule } from '@angular/material/tabs';
import { Country } from '../../model/vic/Country';
import { GoodCategory } from '../../model/vic/enum/GoodCategory';
import { Vic3Save } from '../../model/vic/Vic3Save';
import { GoodsViewMode } from '../../services/configuration/GoodViewMode';
import { Vic3TableColumnProvider } from '../../services/configuration/Vic3TableColumnProvider';
import { PersistenceService } from '../../services/PersistanceService';
import { MapService } from '../map.service';
import { SlabMapViewComponent } from '../slab-map-view/slab-map-view.component';
import { ViewMode } from '../slab-map-view/ViewMode';
import { TableComponent } from '../vic3-country-table/vic3-country-table.component';
import { BehaviorConfigProvider } from '../viewers/polygon-select/BehaviorConfigProvider';
import { ColorConfigProvider } from '../viewers/polygon-select/ColorConfigProvider';

@Component({
    selector: 'app-save-view',
    imports: [MatTabsModule, TableComponent, MatProgressSpinnerModule, MatRadioModule, FormsModule, MatButtonToggleModule, SlabMapViewComponent, MatIconModule],
    templateUrl: './save-view.component.html',
    styleUrl: './save-view.component.scss',
})
export class SaveViewComponent {

    @Input() activeSave?: Vic3Save;

    private persistence = inject(PersistenceService);
    protected columnProvider = inject(Vic3TableColumnProvider);
    private mapService = inject(MapService);

    includeAi = true;
    selectedTabIndex = 0;

    cachedCountries: Country[] = [];

    goodsViewMode = GoodsViewMode.BALANCE;
    selectedGoodsCategory: GoodCategory = GoodCategory.INDUSTRIAL;
    availableGoodsCategories: GoodCategory[] = Object.values(GoodCategory);

    geoJsonFetcher = () => this.mapService.fetchVic3GeoJson(true);
    viewModes: ViewMode<any>[] = [];
    colorConfigProviders: ColorConfigProvider[] = [];
    behaviorConfig = new BehaviorConfigProvider(0.75);

    constructor() {
        this.selectedTabIndex = parseInt(this.persistence.getValue('saveViewTabIndex') || '0');
    }

    ngOnInit() {
        const savedIndex = localStorage.getItem('saveViewTabIndex');
        this.selectedTabIndex = savedIndex !== null ? +savedIndex : 0;
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['activeSave'] && this.activeSave) {
            this.onGoodsCategoryChange(this.selectedGoodsCategory);
            this.initializeMapView();
        }
    }

    private initializeMapView() {
        if (!this.activeSave) {
            return;
        }
        const colorConfig = new ColorConfigProvider(new Map<string, number>(), true);
        const viewMode: ViewMode<any> = {
            getColorConfig: () => colorConfig,
            getTooltip: () => (key: string) => `<b>${key}</b>`
        };

        this.viewModes = [viewMode];
        this.colorConfigProviders = [colorConfig];
    }

    onTabChange(index: number) {
        this.selectedTabIndex = index;
        localStorage.setItem('saveViewTabIndex', index.toString());
    }

    onGoodsViewModeChange(mode: string) {
        const asEnum = [GoodsViewMode.INPUT, GoodsViewMode.OUTPUT, GoodsViewMode.BALANCE].find(m => m === mode);
        if (asEnum) {
            this.goodsViewMode = asEnum;
            this.refreshGoodColumnList();
        } else {
            throw new Error(`Invalid goods view mode: ${mode}`);
        }
    }

    onGoodsCategoryChange(category: GoodCategory) {
        this.selectedGoodsCategory = category;
        this.refreshGoodColumnList();
    }

    refreshGoodColumnList() {
        if (this.activeSave) {
            this.columnProvider.refreshGoodColumnList(this.getCountries(), this.goodsViewMode, this.selectedGoodsCategory);
        }
    }

    getCountries() {
        if (this.cachedCountries.length === 0 && this.activeSave) {
            this.cachedCountries = this.activeSave.getCountries(this.includeAi);
        }
        return this.cachedCountries;
    }
}
