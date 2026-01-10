import { AggregatingTableColumn } from "./AggregatingTableColumn";
import { HasElements } from "./HasElements";

export class AggregatingTableColumnBuilder<C extends HasElements<E>, E> {
    private def: string;
    private header: string;
    private tooltip: string = "";
    private sortable: boolean = true;
    private predicate: ((element: E) => boolean) | null = null;
    private valueExtractor: ((element: E) => number) | null = null;
    private nameGetter: ((element: E) => string) | null = null;
    private predicateForNormalization: ((element: E) => boolean) | null = null;

    constructor(def: string, header: string) {
        this.def = def;
        this.header = header;
    }

    withTooltip(tooltip: string): this {
        this.tooltip = tooltip;
        return this;
    }

    isSortable(sortable: boolean): this {
        this.sortable = sortable;
        return this;
    }

    withPredicate(predicate: (element: E) => boolean): this {
        this.predicate = predicate;
        return this;
    }

    withValueExtractor(valueExtractor: (element: E) => number): this {
        this.valueExtractor = valueExtractor;
        return this;
    }

    withNameGetter(nameGetter: (element: E) => string): this {
        this.nameGetter = nameGetter;
        return this;
    }

    withPredicateForNormalization(predicate: (element: E) => boolean): this {
        this.predicateForNormalization = predicate;
        return this;
    }

    build(): AggregatingTableColumn<C, E> {
        if (!this.predicate) {
            throw new Error('predicate is required');
        }
        if (!this.valueExtractor) {
            throw new Error('valueExtractor is required');
        }
        if (!this.nameGetter) {
            throw new Error('nameGetter is required');
        }
        return new AggregatingTableColumn<C, E>(
            this.def,
            this.header,
            this.tooltip,
            this.sortable,
            this.predicate,
            this.valueExtractor,
            this.nameGetter,
            this.predicateForNormalization
        );
    }
}
