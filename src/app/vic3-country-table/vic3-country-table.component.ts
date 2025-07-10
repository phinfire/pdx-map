import { Component, Input, SimpleChanges, ViewChild } from '@angular/core';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule, MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { TableColumn } from '../util/table/TableColumn';
import { FormsModule } from '@angular/forms';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';

export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
    showDelay: 0,
    hideDelay: 0,
    touchendHideDelay: 0,
};

@Component({
    selector: 'app-table',
    imports: [CommonModule, MatTableModule, MatSortModule, MatTooltipModule, FormsModule, MatMenuModule],
    templateUrl: './vic3-country-table.component.html',
    styleUrl: './vic3-country-table.component.scss',
    providers: [
        { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults }
    ]
})
export class TableComponent<T> {

    @Input() columns: TableColumn<T>[] = [];
    @Input() rowElements: T[] = [];
    @Input() locLookup = new Map<string, string>();

    @ViewChild(MatSort) sort!: MatSort;
    displayedColumns: string[] = [];
    dataSource = new MatTableDataSource<T>([]);
    showTooltips = true;

    constructor() {

    }

    ngAfterViewInit() {
        this.dataSource.sort = this.sort; //necessary for sort to work
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['rowElements'] && this.rowElements) {
            this.dataSource = new MatTableDataSource<any>(this.rowElements);
        }
        if (changes["columns"] && this.columns) {
            this.displayedColumns = this.columns.map(c => c.def);
        }
        this.dataSource.sort = this.sort;
        this.dataSource.sortingDataAccessor = (item, property) => {
            for (const column of this.columns) {
                if (column.def === property) {
                    return column.cellValue(item, 0);
                }
            }
        };
    }

    getCountryName(tag: string) {
        return this.locLookup.get(tag) || tag;
    }

    openMenu(event: MouseEvent, tooltip: string, menuTrigger: MatMenuTrigger) {
        event.preventDefault();
        menuTrigger.menuData = { tooltip };
        menuTrigger.openMenu();
    }
}
