import { Component, inject, Input, OnDestroy } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { Character } from '../../../model/ck3/Character';
import { CK3TableColumnProvider } from '../../../services/configuration/CK3TableColumnProvider';
import { LabeledAndIconed } from '../../../ui/LabeledAndIconed';
import { TableColumn } from '../../../util/table/TableColumn';
import { TableColumnBuilder } from '../../../util/table/TableColumnBuilder';
import { MapService } from '../../map.service';
import { SlabMapViewComponent } from '../../slab-map-view/slab-map-view.component';
import { ViewMode } from '../../slab-map-view/ViewMode';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { BehaviorConfigProvider } from '../../viewers/polygon-select/BehaviorConfigProvider';
import { Ck3Save } from '../../../model/ck3/Ck3Save';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { SaveSaverService } from '../../save-saver.service';
import { SideNavContentProvider } from '../../../ui/SideNavContentProvider';
import { SaveFileNameDialogComponent } from '../save-filename-dialog.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'app-ck3-save-view',
    imports: [TableComponent, MatTabsModule, MatIconModule, SlabMapViewComponent],
    templateUrl: './ck3-save-view.component.html',
    styleUrl: './ck3-save-view.component.scss'
})
export class Ck3SaveViewComponent implements OnDestroy {

    @Input() activeSave: Ck3Save | null = null;
    @Input() isFromDatabase = false;

    protected rowElements: Character[] = [];
    protected behaviorConfig = new BehaviorConfigProvider(0.75);
    protected availableMapViewModes: LabeledAndIconed<ViewMode>[] = [];
    protected geoJsonFetcher = () => this.mapService.fetchCK3GeoJson(true, false);
    protected columnMap: Map<string, TableColumn<Character>[]> = new Map();
    private mapService = inject(MapService);
    private ck3ColumnProvider = inject(CK3TableColumnProvider);
    private snackBar = inject(MatSnackBar);
    private dialog = inject(MatDialog);
    private router = inject(Router);
    private saveSaverService = inject(SaveSaverService);
    sideNavContentProvider = inject(SideNavContentProvider);

    private uploadActionHandle: string | null = null;
    private destroy$ = new Subject<void>();

    ngOnInit() {
        if (this.activeSave) {
            this.rowElements = this.activeSave.getPlayers()
                .map(player => player.getLastPlayedCharacter())
                .filter((character): character is Character => character != null && character.isAlive());
            const playerColumn = new TableColumnBuilder<Character>("Player")
                .withCellValue((char: Character) => {
                    const player = this.activeSave!.getPlayers()
                        .find(p => p.getLastPlayedCharacter() != null && p.getLastPlayedCharacter()!.getCharacterId() === char.getCharacterId());
                    return player ? player.getName() : "-";
                })
                .build()
            this.columnMap = new Map(Array.from(this.ck3ColumnProvider.getCharacterColumns(),
                ([key, value]) => [key, [TableColumnBuilder.getIndexColumn(), playerColumn, ...value]]));
            this.setupToolbarActions();
        }
    }

    ngOnDestroy(): void {
        this.removeToolbarActions();
        this.destroy$.next();
        this.destroy$.complete();
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
            this.saveSaverService.storeCk3Save(this.activeSave!, fileName).pipe(
                takeUntil(this.destroy$)
            ).subscribe({
                next: (uploadResult) => {
                    this.snackBar.dismiss();
                    if (uploadResult.success) {
                        this.snackBar.open('Save uploaded successfully', 'Close', { duration: 3000 });
                        if (uploadResult.id) {
                            this.router.navigate(['/save', 'ck3', uploadResult.id]);
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
        return `ck3_save_${dateStr}_${timeStr}`;
    }

    getRowElements() {
        return this.rowElements;
    }
}