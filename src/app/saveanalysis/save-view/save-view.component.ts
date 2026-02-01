import { CommonModule } from '@angular/common';
import { Component, inject, Input, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Country } from '../../../model/vic/Country';
import { GoodCategory } from '../../../model/vic/enum/GoodCategory';
import { Vic3Save } from '../../../model/vic/Vic3Save';
import { GoodsViewMode } from '../../../ui/GoodViewMode';
import { Vic3MapViewModeProvider } from '../../../services/configuration/Vic3MapViewModeProvider';
import { Vic3TableColumnProvider } from '../../../services/configuration/Vic3TableColumnProvider';
import { PersistenceService } from '../../../services/PersistanceService';
import { LabeledAndIconed } from '../../../ui/LabeledAndIconed';
import { SideNavContentProvider } from '../../../ui/SideNavContentProvider';
import { MapService } from '../../map.service';
import { SaveSaverService } from '../../save-saver.service';
import { SlabMapViewComponent } from '../../slab-map-view/slab-map-view.component';
import { ViewMode } from '../../slab-map-view/ViewMode';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { BehaviorConfigProvider } from '../../viewers/polygon-select/BehaviorConfigProvider';
import { ColorConfigProvider } from '../../viewers/polygon-select/ColorConfigProvider';
import { SaveFileNameDialogComponent } from '../save-filename-dialog.component';
import { LineviewerComponent } from '../../lineviewer/lineviewer.component';
import { LineViewerData } from '../../lineviewer/model/LineViewerData';
import { Vic3SaveSeriesData } from '../../../app/lineviewer/model/Vic3SaveSeriesData';

@Component({
    selector: 'app-save-view',
    imports: [CommonModule, MatTabsModule, TableComponent, MatProgressSpinnerModule, MatRadioModule, FormsModule, MatButtonToggleModule, SlabMapViewComponent, MatIconModule, MatButtonModule, MatTooltipModule, LineviewerComponent],
    templateUrl: './save-view.component.html',
    styleUrl: './save-view.component.scss',
})
export class SaveViewComponent implements OnDestroy {

    @Input() activeSave?: Vic3Save;
    @Input() isFromDatabase = false;

    private persistence = inject(PersistenceService);
    protected columnProvider = inject(Vic3TableColumnProvider);
    private mapViewModeProvider = inject(Vic3MapViewModeProvider);
    private mapService = inject(MapService);
    private saveSaverService = inject(SaveSaverService);
    private snackBar = inject(MatSnackBar);
    private dialog = inject(MatDialog);
    private router = inject(Router);
    sideNavContentProvider = inject(SideNavContentProvider);

    protected availableMapViewModes: LabeledAndIconed<ViewMode>[] = [];

    includeAi = true;
    selectedTabIndex = 0;

    cachedCountries: Country[] = [];

    goodsViewMode = GoodsViewMode.BALANCE;
    selectedGoodsCategory: GoodCategory = GoodCategory.INDUSTRIAL;
    availableGoodsCategories: GoodCategory[] = Object.values(GoodCategory);
    seriesData: LineViewerData | null = null;

    geoJsonFetcher = () => this.mapService.fetchVic3GeoJson(true);
    colorConfigProviders: ColorConfigProvider[] = [];
    behaviorConfig = new BehaviorConfigProvider(0.75);

    private uploadActionHandle: string | null = null;
    private destroy$ = new Subject<void>();

    constructor() {
        this.selectedTabIndex = parseInt(this.persistence.getValue('saveViewTabIndex') || '0');
    }

    ngOnDestroy(): void {
        this.removeToolbarActions();
        this.destroy$.next();
        this.destroy$.complete();
    }

    ngOnInit() {
        const savedIndex = localStorage.getItem('saveViewTabIndex');
        this.selectedTabIndex = savedIndex !== null ? +savedIndex : 0;
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['activeSave'] && this.activeSave) {
            this.onGoodsCategoryChange(this.selectedGoodsCategory);
            this.initializeMapView();
            this.initializeSeriesData();
            this.setupToolbarActions();
        }
    }

    private initializeSeriesData(): void {
        if (this.activeSave) {
            this.seriesData = new Vic3SaveSeriesData(this.activeSave);
        }
    }

    private initializeMapView() {
        this.mapViewModeProvider.getViewModes(this.activeSave!).subscribe(goodViews => {
            const interestingViewModes = this.mapViewModeProvider.getInterestingViewModes(this.activeSave!);
            this.availableMapViewModes = interestingViewModes.concat(goodViews.map(gview => new LabeledAndIconed<ViewMode>("Goods",
                gview.good.getHumanName(),
                gview.good.getIconUrl(),
                gview.view
            )));
        });
    }

    onTabChange(index: number) {
        this.selectedTabIndex = index;
        localStorage.setItem('saveViewTabIndex', index.toString());
        if (this.selectedTabIndex === 7) {
            this.refreshGoodColumnList();
        }
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

    private setupToolbarActions(): void {
        this.removeToolbarActions();
        const uploadAction = this.isFromDatabase ? null : () => this.uploadSave();
        const uploadTooltip = this.isFromDatabase 
            ? 'This save has already been uploaded' 
            : 'Upload save';
        this.uploadActionHandle = this.sideNavContentProvider.addToolbarAction(
            this.isFromDatabase ? 'cloud_done' : 'cloud_upload',
            uploadTooltip,
            uploadAction
        );
    }

    private removeToolbarActions(): void {
        if (this.uploadActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.uploadActionHandle);
            this.uploadActionHandle = null;
        }
    }

    private downloadDemographics(): void {
        if (!this.activeSave) return;

        const countries = this.getCountries();
        const demographics = this.activeSave.getDemographics(countries);
        const jsonStr = JSON.stringify(demographics, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'demographics.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    private uploadSave(): void {
        if (!this.activeSave) return;
        const defaultFileName = this.generateFileName();
        const dialogRef = this.dialog.open(SaveFileNameDialogComponent, {
            width: '400px',
            data: { fileName: defaultFileName }
        });

        dialogRef.afterClosed().pipe(
            takeUntil(this.destroy$)
        ).subscribe((result: string | undefined) => {
            if (!result) return;
            const fileName = result;
            this.snackBar.open(`Uploading ${fileName}...`, undefined, { duration: 0 });
            this.saveSaverService.storeVic3Save(this.activeSave!, fileName).pipe(
                takeUntil(this.destroy$)
            ).subscribe({
                next: (uploadResult) => {
                    this.snackBar.dismiss();
                    if (uploadResult.success) {
                        this.snackBar.open('Save uploaded successfully', 'Close', { duration: 3000 });
                        if (uploadResult.id) {
                            this.router.navigate(['/save', 'vic3', uploadResult.id]);
                        }
                    } else {
                        this.snackBar.open(`Upload failed: ${uploadResult.message}`, 'Close', { duration: 5000 });
                    }
                },
                error: (err) => {
                    console.error('Upload error:', err);
                    this.snackBar.dismiss();
                    this.snackBar.open('Upload failed', 'Close', { duration: 5000 });
                }
            });
        });
    }

    private generateFileName(): string {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        return `vic3_save_${dateStr}_${timeStr}`;
    }

}