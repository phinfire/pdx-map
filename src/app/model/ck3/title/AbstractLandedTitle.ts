import { RGB } from "../../../util/RGB";
import { CK3 } from "../CK3";
import { LegacyCk3Save } from "../LegacyCk3Save";
import { RulerTier } from "../RulerTier";
import { ICk3Save } from "../save/ICk3Save";
import { CustomLandedTitle } from "./CustomLandedTitle";
import { LandedTitle } from "./LandedTitle";

export abstract class AbstractLandedTitle {

    static fromRawData(data: any, save: ICk3Save, ck3: CK3): AbstractLandedTitle {
        const key = data.key;
        if (key.startsWith("x_")) {
            console.warn("Custom title detected: " + key);
            return new CustomLandedTitle(data, save, ck3);
        } else {
            console.warn("Standard title detected: " + key);
            return new LandedTitle(data, save, ck3);
        }
    }

    protected constructor(private data: any, protected save: ICk3Save, protected ck3: CK3) {
        if (!data) {
            throw new Error("No data for landed title");
        }
    }

    public abstract getColor(): RGB;

    public abstract getLocalisedName(): String;

    public abstract getTier(): RulerTier;

    public getKey() {
        return this.data.key;
    }

    public getHolder() {
        return this.save.getCharacter(this.data.holder)!;
    }

    public getDeFactoLiegeTitle() {
        if (this.data.de_facto_liege) {
            return this.save.getTitleByIndex(this.data.de_facto_liege);
        }
        return null;
    }

    public getUltimateLiegeTitle() {
        let current: AbstractLandedTitle = this;
        while (current.getDeFactoLiegeTitle() != null) {
            const next = current.getDeFactoLiegeTitle()!;
            if (next == null || next.getKey() == current.getKey()) {
                return current;
            }
            current = next;
        }
        return current;
    }
    
    public getUltimatePlayerHeldLiegeTitle(): AbstractLandedTitle | null {
        const playerName = this.getHolder().getPlayerName();
        if (playerName != null) {
            return this;
        }
        const liegeTitle = this.getDeFactoLiegeTitle();
        return liegeTitle ? liegeTitle.getUltimatePlayerHeldLiegeTitle() : null;
    }
}