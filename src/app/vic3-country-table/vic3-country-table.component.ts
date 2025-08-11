import { Component, Input, SimpleChanges, ViewChild } from '@angular/core';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule, MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { TableColumn } from '../util/table/TableColumn';
import { FormsModule } from '@angular/forms';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule } from '@angular/cdk/menu';
import { MatDialog } from '@angular/material/dialog';
import { PlotViewComponent } from '../plot-view/plot-view.component';

export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
    showDelay: 0,
    hideDelay: 0,
    touchendHideDelay: 0,
};

@Component({
    selector: 'app-table',
    imports: [CommonModule, MatTableModule, MatSortModule, MatTooltipModule, FormsModule, CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule],
    templateUrl: './vic3-country-table.component.html',
    styleUrl: './vic3-country-table.component.scss',
    providers: [
        { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults }
    ]
})
export class TableComponent<T> {

    @Input() columns: TableColumn<T>[] = [];
    @Input() rowElements: T[] = [];

    @ViewChild(MatSort) sort!: MatSort;
    displayedColumns: string[] = [];
    dataSource = new MatTableDataSource<T>([]);
    showTooltips = true;

    selectedColumn: TableColumn<T> | null = null;

    constructor(private dialog: MatDialog) {

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

    openPlot() {
        if (this.selectedColumn) {
            const hackyNameColumn = this.columns.find(c => c.def === 'name');
            const plotables = this.rowElements.map(row => {
                const value = this.selectedColumn!.cellValue(row, 0);
                const label = hackyNameColumn!.cellValue(row, 0);
                const color = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                return { value, label, color };
            });
            this.dialog.open(PlotViewComponent, {
                data: {plotables: Array.from(plotables)},
                panelClass: "popup"
            });
        }
    }
}
