import { Character } from "../Character";
import { Ck3Player } from "../Player";
import { Faith } from "../Faith";
import { Culture } from "../Culture";
import { DynastyHouse } from "../DynastyHouse";
import { Holding } from "../Holding";
import { AbstractLandedTitle } from "../title/AbstractLandedTitle";
import { CK3 } from "../CK3";

function readPlayers(data: any, characterCreator: (id: string, data: any) => Character | null): Ck3Player[] {
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

/**
 * Reads all Faiths from the save data
 * @param data The save data containing religion information
 * @returns Array of Faith objects
 */
export function readAllFaiths(data: any): Faith[] {
    const faiths: Faith[] = [];
    const faithsData = data.religion?.faiths;
    if (faithsData && typeof faithsData === "object") {
        for (const faithId in faithsData) {
            if (Object.prototype.hasOwnProperty.call(faithsData, faithId)) {
                faiths.push(new Faith(Number(faithId), faithsData[faithId]));
            }
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
        for (const cultureId in culturesData) {
            if (Object.prototype.hasOwnProperty.call(culturesData, cultureId)) {
                cultures.push(new Culture(Number(cultureId), culturesData[cultureId]));
            }
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
    const cachedCountyKey2LandedTitle = new Map<string, AbstractLandedTitle>();
    if (data.landed_titles?.landed_titles) {
        for (let i of Object.keys(data.landed_titles.landed_titles)) {
            if (data.landed_titles.landed_titles[i].key && data.landed_titles.landed_titles[i].key.startsWith("c_")) {
                const key = data.landed_titles.landed_titles[i].key;
                cachedCountyKey2LandedTitle.set(key, titleCreator(data.landed_titles.landed_titles[i]));
            }
        }
    }
    return cachedCountyKey2LandedTitle;
}