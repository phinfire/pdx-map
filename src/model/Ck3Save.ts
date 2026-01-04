import { Character } from "./ck3/Character";
import { CK3 } from "./ck3/CK3";
import { County } from "./ck3/County";
import { Culture } from "./ck3/Culture";
import { DynastyHouse } from "./ck3/DynastyHouse";
import { Faith } from "./ck3/Faith";
import { Holding } from "./ck3/Holding";
import { Ck3Player } from "./ck3/Player";
import { ICk3Save } from "./ck3/save/ICk3Save";
import { readAllFaiths, readAllCultures, readLandedTitles, createTitle, readPlayers, readDynasties, readCountries, readAllHoldings } from "./ck3/save/Parse";
import { AbstractLandedTitle } from "./ck3/title/AbstractLandedTitle";
import { CustomLandedTitle } from "./ck3/title/CustomLandedTitle";
import { ParadoxSave } from "./ParadoxSave";

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

    static fromRawData(data: any, ck3: CK3): Ck3Save {
        const save = new Ck3Save(ck3, data.date);
        save.initialize(data);
        return save;
    }

    private constructor(private ck3: CK3, private ingameDate: Date) {

    }

    private initialize(data: any) {
        this.createAllCharacters(data);
        this.players = readPlayers(data, (id, data) => this.findDataAndCreateCharacter(data, id));
        this.faiths = readAllFaiths(data);
        this.cultures = readAllCultures(data);
        this.counties = readCountries(data, this, this.ck3);
        this.landedTitles = readLandedTitles(data, (titleData) => createTitle(titleData, this, this.ck3));
        this.index2Holding = readAllHoldings(data, this, this.ck3);
        this.landedTitles.forEach((title, index) => {
            this.titleKey2Index.set(title.getKey(), index);
        });
        this.dynastyHouses = readDynasties(data, this);
    }

    private createAllCharacters(data: any) {
        // Create all living characters
        const livingData = data.living || {};
        for (const characterId in livingData) {
            if (Object.prototype.hasOwnProperty.call(livingData, characterId)) {
                const char = Character.fromRawData(characterId, livingData[characterId], this, this.ck3);
                this.livingCharacters.set(characterId, char);
            }
        }

        // Create all dead unprunable characters
        const deadUnprunableData = data.dead_unprunable || {};
        for (const characterId in deadUnprunableData) {
            if (Object.prototype.hasOwnProperty.call(deadUnprunableData, characterId)) {
                const char = Character.fromRawData(characterId, deadUnprunableData[characterId], this, this.ck3);
                this.deadUnprunableCharacters.set(characterId, char);
            }
        }

        // Create all dead prunable characters
        const deadPrunableData = data.dead_prunable || {};
        for (const characterId in deadPrunableData) {
            if (Object.prototype.hasOwnProperty.call(deadPrunableData, characterId)) {
                const char = Character.fromRawData(characterId, deadPrunableData[characterId], this, this.ck3);
                this.deadPrunableCharacters.set(characterId, char);
            }
        }
    }

    public getCK3(): CK3 {
        return this.ck3;
    }

    findDataAndCreateCharacter(data: any, characterId: string): Character | null {
        // Look up from pre-created characters
        if (this.livingCharacters.has(characterId)) {
            return this.livingCharacters.get(characterId)!;
        } else if (this.deadUnprunableCharacters.has(characterId)) {
            return this.deadUnprunableCharacters.get(characterId)!;
        } else if (this.deadPrunableCharacters.has(characterId)) {
            return this.deadPrunableCharacters.get(characterId)!;
        } else {
            console.warn(`Character with ID ${characterId} not found in pre-created characters.`);
            return null;
        }
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
