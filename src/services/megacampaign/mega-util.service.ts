import { Injectable } from '@angular/core';
import { CustomRulerFile } from '../gamedata/CustomRulerFile';
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
        let message = "";
        if (negativeTraits.length > 1) {
            message += `You have ${negativeTraits.length} negative traits: ${negativeTraits.map(t => t.getName()).join(", ")}, but only 1 is allowed.`;
        }
        if (illegalTraits.length > 0) {
            message += `The following traits are not allowed: ${illegalTraits.map(t => t.getName()).join(", ")}. `;
        }
        if (incompatibleTraits.length > 1) {
            message += `You have ${incompatibleTraits.length} inheritable traits: ${incompatibleTraits.map(t => t.getName()).join(", ")}, but only 1 is allowed.`;
        }
        return message;
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
