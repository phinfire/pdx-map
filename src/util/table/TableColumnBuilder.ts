import { TableColumn } from "./TableColumn";
import { ImageIconType } from "./ImageIconType";

export class TableColumnBuilder<T> {

    public static getIndexColumn<T>(offset: number = 0): TableColumn<T> {
        return new TableColumnBuilder<T>('')
            .withCellValue((element: T, index: number) => index + 1 + offset)
            .isSortable(false)
            .build();
    }

    private def: string;
    private header: string;
    private tooltip: string | null = null;
    private sortable: boolean = true;
    private cellValue: ((element: T, index: number) => any) | null = null;
    private cellTooltip: ((element: T, index: number) => string | null) | null = null;
    private subscript: ((element: T) => string) | null = null;
    private isImage: boolean = false;
    private headerImage: string | undefined;
    private headerImageType: ImageIconType | undefined;
    private cellValueTransform: ((value: any) => any) | null = null;

    constructor(header: string) {
        this.header = header;
        this.def = header.length > 0
            ? header.toLowerCase().replace(/\s+/g, '_')
            : `col_${Math.random().toString(36).substring(2, 9)}`;
    }

    withHeader(header: string): this {
        this.header = header;
        return this;
    }

    withTooltip(tooltip: string | null): this {
        this.tooltip = tooltip;
        return this;
    }

    isSortable(sortable: boolean): this {
        this.sortable = sortable;
        return this;
    }

    withCellValue(cellValue: (element: T, index: number) => any): this {
        this.cellValue = cellValue;
        return this;
    }

    withCellTooltip(cellTooltip: (element: T, index: number) => string | null): this {
        this.cellTooltip = cellTooltip;
        return this;
    }

    withSubscript(subscript: (element: T) => string): this {
        this.subscript = subscript;
        return this;
    }

    showCellAsImage(): this {
        this.isImage = true;
        return this;
    }

    withHeaderImage(headerImage: string, headerImageType: ImageIconType): this {
        this.headerImage = headerImage;
        this.headerImageType = headerImageType;
        return this;
    }

    withCellValueTransform(transform: (value: any) => any): this {
        this.cellValueTransform = transform;
        return this;
    }

    build(): TableColumn<T> {
        if (!this.cellValue) {
            throw new Error('cellValue is required');
        }
        return new TableColumn<T>(
            this.def,
            this.header,
            this.tooltip,
            this.sortable,
            this.cellValue,
            this.cellTooltip == null ? (element: T, index: number) => null : this.cellTooltip,
            this.subscript,
            this.isImage,
            this.headerImage,
            this.headerImageType,
            this.cellValueTransform
        );
    }
}
