import { Component, inject, Input, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Country } from '../../model/vic/Country';
import { GoodCategory } from '../../model/vic/enum/GoodCategory';
import { Vic3Save } from '../../model/vic/Vic3Save';
import { GoodsViewMode } from '../../services/configuration/GoodViewMode';
import { Vic3TableColumnProvider } from '../../services/configuration/Vic3TableColumnProvider';
import { PersistenceService } from '../../services/PersistanceService';
import { SaveSaverService } from '../save-saver.service';
import { MapService } from '../map.service';
import { SlabMapViewComponent } from '../slab-map-view/slab-map-view.component';
import { ViewMode } from '../slab-map-view/ViewMode';
import { TableComponent } from '../vic3-country-table/vic3-country-table.component';
import { BehaviorConfigProvider } from '../viewers/polygon-select/BehaviorConfigProvider';
import { ColorConfigProvider } from '../viewers/polygon-select/ColorConfigProvider';
import { takeUntil, Subject } from 'rxjs';
import { SideNavContentProvider } from '../../ui/SideNavContentProvider';
import { Vic3MapViewModeProvider } from '../../services/configuration/Vic3MapViewModeProvider';
import { MatButtonModule } from '@angular/material/button';
import { Good } from '../../model/vic/game/Good';
import { LabeledAndIconed } from '../../ui/LabeledAndIconed';

@Component({
    selector: 'app-save-view',
    imports: [CommonModule, MatTabsModule, TableComponent, MatProgressSpinnerModule, MatRadioModule, FormsModule, MatButtonToggleModule, SlabMapViewComponent, MatIconModule, MatButtonModule, MatTooltipModule],
    templateUrl: './save-view.component.html',
    styleUrl: './save-view.component.scss',
})
export class SaveViewComponent implements OnDestroy {

    @Input() activeSave?: Vic3Save;

    private persistence = inject(PersistenceService);
    protected columnProvider = inject(Vic3TableColumnProvider);
    private mapViewModeProvider = inject(Vic3MapViewModeProvider);
    private mapService = inject(MapService);
    private saveSaverService = inject(SaveSaverService);
    private snackBar = inject(MatSnackBar);
    private dialog = inject(MatDialog);
    sideNavContentProvider = inject(SideNavContentProvider);

    protected availableMapViewModes: LabeledAndIconed<ViewMode>[] = [];

    includeAi = true;
    selectedTabIndex = 0;

    cachedCountries: Country[] = [];
    goodViews: { good: Good, view: ViewMode }[] = [];

    activeMapViewMode: ViewMode | null = null;
    goodsViewMode = GoodsViewMode.BALANCE;
    selectedGoodsCategory: GoodCategory = GoodCategory.INDUSTRIAL;
    availableGoodsCategories: GoodCategory[] = Object.values(GoodCategory);

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
            this.setupToolbarActions();
        }
    }

    private initializeMapView() {
        if (!this.activeSave) {
            return;
        }
        this.mapViewModeProvider.getViewModes(this.activeSave).subscribe(goodViews => {
            this.goodViews = goodViews
            //this.availableMapViewModes
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

    setActiveMapViewMode(viewMode: ViewMode) {
        this.activeMapViewMode = viewMode;
    }

    getCountries() {
        if (this.cachedCountries.length === 0 && this.activeSave) {
            this.cachedCountries = this.activeSave.getCountries(this.includeAi);
        }
        return this.cachedCountries;
    }

    private setupToolbarActions(): void {
        this.removeToolbarActions();
        this.uploadActionHandle = this.sideNavContentProvider.addToolbarAction(
            'cloud_upload',
            'Upload save',
            () => this.uploadSave()
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

@Component({
    selector: 'app-save-filename-dialog',
    standalone: true,
    imports: [MatDialogModule, FormsModule, MatFormFieldModule, MatInputModule, MatButtonToggleModule],
    template: `
        <div mat-dialog-title>Enter file name</div>
        <mat-dialog-content>
            <mat-form-field appearance="outline" class="full-width">
                <mat-label>File name</mat-label>
                <input matInput [(ngModel)]="fileName" (keyup.enter)="onConfirm()">
            </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button mat-button (click)="onCancel()">Cancel</button>
            <button mat-raised-button color="primary" (click)="onConfirm()">Upload</button>
        </mat-dialog-actions>
    `,
    styles: [`
        .full-width {
            width: 100%;
        }
    `]
})
export class SaveFileNameDialogComponent {
    fileName: string = '';
    private dialogRef = inject(MatDialogRef<SaveFileNameDialogComponent>);
    private data = inject(MAT_DIALOG_DATA);

    constructor() {
        this.fileName = this.data.fileName || '';
    }

    onConfirm(): void {
        if (this.fileName.trim()) {
            this.dialogRef.close(this.fileName);
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}