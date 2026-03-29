import { Injectable } from "@angular/core";
import { TraitType } from "../../model/ck3/enum/TraitType";
import { Trait } from "../../model/ck3/Trait";
import { CustomRulerFile } from "../../model/megacampaign/CustomRulerFile";
import { RGB } from "../../util/RGB";
import { Plotable } from "../../model/Plotable";

@Injectable({
    providedIn: 'root'
})
export class MegaPlotService {

    getTraitType2Color(): Map<string, RGB> {
        const traitType2Color = new Map<string, RGB>();
        traitType2Color.set(TraitType.PERSONALITY, new RGB(102, 153, 204));
        traitType2Color.set(TraitType.INHERITABLE, new RGB(102, 0, 0));
        traitType2Color.set(TraitType.EDUCATION, new RGB(230, 230, 210));
        traitType2Color.set(TraitType.COMMANDER, new RGB(100, 100, 100));
        traitType2Color.set(TraitType.LIFESTYLE, new RGB(128, 0, 128));
        traitType2Color.set(TraitType.FAME, new RGB(135, 206, 250));
        traitType2Color.set(TraitType.HEALTH, new RGB(235, 83, 83));
        traitType2Color.set(TraitType.PHYSICAL, new RGB(0, 128, 128));
        traitType2Color.set(TraitType.FALLBACK, new RGB(128, 128, 128));
        return traitType2Color;
    }

    generatePlotData(rulers: CustomRulerFile[]) {
        const traitType2Color = this.getTraitType2Color();
        return countTraits(rulers).then(trait2Count => {
            return Array.from(trait2Count.entries()).map(([trait, count]) => {
                if (traitType2Color.has(trait.getTraitType()) === false) {
                    console.warn(`No color defined for trait type ${trait.getTraitType()}`);
                    traitType2Color.set(trait.getTraitType(), new RGB(0, 0, 0));
                }
                return new Plotable(
                    trait.getName(),
                    count,
                    (traitType2Color.get(trait.getTraitType()) || new RGB(0, 0, 0)).toHexString(),
                    trait.getTraitIconUrl()
                );
            }).sort((a, b) => a.value == b.value ? (a.label < b.label ? -1 : 1) : b.value - a.value);
        });
    }
}

async function countTraits(
    rulers: CustomRulerFile[]
): Promise<Map<Trait, number>> {
    const trait2Count: Map<Trait, number> = new Map();
    return new Promise((resolve) => {
        rulers.forEach((ruler) => {
            for (const trait of ruler.traits) {
                trait2Count.set(trait, (trait2Count.get(trait) || 0) + 1);
            }
            if (ruler.educationTrait) {
                trait2Count.set(ruler.educationTrait, (trait2Count.get(ruler.educationTrait) || 0) + 1);
            }
        });
        resolve(trait2Count);
    });
}