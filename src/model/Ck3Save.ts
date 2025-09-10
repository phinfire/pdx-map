import { Character } from "./ck3/Character";
import { CK3 } from "./ck3/CK3";
import { Culture } from "./ck3/Culture";
import { Faith } from "./ck3/Faith";
import { Holding } from "./ck3/Holding";
import { Ck3Player } from "./ck3/Player";
import { ICk3Save } from "./ck3/save/ICk3Save";
import { readAllFaiths, readAllCultures, readLandedTitles, createTitle } from "./ck3/save/Parse";
import { AbstractLandedTitle } from "./ck3/title/AbstractLandedTitle";

export class Ck3Save implements ICk3Save {

    // character data to avoid object instantiation at init
    private livingCharacters: any;
    private deadUnprunableCharacters: any;

    private players: Ck3Player[] = [];
    private faiths: Faith[] = [];
    private cultures: Culture[] = [];
    private landedTitles: AbstractLandedTitle[] = [];

    private titleKey2Index = new Map<string, number>();

    private cachedCharacters = new Map<string, Character>();

    static fromRawData(data: any, ck3: CK3): Ck3Save {
        const save = new Ck3Save(ck3);
        save.initialize(data);
        return save;
    }

    private constructor(private ck3: CK3) {

    }

    private initialize(data: any) {
        this.players = Ck3Save.readPlayers(data, (id, data) => this.findDataAndCreateCharacter(data, id));
        this.faiths = readAllFaiths(data);
        this.cultures = readAllCultures(data);
        this.landedTitles = readLandedTitles(data, (titleData) => createTitle(titleData, this, this.ck3));
        this.landedTitles.forEach((title, index) => {
            this.titleKey2Index.set(title.getKey(), index);
        });
        this.livingCharacters = data.living || {};
        this.deadUnprunableCharacters = data.dead_unprunable || {};
        //console.log("Ck3Save initialized with players:", this.players.length, "faiths:", this.faiths.length, "cultures:", this.cultures.length, "titles:", this.titles.size);
    }

    private static readPlayers(data: any, characterCreator: (id: string, data: any) => Character | null) {
        const players = [];
        if (!data.played_character) {
            console.warn("No played_character data found in save file");
            return [];
        }
        let playedCharacters = [];
        if (!Array.isArray(data.played_character)) {
            playedCharacters = [data.played_character];
        } else {
            playedCharacters = data.played_character;
        }
        for (let i = 0; i < playedCharacters.length; i++) {
            const playerData = playedCharacters[i];
            if (!playerData?.name || !playerData?.character) {
                console.warn("Player data missing required fields (name or character):", playerData);
                continue;
            }
            const playerName = playerData.name;
            const character = characterCreator("" + playerData.character, data);
            if (!character) {
                console.warn(`Skipping player '${playerName}' with invalid character ID: ${playerData.character}`);
                continue;
            }
            const previousCharacters = new Map<string, Character>();
            if (playerData.legacy && Array.isArray(playerData.legacy)) {
                const sortedLegacy = playerData.legacy.sort(((a: any, b: any) => {
                    if (!a.date && !b.date) return 0;
                    if (!a.date) return 1;
                    if (!b.date) return -1;
                    const dateA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
                    const dateB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
                    return dateB - dateA;
                }));
                for (let i = 0; i < sortedLegacy.length; i++) {
                    const legacyEntry = sortedLegacy[i];
                    if (legacyEntry?.character) {
                        const legacyCharacter = characterCreator("" + legacyEntry.character, data);
                        if (legacyCharacter) {
                            previousCharacters.set(legacyEntry.date, legacyCharacter);
                        }
                    }
                }
            }
            const player = new Ck3Player(playerName, character, previousCharacters);
            players.push(player);
        }
        return players;
    }

    public getCK3(): CK3 {
        return this.ck3;
    }

    findDataAndCreateCharacter(data: any, characterId: string): Character | null {
        const index = parseInt(characterId);
        let charData = null;
        if (data.living && data.living[index]) {
            charData = data.living[index];
        } else if (data.dead_unprunable && data.dead_unprunable[index]) {
            charData = data.dead_unprunable[index];
        } else if (data.dead_prunable && data.dead_prunable[index]) {
            charData = data.dead_prunable[index];
        } else {
            console.warn(`Character with ID ${characterId} not found in living or dead data.`);
            return null;
        }
        const char = Character.fromRawData(characterId, charData, this, this.ck3);
        this.cachedCharacters.set(characterId, char);
        return char;
    }

    getCharacter(characterId: number) {
        if (this.cachedCharacters.has("" + characterId)) {
            return this.cachedCharacters.get("" + characterId)!;
        }
        return this.findDataAndCreateCharacter({
            living: this.livingCharacters,
            dead_unprunable: this.deadUnprunableCharacters,
        }, "" + characterId,);
    }

    public getDynastyHouseAndDynastyData(houseId: number) {
        throw new Error("Method not implemented.");
        /*if (this.data.dynasties && this.data.dynasties.dynasty_house && this.data.dynasties.dynasty_house[houseId]) {
            return new DynastyHouse(houseId, this.data.dynasties.dynasty_house[houseId], this);
        }
        return null;
        **/
    }

    getLandedTitles() {
        return this.landedTitles;
    }

    getCurrentDate(): Date {
        throw new Error("Method not implemented.");
    }

    getTitleByIndex(index: number): AbstractLandedTitle {
        if (index < 0 || index >= this.landedTitles.length) {
            throw new Error("Invalid title index: " + index + ". Expected [0, " + (this.landedTitles.length - 1) + "]");
        }
        return this.landedTitles[index];
    }

    getHeldTitles(character: Character): AbstractLandedTitle[] {
        return this.landedTitles.filter(title => title.getHolder() != null && title.getHolder()!.getCharacterId() === character.getCharacterId());
    }

    getPlayerNameByCharacterId(characterId: string): string | null {
        throw new Error("Method not implemented.");
    }

    getCulture(cultureIndex: number): Culture {
        throw new Error("Method not implemented.");
    }

    getFaith(faithIndex: number): Faith {
        throw new Error("Method not implemented.");
    }

    getPlayers(): Ck3Player[] {
        return this.players;
    }

    getLivingCharactersFiltered(filter: (character: Character) => boolean): Character[] {
        throw new Error("Method not implemented.");
    }

    getHolding(index: number): Holding {
        throw new Error("Method not implemented.");
    }

    getTitle(key: string): AbstractLandedTitle {
        const index = this.titleKey2Index.get(key);
        if (index !== undefined) {
            return this.landedTitles[index];
        }
        throw new Error(`Title with key ${key} not found.`);
    }

}