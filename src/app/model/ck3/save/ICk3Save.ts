import { Character } from "../Character";
import { Culture } from "../Culture";
import { Faith } from "../Faith";
import { Holding } from "../Holding";
import { Ck3Player } from "../Player";
import { AbstractLandedTitle } from "../title/AbstractLandedTitle";

export interface ICk3Save {

    getPlayers(): Ck3Player[];

    getCurrentDate(): Date;

    getCharacter(characterId: number): any;

    getDynastyHouseAndDynastyData(houseId: number): any;

    getTitleByIndex(index: number): AbstractLandedTitle;

    getHeldTitles(character: Character): AbstractLandedTitle[];

    getPlayerNameByCharacterId(charId: string): string | null;

    getCulture(cultureIndex: number): Culture;

    getFaith(faithIndex: number): Faith;

    getTitleByIndex(index: number): AbstractLandedTitle

    getLivingCharactersFiltered(filter: (character: Character) => boolean): Character[];

    getHolding(index: number): Holding;

    getTitle(key: string): AbstractLandedTitle;
}