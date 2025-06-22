import { Building } from "../model/vic/Building";
import { Country } from "../model/vic/Country";
import { TableColumn } from "./TableColumn";

export class BuildingAggregatingTableColumn extends TableColumn<Country> {

    constructor(def: string, header: string, tooltip: string, sortable: boolean, predicate: (building: Building) => boolean, valueExtractor: (building: Building) => number) {
        const cellValue = (element: Country, _: number) => {
            return element.getBuildings().getTotal(header, predicate, valueExtractor);
        }
        const cellTooltip = (element: Country, _: number) => {
            const totalExplained = element.getBuildings().getTotalExplanation(header, predicate, valueExtractor, building => building.getName());
            const maxValStringLength = Math.max(...Array.from(totalExplained.values()).map(val => this.format(val).length));
            return Array.from(totalExplained.entries()).sort((a, b) => b[1] - a[1])
                .map(([name, val]) => `${this.format(val).padStart(maxValStringLength, ' ')}  ${name}`)
                .join('\n');
        }
        super(def, header, tooltip, sortable, cellValue, cellTooltip);
    }
}