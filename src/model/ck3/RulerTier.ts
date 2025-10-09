import { CK3 } from "./CK3";

export class RulerTier {
    public static readonly NONE = new RulerTier("NONE", 0);
    public static readonly BARON = new RulerTier("BARON", 1);
    public static readonly COUNT = new RulerTier("COUNT", 2);
    public static readonly DUKE = new RulerTier("DUKE", 3);
    public static readonly KING = new RulerTier("KING", 4);
    public static readonly EMPEROR = new RulerTier("EMPEROR", 5);

    public static TIERS = [
        RulerTier.NONE,
        RulerTier.BARON,
        RulerTier.COUNT,
        RulerTier.DUKE,
        RulerTier.KING,
        RulerTier.EMPEROR
    ];

    public static resolveRulerTierCharEncoding(char: string): RulerTier {
        const symbols = ["b", "c", "d", "k", "e"];
        const index = symbols.indexOf(char);
        return index != -1 ? RulerTier.TIERS[index+1] : RulerTier.NONE;
    }

    private constructor(private name: string, private index: number) {

    }

    public getNextHigherTier(): RulerTier {
        return RulerTier.TIERS[Math.min(this.index + 1, RulerTier.TIERS.length - 1)];
    }

    public static fromRealmTier(realmTier: string) {
        const tierStrings = ["barony", "county", "duchy", "kingdom", "empire"];
        const index = tierStrings.indexOf(realmTier);
        if (index == -1) {
            throw new Error("Unknown realm tier: " + realmTier);
        }
        return RulerTier.TIERS[index];
    }

    compare(other: RulerTier): number {
        return this.index - other.index;
    }

    getName(): string {
        return this.name;
    }

    getStateTitle(): string {
        switch (this) {
            case RulerTier.BARON: return "Barony";
            case RulerTier.COUNT: return "County";
            case RulerTier.DUKE: return "Duchy";
            case RulerTier.KING: return "Kingdom";
            case RulerTier.EMPEROR: return "Empire";
            default: return "-";
        }
    }

    getImageUrl(): string {
        if (this.index == 0) {
            return CK3.CK3_DATA_URL + "/gfx/interface/icons/message_feed/adventurer.webp";
        }
        return Array.from(["barony", "barony", "county", "duchy", "kingdom", "empire"].map((fileName) => CK3.CK3_DATA_URL + "/gfx/interface/icons/" + fileName + "_crown.webp"))[this.index]
    }
}