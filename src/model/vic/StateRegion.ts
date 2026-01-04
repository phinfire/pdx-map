import { PopulationStatBlock } from "./PopulationStatBlock";

export class StateRegion {

    public static fromRawData(rawData: any, index: number): StateRegion {
        const stateName = rawData["region"];
        const ownerCountryIndex = rawData["owner"];
        const infrastructure = rawData["infrastructure"] || 0;
        const infraStructureUsage = rawData["infrastructure_usage"] || 0;
        const wage = rawData["wage"] || 0;

        const populationStatBlock = new PopulationStatBlock(
            rawData["population_lower_strata"] || 0,
            rawData["population_middle_strata"] || 0,
            rawData["population_upper_strata"] || 0,
            rawData["population_radicals"] || 0,
            rawData["population_loyalists"] || 0,
            rawData["population_political_participants"] || 0,
            rawData["population_salaried_workforce"] || 0,
            rawData["population_subsisting_workforce"] || 0,
            rawData["population_unemployed_workforce"] || 0,
            rawData["population_government_workforce"] || 0,
            rawData["population_laborer_workforce"] || 0,
            wage,
            rawData["total_wealth"] || 0
        );

        return new StateRegion(
            index,
            stateName,
            ownerCountryIndex,
            infrastructure,
            infraStructureUsage,
            wage,
            populationStatBlock
        );
    }

    constructor(private indexInSaveFile: number, private stateName: string, private ownerCountryIndex: number, private infrastructure: number, private infraStructureUsage: number,
        private wage: number, private populationStatBlock: PopulationStatBlock
    ) {

    }

    getOwnerCountryIndex() {
        return this.ownerCountryIndex;
    }

    getIndexInSaveFile() {
        return this.indexInSaveFile;
    }

    toJson() {
        return {
            "indexInSaveFile": this.indexInSaveFile,
            "stateName": this.stateName,
            "ownerCountryIndex": this.ownerCountryIndex,
            "infrastructure": this.infrastructure,
            "infrastructureUsage": this.infraStructureUsage,
            "wage": this.wage,
            "populationStatBlock": this.populationStatBlock.toJson()
        };
    }
}