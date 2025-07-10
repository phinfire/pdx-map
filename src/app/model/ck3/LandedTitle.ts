import { RGB } from "../../util/RGB";
import { CK3 } from "./CK3";
import { Save } from "./Ck3Save";
import { RulerTier } from "./RulerTier";

export class LandedTitle {

    constructor(private data: any, private save: Save, private ck3: CK3) {
        if (!data) {
            throw new Error("No data for landed title");
        }
    }

    public getKey() {
        return this.data.key;
    }

    public getHolder() {
        return this.save.getCharacter(this.data.holder)!;
    }

    public getTier() {
        const tier = RulerTier.resolveRulerTierCharEncoding(this.getKey()[0]);
        return tier == RulerTier.NONE ? this.getTierOfCustomTitle() : tier;
    }

    public getTierOfCustomTitle() : RulerTier {
        if (this.data.tier) {
            return RulerTier.fromRealmTier(this.data.tier);
        } else {
            const vassals = this.data.de_jure_vassals = this.data.de_jure_vassals || [];
            return vassals.map((vassal: number) => this.save.getTitleByIndex(vassal).getTier()).reduce((prev: RulerTier, current: RulerTier) => prev.compare(current) > 0 ? prev : current, RulerTier.NONE).getNextHigherTier();
        }
    }

    public getDeFactoLiegeTitle() {
        if (this.data.de_facto_liege) {
            return this.save.getTitleByIndex(this.data.de_facto_liege);
        }
        return null;
    }

    public getUltimateLiegeTitle() {
        let current: LandedTitle = this;
        while (current.getDeFactoLiegeTitle() != null) {
            const next = current.getDeFactoLiegeTitle()!;
            if (next == null || next.getKey() == current.getKey()) {
                return current;
            }
            current = next;
        }
        return current;
    }
    
    public getColor() {
        if (this.getKey().startsWith("x_")) {
            return new RGB(this.data.color.rgb[0], this.data.color.rgb[1], this.data.color.rgb[2]);
        }
        const color = this.ck3.getVanillaTitleColor(this.getKey());
        if (color) {
            return color;
        }
        throw new Error("No color found for title " + this.getKey());
    }

    public getLocalisedName() {
        if (this.getKey().startsWith("x_")) {
            return this.data.name;
        }
        return this.ck3.localise(this.getKey());
    }
    
    public getUltimatePlayerHeldLiegeTitle(): LandedTitle | null {
        const playerName = this.getHolder().getPlayerName();
        if (playerName != null) {
            return this;
        }
        const liegeTitle = this.getDeFactoLiegeTitle();
        return liegeTitle ? liegeTitle.getUltimatePlayerHeldLiegeTitle() : null;
    }
}