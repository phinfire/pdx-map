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
import { readPlayers, readAllFaiths, readAllCultures, readCountries, readLandedTitles, createTitle, readAllHoldings, readDynasties, createAllCharacters } from "../../util/parse/parse";

export class Ck3Save implements ICk3Save, ParadoxSave {

    private livingCharacters: Map<string, Character> = new Map();
    private deadUnprunableCharacters: Map<string, Character> = new Map();
    private deadPrunableCharacters: Map<string, Character> = new Map();

    private players: Ck3Player[] = [];
    private faiths: Faith[] = [];
    private cultures: Culture[] = [];
    private landedTitles: Map<string, AbstractLandedTitle> = new Map();
    private key2LandedTitle: Map<string, AbstractLandedTitle> = new Map();
    private id2DynastyHouses: Map<string, DynastyHouse> = new Map();
    private counties: County[] = [];
    private index2Holding: Map<string, Holding> = new Map<string, Holding>();
    private titleKey2Index = new Map<string, number>();

    private data: any;

    static fromRawData(data: any, ck3: CK3): Ck3Save {
        const save = new Ck3Save(ck3, new Date(data.date));
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
        for (const title of this.landedTitles.values()) {
            this.key2LandedTitle.set(title.getKey(), title);
        }
        this.index2Holding = readAllHoldings(data, this, this.ck3);
        const dynasty2LivingCharacters = this.groupCharactersByDynasty(this.livingCharacters.values());
        const dynasty2DeadCharacters = this.groupCharactersByDynasty([...this.deadUnprunableCharacters.values(), ...this.deadPrunableCharacters.values()]);
        this.id2DynastyHouses = readDynasties(data, dynasty2LivingCharacters, dynasty2DeadCharacters);
        this.data = data;
    }

    private groupCharactersByDynasty(characters: Iterable<Character>): Map<string, Character[]> {
        const result = new Map<string, Character[]>();
        for (const char of characters) {
            const dynastyId = char.getDynastyHouseID();
            if (!result.has(dynastyId)) {
                result.set(dynastyId, []);
            }
            result.get(dynastyId)!.push(char);
        }
        return result;
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

    getDynastyHouse(houseId: string) {
        return this.id2DynastyHouses.get(houseId) || null;
    }

    getLandedTitles() {
        return Array.from(this.landedTitles.values());
    }

    getIngameDate(): Date {
        return this.ingameDate;
    }

    getTitleByIndex(index: number): AbstractLandedTitle | null {
        return this.landedTitles.get("" + index) || null;
    }

    getHeldTitles(character: Character): AbstractLandedTitle[] {
        const ts = this.getLandedTitles().filter(title => title.getHolder() != null && title.getHolder()!.getCharacterId() === character.getCharacterId());
        return ts;
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
        if (this.key2LandedTitle.has(key)) {
            return this.key2LandedTitle.get(key)!;
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
