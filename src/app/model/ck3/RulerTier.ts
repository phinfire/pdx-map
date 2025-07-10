import { CK3 } from "./CK3";

export class RulerTier {
    public static readonly NONE = new RulerTier("NONE", 0);
    public static readonly BARON = new RulerTier("BARON", 1);
    public static readonly COUNT = new RulerTier("COUNT", 2);
    public static readonly DUKE = new RulerTier("DUKE", 3);
    public static readonly KING = new RulerTier("KING", 4);
    public static readonly EMPEROR = new RulerTier("EMPEROR", 5);

    public static resolveRulerTierCharEncoding(char: string): RulerTier {
        if (char == "b") {
            return RulerTier.BARON;
        }
        if (char == "c") {
            return RulerTier.COUNT;
        }
        if (char == "d") {
            return RulerTier.DUKE;
        }
        if (char == "k") {
            return RulerTier.KING;
        }
        if (char == "e") {
            return RulerTier.EMPEROR;
        }
        return RulerTier.NONE;
    }

    constructor(private name: string, private index: number) {

    }

    getNextHigherTier(): RulerTier {
        if (this.index == 0) {
            return RulerTier.BARON;
        }
        if (this.index == 1) {
            return RulerTier.COUNT;
        }
        if (this.index == 2) {
            return RulerTier.DUKE;
        }
        if (this.index == 3) {
            return RulerTier.KING;
        }
        if (this.index == 4) {
            return RulerTier.EMPEROR;
        }
        return RulerTier.NONE;
    }

    public static fromRealmTier(realmTier: string) {
        if (realmTier == "barony") {
            return RulerTier.BARON;
        } else if (realmTier == "county") {
            return RulerTier.COUNT;
        } else if (realmTier == "duchy") {
            return RulerTier.DUKE;
        } else if (realmTier == "kingdom") {
            return RulerTier.KING;
        } else if (realmTier == "empire") {
            return RulerTier.EMPEROR;
        }
        throw new Error("Unknown realm tier: " + realmTier);
    }

    compare(other: RulerTier): number {
        return this.index - other.index;
    }

    getName(): string {
        return this.name;
    }

    getImageUrl(): string {
        if (this.index == 0) {
            return CK3.CK3_DATA_URL + "/gfx/interface/icons/message_feed/adventurer.webp";
        }
        return Array.from(["barony", "barony","county","duchy","kingdom","empire"].map((fileName) => CK3.CK3_DATA_URL + "/gfx/interface/icons/" + fileName + "_crown.webp"))[this.index]
    }
}