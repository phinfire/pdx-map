import { RGB } from "../../../util/RGB";
import { CK3 } from "../CK3";
import { RulerTier } from "../RulerTier";
import { ICk3Save } from "../save/ICk3Save";
import { AbstractLandedTitle } from "./AbstractLandedTitle";

export class CustomLandedTitle extends AbstractLandedTitle {

    private cachedRulerTier: RulerTier | null = null;

    constructor(key: string, holder: string, deFactoLiege: string | null, private color: RGB, private tier: RulerTier, deJureVassalIndices: number[], private name: string, capitalHoldingIndex: number | null, save: ICk3Save, ck3: CK3) {
        super(key, holder, deFactoLiege, deJureVassalIndices, capitalHoldingIndex, save, ck3);
        if (!this.name) {
            throw new Error("Custom landed title must have a name");
        }
    }

    public override getColor(): RGB {
        return this.color;
    }

    public override getLocalisedName() {
        return this.name;
    }

    public override getTier() {
        if (this.tier != RulerTier.NONE) {
            return this.tier;
        } else {
            if (this.cachedRulerTier == null) {
                this.cachedRulerTier = this.getDeJureVassalTitles()
                    .map((vassalTitle: AbstractLandedTitle) => vassalTitle.getTier())
                    .reduce((prev: RulerTier, current: RulerTier) => prev.compare(current) > 0 ? prev : current, RulerTier.NONE).getNextHigherTier();
            }
            return this.cachedRulerTier;
        }
    }
}