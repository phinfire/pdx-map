import { Jomini } from "jomini";
import { CK3 } from "./CK3";
import { Character } from "./Character";
import { Faith } from "./Faith";
import { Culture } from "./Culture";
import { DynastyHouse } from "./DynastyHouse";
import { Holding } from "./Holding";
import { County } from "./County";
import { SimplifiedDate } from "../common/SimplifiedDate";
import { OwnershipChange } from "../common/OwnershipChange";
import { AbstractLandedTitle } from "./title/AbstractLandedTitle";
import { ICk3Save } from "./save/ICk3Save";

export class LegacyCk3Save {
    /*
    static fromRawData(data: any, ck3: CK3) {
        return new LegacyCk3Save(ck3);
    }

    private playerName2PlayerData: Map<string,any> = new Map<string,any>();
    private vassal2Liege: Map<number, number> = new Map<number, number>();
    private cachedCountyKey2LandedTitle = new Map<string, AbstractLandedTitle>();
    private playerName2Character = new Map<string, Character>();
    private cachedLandedTitles = new Map<string, AbstractLandedTitle>();
    private data: any = null;

    private constructor(private ck3: CK3) {
        //this.populateLookups();
    }

    public getCurrentDate() : Date {
        if (!this.data?.meta_data?.meta_date) {
            throw new Error("Invalid save data: missing meta_data.meta_date");
        }
        const [year,month,day] = this.data.meta_data.meta_date.split(".");
        if (!year || !month || !day) {
            throw new Error("Invalid date format in save data");
        }
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }

    public setData(data: any) {
        this.data = data;
        this.populateLookups();
    }

    async fromSavefileContent(content: string) {
        try {
            await Jomini.initialize().then((parser) => {
                const out = parser.parseText(content, {}, (q) => q.json());
                this.data = JSON.parse(out);
                this.populateLookups();
            });
        } catch (error) {
            throw new Error(`Failed to parse save file content: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private populateLookups() {
        console.log("Populating lookups for CK3 save data...");
        // Safely handle played_character data
        if (!this.data.played_character) {
            console.warn("No played_character data found in save");
            return;
        }

        let playedCharacters = [];
        if ((!Array.isArray(this.data.played_character))) {
            playedCharacters = [this.data.played_character];
        } else {
            playedCharacters = this.data.played_character;
        }
        for (let playerData of playedCharacters) {
            if (!playerData?.name) {
                console.warn("Player data missing name field:", playerData);
                continue;
            }
            this.playerName2PlayerData.set(playerData.name, playerData);
        }

        Array.from(this.playerName2PlayerData.keys()).forEach(playerName => {
            try {
                const playerData = this.playerName2PlayerData.get(playerName);
                if (!playerData) return;
                
                const character = this.getCharacter(playerData.character);
                if (character != null) {
                    this.playerName2Character.set(playerName, character);
                } else if (playerData.legacy && Array.isArray(playerData.legacy)) {
                    const sortedLegacy = playerData.legacy.sort(((a: any, b: any) => b.date.localeCompare(a.date)));
                    if (sortedLegacy.length > 0) {
                        const character = this.getCharacter(sortedLegacy[0].character);
                        if (character != null) {
                            this.playerName2Character.set(playerName, character);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing player ${playerName}:`, error);
            }
        });

        if (this.data.landed_titles?.landed_titles) {
            const distinctHolders = new Set<number>();
            for (let i of Object.keys(this.data.landed_titles.landed_titles)) {
                const element = this.data.landed_titles.landed_titles[i];
                if (element.holder && element.de_facto_liege) {
                    const vassal = element.holder;
                    distinctHolders.add(vassal);
                    const liege = this.data.landed_titles.landed_titles[element.de_facto_liege].holder;
                    if (!(vassal == liege || this.vassal2Liege.has(vassal) && this.vassal2Liege.get(vassal) != liege)) {
                        this.vassal2Liege.set(vassal, liege);
                    }
                }
            }

            for (let i of Object.keys(this.data.landed_titles.landed_titles)) {
                if (this.data.landed_titles.landed_titles[i].key && this.data.landed_titles.landed_titles[i].key.startsWith("c_")) {
                    this.cachedCountyKey2LandedTitle.set(this.data.landed_titles.landed_titles[i].key, AbstractLandedTitle.fromRawData(this.data.landed_titles.landed_titles[i], this, this.ck3));
                }
            }
        }
    }
    
    public getPlayerCharacters(onlyActive: boolean) : Character[] {
        const result = Array.from(this.playerName2PlayerData.keys()).map(player => {
            const playerData = this.getPlayerDataBlock(player);
            if (!playerData) {
                console.warn(`Player data not found for: ${player}`);
                return null;
            }
            const character = this.getCharacter(playerData.character);
            if (character != null) {
                return character;
            } else {
                if (!playerData.legacy || !Array.isArray(playerData.legacy)) {
                    console.warn(`No legacy data found for player: ${player}`);
                    return null;
                }
                const legacyCharacters = playerData.legacy.map((legacyCharacter: any) => {
                    return this.getCharacter(legacyCharacter.character);
                }).filter((character: any) => character != null);
                return legacyCharacters.length > 0 ? legacyCharacters[0] : null;
            }
        }).filter((character: any) => character != null); // TODO: onlyActive
        return Array.from(result);
    }

    public getPlayers(onlyActive: boolean) {
        return Array.from(this.playerName2PlayerData.keys()).filter(player => {
            const playerData = this.getPlayerDataBlock(player);
            return !onlyActive || this.data.currently_played_characters.indexOf(playerData.character) != -1;
        });
    }

    public getPlayerDataBlock(player: string) {
        const playerData = this.playerName2PlayerData.get(player);
        if (!playerData) {
            throw new Error(`Player data not found for: ${player}`);
        }
        return playerData;
    }

    public characterExists(id: string) {
        if (this.data.living[id] == undefined && this.data.dead_unprunable[id] == undefined) {
            return false;
        }
        return true;
    }

    public getLivingCharactersFiltered(filter: (charData: any) => boolean) {
        return Object.keys(this.data.living).map(id => this.data.living[id]).filter(filter).map(charData => Character.fromRawData(charData.id, charData, this, this.ck3));
    }

    public getCharacter(id: number) {
        if (!id || typeof id !== 'string') {
            console.warn('Invalid character ID provided:', id);
            return null;
        }
        
        if (this.data.living?.[id]) {
            return Character.fromRawData(id, this.data.living[id], this, this.ck3);
        }
        if (this.data.dead_unprunable?.[id]) {
            return Character.fromRawData(id, this.data.dead_unprunable[id], this, this.ck3);
        }
        return null;
    }

    public getFaith(faithId: number) {
        const faithData = this.data.religion.faiths [faithId];
        if (faithData) {
            return new Faith(faithId, faithData);
        }
        throw new Error("Faith not found: " + faithId);
    }
    
    public getCulture(cultureId: number) {
        if (this.data.culture_manager.cultures[cultureId]) {
            return new Culture(cultureId, this.data.culture_manager.cultures[cultureId])
        }
        throw new Error("Culture not found: " + cultureId);
    }

    public getJsonString() {
        return JSON.stringify(this.data);
    }

    public getHeldTitles(character: Character) {
        const titleDatas = [];
        for (let key of Object.keys(this.data.landed_titles.landed_titles)) {
            if (this.data.landed_titles.landed_titles[key].holder && this.data.landed_titles.landed_titles[key].holder == character.getCharacterId()) {
                const titleData = this.data.landed_titles.landed_titles[key];
                titleDatas.push(AbstractLandedTitle.fromRawData(titleData, this, this.ck3)); 
            }
        }
        return titleDatas;
    }

    public getTitle(key: string) {
        if (this.cachedCountyKey2LandedTitle.has(key)) {
            return this.cachedCountyKey2LandedTitle.get(key)!;
        }
        for (let i of Object.keys(this.data.landed_titles.landed_titles)) {
            if (this.data.landed_titles.landed_titles[i].key == key) {
                return AbstractLandedTitle.fromRawData(this.data.landed_titles.landed_titles[i], this, this.ck3);
            }
        }
        throw new Error("Title not found: " + key);
    }

    public getAllLandedTitles() {
        if (this.cachedLandedTitles.size == 0) {
            for (let i of Object.keys(this.data.landed_titles.landed_titles)) {
                const titleData = this.data.landed_titles.landed_titles[i];
                this.cachedLandedTitles.set(titleData.key, AbstractLandedTitle.fromRawData(titleData, this, this.ck3));
            }
        }
        return Array.from(this.cachedLandedTitles.values());
    }

    public getDynastyHouseAndDynastyData(houseId: number) {
        if (this.data.dynasties && this.data.dynasties.dynasty_house && this.data.dynasties.dynasty_house[houseId]) {
            return new DynastyHouse(houseId, this.data.dynasties.dynasty_house[houseId], this);
        }
        return null;
    }

    public printInfo() {
        if (!this.data) {
            console.log("No data");
            return;
        }
        console.log("Players: ", Array.from(this.getPlayers(true)).length + "/" + Array.from(this.getPlayers(false)).length, Array.from(this.getPlayers(false)).sort())
        console.log("Living: ", Object.keys(this.data.living).length);
        console.log("Dead: ", Object.keys(this.data.dead_unprunable).length);
        
        const subtreeSizes: [string, number][] = [];
        for (let key of Object.keys(this.data)) {
            subtreeSizes.push([key, JSON.stringify(this.data[key]).length / 1000]);
        }
        subtreeSizes.sort((a,b) => b[1] - a[1]);
        const total = subtreeSizes.map(pair => pair[1]).reduce((a,b) => a + b);
        for (let [key, size] of subtreeSizes) {
            console.log(key + ": " + size + " k", (size / total * 100).toFixed(2) + "%");
        }
    }

    public getCounties() {
        const counties = [];
        if (this.data.county_manager && this.data.county_manager.counties) {
            for (let countyName of Object.keys(this.data.county_manager.counties)) {
                const county = this.data.county_manager.counties[countyName];
                counties.push(County.fromRawData(countyName, county, this, this.ck3));
            }
        }
        return counties;
    }

    public getAllHoldings() {
        this.data.provinces.map((province: any) => {
            if (province.holding) {
                return Holding.fromRawData(province.holding, this.ck3);
            }
            return null;
        }).filter((holding: any) => holding != null);
    }

    public getHolding(provinceIndex: number) {
        if (this.data.provinces[provinceIndex] && this.data.provinces[provinceIndex].holding) {
            return Holding.fromRawData(this.data.provinces[provinceIndex].holding, this.ck3);
        }
        return null;
    }

    public getTitleByIndex(index: number) {
        return AbstractLandedTitle.fromRawData(this.data.landed_titles.landed_titles[index], this, this.ck3);
    }

    public getPlayerNameByCharId(charId: number) {
        for (let playerName of this.playerName2Character.keys()) {
            if (this.playerName2Character.get(playerName)!.getCharacterId() == charId) {
                return playerName;
            }
        }
        return null;
    }

    public getCountyOwnershipChanges() {
        const change = new Map<SimplifiedDate, OwnershipChange<SimplifiedDate,AbstractLandedTitle,Character>>();
        for (let key of this.cachedCountyKey2LandedTitle.keys()) {
            if (!key.endsWith("moravia")) {
                continue
            }
            
        }
    }
    */
}