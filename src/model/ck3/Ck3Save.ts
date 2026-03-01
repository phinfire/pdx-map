import { ParadoxSave } from "../common/ParadoxSave";
import { Character } from "./Character";
import { CK3 } from "./game/CK3";
import { County } from "./County";
import { Culture } from "./Culture";
import { DynastyHouse } from "./DynastyHouse";
import { Faith } from "./Faith";
import { Holding } from "./Holding";
import { Ck3Player } from "./Player";
import { ICk3Save } from "./save/ICk3Save";
import { AbstractLandedTitle } from "./title/AbstractLandedTitle";
import { readPlayers, readAllFaiths, readAllCultures, readCountries, readLandedTitles, createTitle, readAllHoldings, readDynasties, createAllCharacters } from "../../util/parse";

export class Ck3Save implements ICk3Save, ParadoxSave {

    private livingCharacters: Map<string, Character> = new Map();
    private deadUnprunableCharacters: Map<string, Character> = new Map();
    private deadPrunableCharacters: Map<string, Character> = new Map();

    private players: Ck3Player[] = [];
    private faiths: Faith[] = [];
    private cultures: Culture[] = [];
    private landedTitles: AbstractLandedTitle[] = [];
    private dynastyHouses: DynastyHouse[] = [];
    private counties: County[] = [];
    private index2Holding: Map<string, Holding> = new Map<string, Holding>();
    private titleKey2Index = new Map<string, number>();

    private data: any;

    static fromRawData(data: any, ck3: CK3): Ck3Save {
        const save = new Ck3Save(ck3, new Date(data.date));
        for (let key of Object.keys(data)) {
            console.log(`Key: ${key}, Size: ${JSON.stringify(data[key]).length.toLocaleString()} chars`);
        }
        save.initialize(data);
        return save;
    }

    static fromJSON(json: any, ck3: CK3): Ck3Save {
        const save = new Ck3Save(ck3, new Date(json.date));
        save.initialize(json);
        return save;
    }

    private constructor(private ck3: CK3, private ingameDate: Date) {
        if (!(ingameDate instanceof Date)) {
            this.ingameDate = new Date(ingameDate as any);
        }
    }

    private initialize(data: any) {
        const { living, deadUnprunable, deadPrunable } = createAllCharacters(data, this, this.ck3);
        this.livingCharacters = living;
        this.deadUnprunableCharacters = deadUnprunable;
        this.deadPrunableCharacters = deadPrunable;
        this.players = readPlayers(data, (id) => this.getCharacter(Number(id)));
        this.faiths = readAllFaiths(data);
        this.cultures = readAllCultures(data);
        this.counties = readCountries(data, this, this.ck3);
        this.landedTitles = readLandedTitles(data, (titleData) => createTitle(titleData, this, this.ck3));
        this.index2Holding = readAllHoldings(data, this, this.ck3);
        this.landedTitles.forEach((title, index) => {
            this.titleKey2Index.set(title.getKey(), index);
        });
        this.dynastyHouses = readDynasties(data, this);
        this.data = data;
    }

    public getCK3(): CK3 {
        return this.ck3;
    }

    toJSON() {
        return this.data;
    }

    getCharacter(characterId: number) {
        const charIdStr = "" + characterId;
        if (this.livingCharacters.has(charIdStr)) {
            return this.livingCharacters.get(charIdStr)!;
        } else if (this.deadUnprunableCharacters.has(charIdStr)) {
            return this.deadUnprunableCharacters.get(charIdStr)!;
        } else if (this.deadPrunableCharacters.has(charIdStr)) {
            return this.deadPrunableCharacters.get(charIdStr)!;
        }
        return null;
    }

    getDynastyHouse(houseId: number): DynastyHouse | null {
        if (this.dynastyHouses[houseId]) {
            return this.dynastyHouses[houseId];
        }
        return null;
    }

    getDynastyHouseAndDynastyData(houseId: number) {
        throw new Error("Method not implemented.");
    }

    getLandedTitles() {
        return this.landedTitles;
    }

    getIngameDate(): Date {
        return this.ingameDate;
    }

    getTitleByIndex(index: number): AbstractLandedTitle | null {
        if (index < 0 || index >= this.landedTitles.length) {
            console.error("Invalid title index:", index, "length:", this.landedTitles.length);
            return null;
        }
        return this.landedTitles[index];
    }

    getHeldTitles(character: Character): AbstractLandedTitle[] {
        return this.landedTitles.filter(title => title.getHolder() != null && title.getHolder()!.getCharacterId() === character.getCharacterId());
    }

    getPlayerNameByCharacterId(characterId: string): string | null {
        const player = this.players.find(p => p.getLastPlayedCharacter() != null && p.getLastPlayedCharacter()!.getCharacterId() === characterId);
        return player ? player.getName() : null;
    }

    getCulture(cultureIndex: number): Culture {
        if (cultureIndex < 0 || cultureIndex >= this.cultures.length) {
            throw new Error("Invalid culture index: " + cultureIndex + ". Expected [0, " + (this.cultures.length - 1) + "]");
        }
        return this.cultures[cultureIndex];
    }

    getFaith(faithIndex: number): Faith {
        if (faithIndex < 0 || faithIndex >= this.faiths.length) {
            throw new Error("Invalid faith index: " + faithIndex + ". Expected [0, " + (this.faiths.length - 1) + "]");
        }
        return this.faiths[faithIndex];
    }

    getPlayers(): Ck3Player[] {
        return this.players;
    }

    getLivingCharactersFiltered(filter: (character: Character) => boolean): Character[] {
        const result = [];
        for (const char of this.livingCharacters.values()) {
            if (filter(char)) {
                result.push(char);
            }
        }
        return result;
    }

    getHolding(index: string) {
        if (this.index2Holding.has(index)) {
            return this.index2Holding.get(index)!;
        }
        return null;
    }

    getTitle(key: string): AbstractLandedTitle {
        const index = this.titleKey2Index.get(key);
        if (index !== undefined) {
            return this.landedTitles[index];
        }
        throw new Error(`Title with key ${key} not found.`);
    }

    getCounties(): County[] {
        return this.counties;
    }

    public isPlayerCharacter(character: Character): boolean {
        return this.players.some(player => {
            const char = player.getLastPlayedCharacter();
            if (!char) return false;
            return char.getCharacterId() === character.getCharacterId();
        });
    }
}
