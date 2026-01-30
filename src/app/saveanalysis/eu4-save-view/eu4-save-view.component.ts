import { Component, inject, Input, OnDestroy, SimpleChanges } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Eu4Save } from '../../../model/games/eu4/Eu4Save';
import { Eu4SaveCountry } from '../../../model/games/eu4/Eu4SaveCountry';
import { TableColumn } from '../../../util/table/TableColumn';
import { TableColumnBuilder } from '../../../util/table/TableColumnBuilder';
import { MapService } from '../../map.service';
import { SaveSaverService } from '../../save-saver.service';
import { SlabMapViewComponent } from '../../slab-map-view/slab-map-view.component';
import { ViewMode } from '../../slab-map-view/ViewMode';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { BehaviorConfigProvider } from '../../viewers/polygon-select/BehaviorConfigProvider';
import { LabeledAndIconed } from '../../../ui/LabeledAndIconed';
import { SideNavContentProvider } from '../../../ui/SideNavContentProvider';
import { SaveFileNameDialogComponent } from '../save-filename-dialog.component';

@Component({
  selector: 'app-eu4-save-view',
  imports: [TableComponent, MatTabsModule, MatIconModule, SlabMapViewComponent],
  templateUrl: './eu4-save-view.component.html',
  styleUrl: './eu4-save-view.component.scss',
})
export class Eu4SaveViewComponent implements OnDestroy {

  @Input() activeSave: Eu4Save | null = null;
  @Input() isFromDatabase = false;

  protected rowElements: Eu4SaveCountry[] = [];
  protected behaviorConfig = new BehaviorConfigProvider(0.75);
  protected availableMapViewModes: LabeledAndIconed<ViewMode>[] = [];
  protected geoJsonFetcher = () => this.mapService.fetchEU4GeoJson(true, false);
  protected columns: TableColumn<Eu4SaveCountry>[] = [];
  
  private mapService = inject(MapService);
  private saveSaverService = inject(SaveSaverService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private sideNavContentProvider = inject(SideNavContentProvider);

  private uploadActionHandle: string | null = null;
  private destroy$ = new Subject<void>();

  ngOnDestroy(): void {
    this.removeToolbarActions();
    this.destroy$.next();
    this.destroy$.complete();
  }

  ngOnInit() {
    if (this.activeSave) {
      const countryTags = Array.from(this.activeSave.getAllExistingCountryTags());
      this.rowElements = countryTags
        .map(tag => this.activeSave!.getCountry(tag))
        .filter((country): country is Eu4SaveCountry => country != null);

      this.columns = [
        TableColumnBuilder.getIndexColumn<Eu4SaveCountry>(),
        new TableColumnBuilder<Eu4SaveCountry>("Tag")
          .withCellValue((country: Eu4SaveCountry) => country.getTag())
          .build(),
        new TableColumnBuilder<Eu4SaveCountry>("Player")
          .withCellValue((country: Eu4SaveCountry) => country.getPlayerName())
          .build(),
        new TableColumnBuilder<Eu4SaveCountry>("Development")
          .withCellValue((country: Eu4SaveCountry) => 
            this.activeSave ? this.activeSave.getTotalCountryDevelopment(country.getTag()) : 0
          )
          .build()
      ];
      this.setupToolbarActions();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['activeSave'] && this.activeSave) {
      this.setupToolbarActions();
    }
  }

  private setupToolbarActions(): void {
    this.removeToolbarActions();
    const uploadAction = this.isFromDatabase ? null : () => this.uploadSave();
    const uploadTooltip = this.isFromDatabase 
      ? 'This save has already been uploaded' 
      : 'Upload save';
    this.uploadActionHandle = this.sideNavContentProvider.addToolbarAction(
      'cloud_upload',
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
      this.saveSaverService.storeEu4Save(this.activeSave!, fileName, new Date()).pipe(
        takeUntil(this.destroy$)
      ).subscribe({
        next: (uploadResult) => {
          this.snackBar.dismiss();
          if (uploadResult.success) {
            this.snackBar.open('Save uploaded successfully', 'Close', { duration: 3000 });
            if (uploadResult.id) {
              this.router.navigate(['/save', 'eu4', uploadResult.id]);
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
    return `eu4_save_${dateStr}_${timeStr}`;
  }

  getRowElements() {
    return this.rowElements;
  }
}
