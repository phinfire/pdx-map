import { Character } from "../../model/ck3/Character";
import { County } from "../../model/ck3/County";
import { Culture } from "../../model/ck3/Culture";
import { DynastyHouse } from "../../model/ck3/DynastyHouse";
import { Faith } from "../../model/ck3/Faith";
import { CK3 } from "../../model/ck3/game/CK3";
import { Holding } from "../../model/ck3/Holding";
import { Ck3Player } from "../../model/ck3/Player";
import { RulerTier } from "../../model/ck3/RulerTier";
import { ICk3Save } from "../../model/ck3/save/ICk3Save";
import { AbstractLandedTitle } from "../../model/ck3/title/AbstractLandedTitle";
import { CustomLandedTitle } from "../../model/ck3/title/CustomLandedTitle";
import { LandedTitle } from "../../model/ck3/title/LandedTitle";
import { Trait } from "../../model/ck3/Trait";
import { RGB } from "../RGB";

export function readPlayers(data: any, characterCreator: (id: string) => Character | null) {
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
        const characterObject = playerData.character === (32 ** 2 - 1) ? characterCreator("" + playerData.character) : null;
        if (!characterObject) {
            //console.warn(`Skipping player '${playerName}' with invalid character ID: ${playerData.character}`);
            //continue;
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
                    const legacyCharacter = characterCreator("" + legacyEntry.character);
                    if (legacyCharacter) {
                        previousCharacters.set(legacyEntry.date, legacyCharacter);
                    }
                }
            }
        }
        const player = new Ck3Player(playerName, characterObject, previousCharacters);
        players.push(player);
    }
    return players;
}

export function readDynasties(data: any, dynasty2LivingCharacters: Map<string, Character[]>, dynasty2DeadCharacters: Map<string, Character[]>) {
    const dynasties = new Map<string, DynastyHouse>();
    const dynastyHouseData = data.dynasties?.dynasty_house || {};
    for (const id of Object.keys(dynastyHouseData)) {
        dynasties.set(id, new DynastyHouse(id, dynastyHouseData[id], dynasty2LivingCharacters.get(id) || [], dynasty2DeadCharacters.get(id) || []));
    }
    return dynasties;
}

/**
 * Reads all Faiths from the save data
 * @param data The save data containing religion information
 * @returns Array of Faith objects
 */
export function readAllFaiths(data: any): Faith[] {
    const faiths: Faith[] = [];
    const faithsData = data.religion?.faiths;
    if (faithsData && typeof faithsData === "object") {
        for (const faithId of Object.keys(faithsData)) {
            faiths.push(new Faith(Number(faithId), faithsData[faithId]));
        }
    }
    return faiths;
}

/**
 * Reads all Cultures from the save data
 * @param data The save data containing culture manager information
 * @returns Array of Culture objects
 */
export function readAllCultures(data: any): Culture[] {
    const cultures: Culture[] = [];
    const culturesData = data.culture_manager?.cultures;
    if (culturesData && typeof culturesData === "object") {
        for (const cultureId of Object.keys(culturesData)) {
            cultures.push(new Culture(Number(cultureId), culturesData[cultureId]));
        }
    }
    return cultures;
}

export function readVassal2Liege(data: any) {
    const vassal2Liege = new Map<number, number>();
    if (data.landed_titles?.landed_titles) {
        const distinctHolders = new Set<number>();
        for (let i of Object.keys(data.landed_titles.landed_titles)) {
            const element = data.landed_titles.landed_titles[i];
            if (element.holder && element.de_facto_liege) {
                const vassal = element.holder;
                distinctHolders.add(vassal);
                const liege = data.landed_titles.landed_titles[element.de_facto_liege].holder;
                if (!(vassal == liege || vassal2Liege.has(vassal) && vassal2Liege.get(vassal) != liege)) {
                    vassal2Liege.set(vassal, liege);
                }
            }
        }
    }
    return vassal2Liege;
}

export function readLandedTitles(data: any, titleCreator: (titleData: any) => AbstractLandedTitle) {
    const landedTitles: Map<string, AbstractLandedTitle> = new Map();
    if (data.landed_titles?.landed_titles) {
        for (let i of Object.keys(data.landed_titles.landed_titles)) {
            if (data.landed_titles.landed_titles[i].key) {
                const title = titleCreator(data.landed_titles.landed_titles[i]);
                landedTitles.set(i, title);
            }
        }
    }
    return landedTitles;
}

