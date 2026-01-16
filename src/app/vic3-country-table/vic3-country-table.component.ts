import { Component, Input, SimpleChanges, ViewChild } from '@angular/core';
import { trigger, transition, style, animate } from '@angular/animations';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule, MAT_TOOLTIP_DEFAULT_OPTIONS, MatTooltipDefaultOptions } from '@angular/material/tooltip';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule } from '@angular/cdk/menu';
import { MatDialog } from '@angular/material/dialog';
import { PlotViewComponent } from '../plot-view/plot-view.component';
import { TableColumn } from '../../util/table/TableColumn';
import { Plotable } from '../plot-view/plot/Plotable';
import { simpleHash } from '../../utils';
import { MatIconModule } from '@angular/material/icon';

export const myCustomTooltipDefaults: MatTooltipDefaultOptions = {
    showDelay: 0,
    hideDelay: 0,
    touchendHideDelay: 0,
};

@Component({
    selector: 'app-table',
    imports: [CommonModule, MatTableModule, MatSortModule, MatTooltipModule, FormsModule, CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule, MatIconModule],
    templateUrl: './vic3-country-table.component.html',
    styleUrl: './vic3-country-table.component.scss',
    providers: [
        { provide: MAT_TOOLTIP_DEFAULT_OPTIONS, useValue: myCustomTooltipDefaults }
    ]
    ,
    animations: [
        trigger('menuFadeScale', [
            transition(':enter', [
                style({ opacity: 0, transform: 'scale(0.95)' }),
                animate('180ms cubic-bezier(0.4,0.0,0.2,1)',
                    style({ opacity: 1, transform: 'scale(1)' })
                )
            ]),
            transition(':leave', [
                animate('120ms cubic-bezier(0.4,0.0,0.2,1)',
                    style({ opacity: 0, transform: 'scale(0.95)' })
                )
            ])
        ])
    ]
})
export class TableComponent<T> {    

    @Input() columns: TableColumn<T>[] = [];
    @Input() rowElements: T[] = [];

    internalColumns: TableColumn<T>[] = [];

    @ViewChild(MatSort) sort!: MatSort;
    displayedColumns: string[] = [];
    dataSource = new MatTableDataSource<T>([]);
    showTooltips = true;

    selectedColumn: TableColumn<T> | null = null;

    constructor(private dialog: MatDialog) {

    }

    protected safeGetCellValue(column: TableColumn<T>, element: T, index: number): any {
        try {
            return column.cellValue(element, index);
        } catch (error) {
            console.warn(`Error getting cell value for column '${column.def}':`, error);
            return null;
        }
    }

    protected safeGetCellTooltip(column: TableColumn<T>, element: T, index: number): string | null {
        try {
            return column.cellTooltip(element, index);
        } catch (error) {
            console.warn(`Error getting cell tooltip for column '${column.def}':`, error);
            return null;
        }
    }

    protected safeGetVisibleCellValue(column: TableColumn<T>, element: T, index: number): any {
        try {
            return column.visibleCellValue(element, index);
        } catch (error) {
            console.warn(`Error getting visible cell value for column '${column.def}':`, error);
            return '-';
        }
    }

    protected safeGetSubscript(column: TableColumn<T>, element: T): string {
        try {
            return column.subscript ? column.subscript(element) : '';
        } catch (error) {
            console.warn(`Error getting subscript for column '${column.def}':`, error);
            return '';
        }
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
        if ((changes['rowElements'] || changes['columns']) && this.columns && this.rowElements) {
            this.internalColumns = [this.columns[0], ...this.columns.slice(1,this.columns.length).map(col => col.finalizeFor(this.rowElements))];
        }
        
        this.dataSource.sort = this.sort;
        this.dataSource.sortingDataAccessor = (item, property) => {
            try {
                for (const column of this.internalColumns) {
                    if (column.def === property) {
                        return this.safeGetCellValue(column, item, 0);
                    }
                }
                return null;
            } catch (error) {
                console.warn(`Error in sortingDataAccessor for property '${property}':`, error);
                return null;
            }
        };
    }

    openPlot() {
        if (!this.selectedColumn) {
            return;
        }
        
        try {
            const hackyNameColumn = this.getNameColumn();
            if (!hackyNameColumn) {
                console.warn('No name column found for plotting');
                return;
            }
            
            const plotables = this.rowElements.map(row => {
                try {
                    const value = this.safeGetCellValue(this.selectedColumn!, row, 0);
                    const label = this.safeGetCellValue(hackyNameColumn, row, 0);
                    const labelHash = simpleHash(label || (Math.random() * 16777215).toString());
                    const zeroOne = (labelHash % 1000) / 1000;
                    const color = '#' + Math.floor(zeroOne * 16777215).toString(16).padStart(6, '0');
                    return new Plotable(label || 'Unknown', value, color);
                } catch (error) {
                    console.warn('Error creating plotable for row:', error);
                    return null;
                }
            }).filter(p => p != null && p.value != null && p.value !== 0) as Plotable[];
            
            if (plotables.length === 0) {
                console.warn('No valid data found for plotting');
                return;
            }
            
            const width = 1400;
            const height = 800;
            this.dialog.open(PlotViewComponent, {
                data: {
                    plotables: Array.from(plotables),
                    plotType: 'bar',
                    title: this.selectedColumn.header
                },
                panelClass: "popup",
                width: width + 'px',
                height: height + 'px'
            });
        } catch (error) {
            console.error('Error opening plot:', error);
        }
    }

    downloadCSV() {
        const nameColumn = this.getNameColumn();
        if (!nameColumn) {
            console.warn('No name column found for CSV export');
            return;
        }
        if (!this.selectedColumn) {
            console.warn('No selected column for CSV export');
            return;
        }

        const rows = this.rowElements.map((row, idx) => {
            const name = this.safeGetCellValue(nameColumn, row, idx);
            const value = this.safeGetCellValue(this.selectedColumn!, row, idx);
            return [name, value];
        });
        const header = [nameColumn.header, this.selectedColumn.header];
        const csvContent = [header, ...rows]
            .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\r\n');

        const name = this.selectedColumn.header.replace(/\s+/g, '_').toLowerCase() + '_data';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = name + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    }

    getNameColumn() {
        const hackyNameColumn = this.columns.find(c => c.def === 'name');
        if (!hackyNameColumn) {
            return null;
        }
        return hackyNameColumn;
    }
}
