import { RGB } from "../../../util/RGB";
import { CK3 } from "../CK3";
import { LegacyCk3Save } from "../LegacyCk3Save";
import { RulerTier } from "../RulerTier";
import { ICk3Save } from "../save/ICk3Save";
import { AbstractLandedTitle } from "./AbstractLandedTitle";

export class CustomLandedTitle extends AbstractLandedTitle {

    private name: string;
    private color: RGB;
    private tierString: string | null;
    private vassalTitleIndices: number[] = [];

    constructor(data: any, save: ICk3Save, ck3: CK3) {
        super(data, save, ck3);
        this.color = new RGB(data.color.rgb[0], data.color.rgb[1], data.color.rgb[2]);
        this.tierString = data.tier || null;
        this.vassalTitleIndices = data.de_jure_vassals || [];
        this.name = data.name;
        if (!this.name) {
            throw new Error("Custom landed title must have a name");
        }
    }

    public override getColor(): RGB {
        return this.color;
    }

    public override getLocalisedName(): String {
        return this.name;
    }

    public override getTier() {
        if (this.tierString) {
            return RulerTier.fromRealmTier(this.tierString);
        } else {
            return this.vassalTitleIndices.map((vassal: number) => this.save.getTitleByIndex(vassal).getTier()).reduce((prev: RulerTier, current: RulerTier) => prev.compare(current) > 0 ? prev : current, RulerTier.NONE).getNextHigherTier();
        }
    }
}