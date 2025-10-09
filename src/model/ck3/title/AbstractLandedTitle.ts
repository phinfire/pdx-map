import { RGB } from "../../../util/RGB";
import { Character } from "../Character";
import { CK3 } from "../CK3";
import { RulerTier } from "../RulerTier";
import { ICk3Save } from "../save/ICk3Save";

export abstract class AbstractLandedTitle {

    private holderIndex: number | null = null;
    private deFactoLiegeIndex: number | null;
    private deJureVassalIndices: number[];

    protected constructor(private key: string, holder: string, deFactoLiege: string | null, deJureVassalIndices: number[], private capitalHoldingIndex: number | null, protected save: ICk3Save, protected ck3: CK3) {
        if (holder) {
            this.holderIndex = parseInt(holder);
        }
        this.deFactoLiegeIndex = deFactoLiege ? parseInt(deFactoLiege) : null;
        this.deJureVassalIndices = deJureVassalIndices || [];
    }

    public abstract getColor(): RGB;

    public abstract getLocalisedName(): string;

    public abstract getTier(): RulerTier;

    public getCapitalHolding() {
        if (this.capitalHoldingIndex != null) {
            return this.save.getHolding(this.capitalHoldingIndex + "");
        }
        return null;
    }

    public getKey() {
        return this.key;
    }

    public getHolder() {
        if (this.holderIndex === null) {
            return null;
        }
        return this.save.getCharacter(this.holderIndex)!;
    }

    public getDeFactoLiegeTitle() {
        if (this.deFactoLiegeIndex) {
            return this.save.getTitleByIndex(this.deFactoLiegeIndex);
        }
        return null;
    }

    public getUltimateLiegeTitle() {
        const path = this.getDeFactoPathToUltimateLiege();
        return path[path.length - 1];
    }

    public getDeFactoPathToUltimateLiege(): AbstractLandedTitle[] {
        const path: AbstractLandedTitle[] = [];
        let current: AbstractLandedTitle = this;
        path.push(current);
        while (current.getDeFactoLiegeTitle() != null) {
            const next = current.getDeFactoLiegeTitle()!;
            if (next == null) {
                break;
            }
            path.push(next);
            current = next;
        }
        return path;
    }

    public getUltimatePlayerHeldLiegeTitle(): AbstractLandedTitle | null {
        if (this.getHolder() === null) {
            return null;
        }
        const playerName = this.getHolder()!.getPlayerName();
        if (playerName != null) {
            return this;
        }
        const liegeTitle = this.getDeFactoLiegeTitle();
        return liegeTitle ? liegeTitle.getUltimatePlayerHeldLiegeTitle() : null;
    }

    public getDeJureVassalTitles(): AbstractLandedTitle[] {
        return this.deJureVassalIndices
            .map((index: number) => this.save.getTitleByIndex(index))
            .filter((title: AbstractLandedTitle | null) => title != null) as AbstractLandedTitle[];
    }

    public getStateTitle() {
        return this.getTier().getStateTitle() + " of " + this.getLocalisedName();
    }
}