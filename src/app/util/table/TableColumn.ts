import { ModelElementList } from "../../model/vic/ModelElementList";
import { ITableColumn } from "./ITableColumn";

export class TableColumn<T> implements ITableColumn<T> {

    public readonly visibleCellValue: (element: T, index: number) => any;

    constructor(public readonly def: string, public readonly header: string, public tooltip: string | null, public readonly sortable: boolean, public readonly cellValue: (element: T, index: number) => any, public readonly cellTooltip: (element: T, index: number) => string | null, public readonly subscript: ((element: T) => string) | null = null) {
        this.visibleCellValue = (element: T, index: number) => {
            const value = this.cellValue(element, index);
            if (typeof value === 'number') {
                return this.format(value);
            }
            return value;
        }   
    }

    protected format(value: number): string {
        return TableColumn.formatNumber(value);
    }

    public static formatNumber(value: number): string {
        if (value < 0) {
            return '-' + TableColumn.formatNumber(-value);
        }
        if (value === 0) {
            return '0';
        }
        if (value < 1) {
            return value.toFixed(2);
        }
        if (value < 1000) {
            return Math.floor(value) == value ? value.toString() : value.toFixed(1);
        } else if (value < 1000000) {
            return (value / 1000).toFixed(1) + 'K';
        } else {
            return (value / 1000000).toFixed(1) + 'M';
        }
    }
}