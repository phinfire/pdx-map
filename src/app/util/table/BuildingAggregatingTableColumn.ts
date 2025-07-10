import { Building } from "../../model/vic/Building";
import { Country } from "../../model/vic/Country";
import { TableColumn } from "./TableColumn";

export class BuildingAggregatingTableColumn extends TableColumn<Country> {

    constructor(def: string, header: string, tooltip: string, sortable: boolean, predicate: (building: Building) => boolean, valueExtractor: (building: Building) => number, predicateForNormalization: ((building: Building) => boolean) | null = null) {
        const cellValue = (element: Country, _: number) => {
            if (predicateForNormalization != null) {
                return element.getBuildings().getTotal(header, b => predicateForNormalization(b) && predicate(b), valueExtractor) / element.getBuildings().getTotal(header + "_norm", predicateForNormalization, valueExtractor)
            }
            return element.getBuildings().getTotal(header, predicate, valueExtractor);
        }
        const cellTooltip = (element: Country, _: number) => {
            const totalExplained = element.getBuildings().getTotalExplanation(header, b => predicate(b) && (predicateForNormalization == null || predicateForNormalization(b)), valueExtractor, building => building.getName());
            const maxValStringLength = Math.max(...Array.from(totalExplained.values()).map(val => this.format(val).length));
            return Array.from(totalExplained.entries()).sort((a, b) => b[1] - a[1])
                .map(([name, val]) => `${this.format(val).padStart(maxValStringLength, ' ')}  ${name}`)
                .join('\n');
        }
        super(def, header, tooltip, sortable, cellValue, cellTooltip);
    }
}