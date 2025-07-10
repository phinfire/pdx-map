export interface ITableColumn<T> {
    def: string;
    header: string;
    tooltip: string | null
    sortable?: boolean;
    cellValue: (element: T, index: number) => any;
    visibleCellValue: (element: T, index: number) => any;
    cellTooltip: (element: T, index: number) => string | null;
    subscript: ((element: T) => string) | null;
}