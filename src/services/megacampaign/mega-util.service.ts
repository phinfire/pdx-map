import { Injectable } from '@angular/core';
import { CustomRulerFile } from '../../model/megacampaign/CustomRulerFile';
import { Trait } from '../../model/ck3/Trait';
import { TraitType } from '../../model/ck3/enum/TraitType';

@Injectable({
    providedIn: 'root',
})
export class MegaUtilService {

    getIllegalityReport(ruler: CustomRulerFile) {
        const negativeTraits = ruler.traits.filter(t => t.getRulerDesignerCost() < 0);
        const incompatibleTraits = this.getIncomptaibleTraits(ruler.traits);
        const illegalTraits = this.getIllegalTraits(ruler.traits);
        const personalityTraits = ruler.traits.filter(t => t.getTraitType() === TraitType.PERSONALITY);
        const messageLines = [];
        if (negativeTraits.length > 1) {
            messageLines.push(`You have ${negativeTraits.length} negative traits:\n ${negativeTraits.map(t => t.getName()).join(", ")},\n but only 1 is allowed.`);
        }
        if (illegalTraits.length > 0) {
            messageLines.push(`The following traits are not allowed:\n ${illegalTraits.map(t => t.getName()).join(", ")}. `);
        }
        if (incompatibleTraits.length > 1) {
            messageLines.push(`You have ${incompatibleTraits.length} inheritable traits:\n ${incompatibleTraits.map(t => t.getName()).join(", ")},\n but only 1 is allowed.`);
        }
        if (personalityTraits.length > 3) {
            messageLines.push(`You have ${personalityTraits.length} personality traits:\n ${personalityTraits.map(t => t.getName()).join(", ")},\n but only 3 are allowed.`);
        } else if (personalityTraits.length < 2) {
            messageLines.push(`You have only ${personalityTraits.length} personality traits:\n ${personalityTraits.map(t => t.getName()).join(", ")},\n but 3 are required.`);
        }
        return messageLines.join("\n");
    }

    private getIllegalTraits(traits: Trait[]) {
        return traits.filter(t => t.getTraitType() === TraitType.LIFESTYLE ||
            (t.getName().endsWith("3") && t.getName().indexOf("education") == -1 && t.getRulerDesignerCost() > 0));
    }

    private getIncomptaibleTraits(traits: Trait[]) {
        const inheritableTraits = traits.filter(t => t.getTraitType() === TraitType.INHERITABLE && t.getRulerDesignerCost() > 0);
        if (inheritableTraits.length <= 1) {
            return [];
        }
        return inheritableTraits;
    }
}
