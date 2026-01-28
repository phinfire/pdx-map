import { Component, inject, Input } from '@angular/core';
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

@Component({
    selector: 'app-ck3-save-view',
    imports: [TableComponent, MatTabsModule, MatIconModule, SlabMapViewComponent],
    templateUrl: './ck3-save-view.component.html',
    styleUrl: './ck3-save-view.component.scss'
})
export class Ck3SaveViewComponent {

    @Input() activeSave: Ck3Save | null = null;

    protected rowElements: Character[] = [];
    protected behaviorConfig = new BehaviorConfigProvider(0.75);
    protected availableMapViewModes: LabeledAndIconed<ViewMode>[] = [];
    protected geoJsonFetcher = () => this.mapService.fetchCK3GeoJson(true, false);
    protected columnMap: Map<string, TableColumn<Character>[]> = new Map();
    private mapService = inject(MapService);
    private ck3ColumnProvider = inject(CK3TableColumnProvider);

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
        }
    }

    getRowElements() {
        return this.rowElements;
    }
}