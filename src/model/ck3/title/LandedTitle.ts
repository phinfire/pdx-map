import { CK3 } from "../CK3";
import { RulerTier } from "../RulerTier";
import { ICk3Save } from "../save/ICk3Save";
import { AbstractLandedTitle } from "./AbstractLandedTitle";

export class LandedTitle extends AbstractLandedTitle {

    constructor(key: string, holder: string, deFactoLiege: string | null, deJureVassalIndices: number[], capitalHoldingIndex: number | null, save: ICk3Save, ck3: CK3) {
        super(key, holder, deFactoLiege, deJureVassalIndices, capitalHoldingIndex, save, ck3);
    }

    public override getTier(): RulerTier {
        return RulerTier.resolveRulerTierCharEncoding(this.getKey()[0]);
    }

    public getColor() {
        const color = this.ck3.getVanillaTitleColor(this.getKey());
        if (color) {
            return color;
        }
        throw new Error("No color found for title " + this.getKey());
    }

    public getLocalisedName() {
        return this.ck3.localise(this.getKey());
    }
}