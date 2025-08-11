import { Component, Input, SimpleChanges } from '@angular/core';
import { PdxFileService } from '../services/pdx-file.service';
import { HttpClient } from '@angular/common/http';
import { MatTabsModule } from '@angular/material/tabs';
import { Country } from '../model/vic/Country';
import { TableComponent } from '../vic3-country-table/vic3-country-table.component';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TableColumn } from '../util/table/TableColumn';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { ModelElementList } from '../model/vic/ModelElementList';
import { PlotViewComponent } from '../plot-view/plot-view.component';
import { Vic3GameFiles } from '../model/vic/Vic3GameFiles';
import { Vic3Save } from '../model/vic/Vic3Save';
import { GoodCategory } from '../model/vic/enum/GoodCategory';
import { Vic3TableColumnProvider } from '../services/configuration/Vic3TableColumnProvider';
import { PersistenceService } from '../services/PersistanceService';
import { GoodsViewMode } from '../services/configuration/GoodViewMode';

@Component({
    selector: 'app-save-view',
    imports: [MatTabsModule, TableComponent, MatProgressSpinnerModule, CommonModule, MatRadioModule, FormsModule, MatButtonToggleModule, PlotViewComponent],
    templateUrl: './save-view.component.html',
    styleUrl: './save-view.component.scss',
})
export class SaveViewComponent {

    @Input() activeSave?: Vic3Save;

    includeAi = true;
    selectedTabIndex = 0;

    cachedCountries: Country[] = [];

    goodsViewMode = GoodsViewMode.BALANCE;
    selectedGoodsCategory: GoodCategory = GoodCategory.INDUSTRIAL;
    availableGoodsCategories: GoodCategory[] = Object.values(GoodCategory);

    constructor(private http: HttpClient, private persistence: PersistenceService, private vic3GameFiles: Vic3GameFiles, public columnProvider: Vic3TableColumnProvider) {
        this.selectedTabIndex = parseInt(this.persistence.getValue('saveViewTabIndex') || '0');
    }

    ngOnInit() {
        const savedIndex = localStorage.getItem('saveViewTabIndex');
        this.selectedTabIndex = savedIndex !== null ? +savedIndex : 0;
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['activeSave'] && this.activeSave) {
            this.onGoodsCategoryChange(this.selectedGoodsCategory);
        }
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