export function createTitle(data: any, save: ICk3Save, ck3: CK3): AbstractLandedTitle {
    const key = data.key;
    const holder = data.holder;
    const de_facto_liege = data.de_facto_liege;
    const capitalHoldingIndex = data.capital || null;
    const deJureVassalIndices = data.de_jure_vassals || [];
    if (key.startsWith("x_")) {
        if (!data.color) {
            console.warn("Custom landed title missing color", data);
        }
        const rgb = data.color != null ? new RGB(data.color.rgb[0], data.color.rgb[1], data.color.rgb[2]) : new RGB(255, 0, 0);
        const tierString = data.tier ? RulerTier.fromRealmTier(data.tier) : RulerTier.NONE;
        const name = data.title_name_data.name;
        return new CustomLandedTitle(key, holder, de_facto_liege, rgb, tierString, deJureVassalIndices, name, capitalHoldingIndex, save, ck3);
    } else {
        return new LandedTitle(key, holder, de_facto_liege, deJureVassalIndices, capitalHoldingIndex, save, ck3);
    }
}

export function readCountries(data: any, save: ICk3Save, ck3: CK3): County[] {
    const countries: County[] = [];
    if (data.county_manager!.counties) {
        for (let countyKey of Object.keys(data.county_manager.counties)) {
            countries.push(County.fromRawData(countyKey, data.county_manager.counties[countyKey], save, ck3));
        }
    }
    return countries;
}

export function readAllHoldings(data: any, parentSave: ICk3Save, ck3: CK3) {
    const index2Holding = new Map<string, Holding>();
    if (data.provinces) {
        for (let provinceId of Object.keys(data.provinces)) {
            const provinceData = data.provinces[provinceId];
            if (provinceData.holding) {
                const holding = Holding.fromRawData(provinceId + "", provinceData.holding, ck3);
                index2Holding.set(provinceId + "", holding);
            }
        }
    }
    return index2Holding;
}

export function createAllCharacters(data: any, save: ICk3Save, ck3: CK3) {
    const memoryData = data.character_memory_manager.database;
    return {
        living: createCharacterMapFromData(data.living || {}, save, ck3, memoryData),
        deadUnprunable: createCharacterMapFromData(data.dead_unprunable || {}, save, ck3, memoryData),
        deadPrunable: createCharacterMapFromData(data.dead_prunable || {}, save, ck3, memoryData)
    };
}

function createCharacterMapFromData(data: any, save: ICk3Save, ck3: CK3, memoryData: any): Map<string, Character> {
    const characters = new Map<string, Character>();
    for (const characterId of Object.keys(data)) {
        const char = Character.fromRawData(characterId, data[characterId], save, ck3, memoryData);
        characters.set(characterId, char);
    }
    return characters;
}

export function parseLocalisations(localisationMaps: [Map<string, string>, Map<string, string>]): Map<string, string> {
    const locs = new Map<string, string>();
    localisationMaps.forEach(map => {
        map.forEach((value, key) => locs.set(key, value));
    });
    return locs;
}

export function parseTraits(data: string, parser: any): Trait[] {
    const traits: Trait[] = [];
    const parsed = parser.parseText(data);
    let i = 0;
    for (const key of Object.keys(parsed)) {
        if (!key.startsWith("@")) {
            traits.push(new Trait(key, parsed[key], i++));
        }
    }
    console.log("Parsed traits:", traits);
    return traits;
}

export function parsePreparsedLandedTitles(jsonString: string) {
        const titleData = JSON.parse(jsonString);
        const titleKey2Color = new Map<string, RGB>();
        const county2Baronies = new Map<string, string[]>();
        const barony2provinceIndices = new Map<string, number>();
        const vassalTitle2OverlordTitle = new Map<string, string>();
        for (const filename of Object.keys(titleData)) {
            const parsedContent = titleData[filename];
            for (const key of Object.keys(parsedContent)) {
                CK3.recursivelyInsertBaronyIndices(
                    parsedContent[key],
                    key,
                    titleKey2Color,
                    county2Baronies,
                    barony2provinceIndices,
                    vassalTitle2OverlordTitle
                );
            }
        }

        return { titleKey2Color, county2Baronies, barony2provinceIndices, vassalTitle2OverlordTitle };
    }