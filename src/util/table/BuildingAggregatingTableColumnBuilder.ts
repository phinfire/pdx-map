import { Building } from "../../model/vic/Building";
import { Country } from "../../model/vic/Country";
import { BuildingAggregatingTableColumn } from "./BuildingAggregatingTableColumn";
import { AggregatingTableColumnBuilder } from "./AggregatingTableColumnBuilder";

export class BuildingAggregatingTableColumnBuilder extends AggregatingTableColumnBuilder<Country, Building> {

    constructor(def: string, header: string) {
        super(def, header);
        this.withNameGetter((building: Building) => building.getName());
    }

    override build(): BuildingAggregatingTableColumn {
        if (!this['predicate']) {
            throw new Error('predicate is required');
        }
        if (!this['valueExtractor']) {
            throw new Error('valueExtractor is required');
        }
        return new BuildingAggregatingTableColumn(
            this['def'],
            this['header'],
            this['tooltip'],
            this['sortable'],
            this['predicate'],
            this['valueExtractor'],
            this['predicateForNormalization']
        );
    }
}
