import { Trait } from "../../model/ck3/Trait";

export class CustomRulerFile {

    constructor(public name: string, public age: number, public culture: number, public faith: number, public traits: Trait[], public educationTrait: Trait | null) {

    }
}