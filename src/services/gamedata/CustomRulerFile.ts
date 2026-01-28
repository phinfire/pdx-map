import { Trait } from "../../model/ck3/Trait";

export class CustomRulerFile {

    constructor(public name: string, public age: number, public culture: number, public faith: number, public skills: number[], public traits: Trait[], public educationTrait: Trait | null) {

    }

    getCustomRulerPointCost(): number {
        const ageCost = 0; // TODO: implement age cost calculation
        let traitsCost = this.educationTrait ? this.educationTrait.getRulerDesignerCost() : 0;
        for (const trait of this.traits) {
            traitsCost += trait.getRulerDesignerCost();
        }
        return ageCost + traitsCost;
    }
}