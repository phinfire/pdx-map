import { CK3 } from "./game/CK3";
import { Skill } from "./enum/Skill";
import { TraitType } from "./enum/TraitType";

export class Trait {

    private traitType: TraitType;

    constructor(private name: string, private data: any, private index: number) {
        this.traitType = Trait.getTraitType(data);
    }

    public getName() {
        return this.name;
    }

    public getTraitType() {
        return this.traitType;
    }

    public getTraitIconUrl() {
        if (this.name == "lifestyle_hunter") {
            return CK3.CK3_DATA_URL + "gfx/interface/icons/trait_level_tracks/" + this.name.replace("lifestyle_", "") + ".webp";
        }
        if (this.name == "lifestyle_gardener") {
            return CK3.CK3_DATA_URL + "gfx/interface/icons/traits/" + this.name.replace("lifestyle_", "") + ".webp";
        }
        if (this.name == "lifestyle_traveler") {
            return CK3.CK3_DATA_URL + "gfx/interface/icons/traits/" + this.name.replace("lifestyle_", "") + ".webp";
        }
        if (this.data.track) {
            return CK3.CK3_DATA_URL + "gfx/interface/icons/trait_level_tracks/" + this.name + ".webp";
        } else {
            return CK3.CK3_DATA_URL + "gfx/interface/icons/traits/" + this.name + ".webp";
        }
    }

    private static getTraitType(data: any) {
        if (data.genetic) {
            return TraitType.INHERITABLE;
        }
        if(data.physical) {
            return TraitType.PHYSICAL;
        }
        if (data.health == "yes") {
            return TraitType.HEALTH;
        }
        if (data.category) {
            for (let type of [TraitType.COMMANDER, TraitType.EDUCATION, TraitType.FALLBACK, TraitType.FAME, TraitType.LIFESTYLE, TraitType.PERSONALITY, TraitType.HEALTH]) {
                if (data.category == type) {
                    return type;
                }
            }
        }
        return TraitType.FALLBACK;
    }

    public getIndex() {
        return this.index;
    }
    
    public getSkillChange(skill: Skill) {
        if (Object.keys(this.data).includes(skill + "")) {
            return Number.parseInt(this.data[skill]);
        }
        return 0;
    }

    public getRulerDesignerCost() {
        return Number.parseInt(this.data.ruler_designer_cost) ?? 0;
    }
}