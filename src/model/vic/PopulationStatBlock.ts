export class PopulationStatBlock {

    constructor(
        readonly lowerStrataPopulation: number,
        readonly middleStrataPopulation: number,
        readonly upperStrataPopulation: number,
        readonly radicals: number,
        readonly loyalists: number,
        readonly politicalParticipants: number,
        readonly salariedWorkforce: number,
        readonly subsistingWorkforce: number,
        readonly unemployedWorkforce: number,
        readonly governmentWorkforce: number,
        readonly laborerWorkforce: number,
        readonly wage: number,
        readonly totalWealth: number
    ) {}

    toJson() {
        return {
            "lowerStrataPopulation": this.lowerStrataPopulation,
            "middleStrataPopulation": this.middleStrataPopulation,
            "upperStrataPopulation": this.upperStrataPopulation,
            "radicals": this.radicals,
            "loyalists": this.loyalists,
            "politicalParticipants": this.politicalParticipants,
            "salariedWorkforce": this.salariedWorkforce,
            "subsistingWorkforce": this.subsistingWorkforce,
            "unemployedWorkforce": this.unemployedWorkforce,
            "governmentWorkforce": this.governmentWorkforce,
            "laborerWorkforce": this.laborerWorkforce,
            "wage": this.wage,
            "totalWealth": this.totalWealth
        };
    }
}