import { Character } from "../Character";
import { CK3 } from "../game/CK3";
import { County } from "../County";
import { Culture } from "../Culture";
import { DynastyHouse } from "../DynastyHouse";
import { Faith } from "../Faith";
import { Holding } from "../Holding";
import { Ck3Player } from "../Player";
import { AbstractLandedTitle } from "../title/AbstractLandedTitle";

export interface ICk3Save {

    getPlayers(): Ck3Player[];

    getIngameDate(): Date;

    getCharacter(characterId: number): Character | null;

    getDynastyHouseAndDynastyData(houseId: number): any;

    getDynastyHouse(houseId: number): DynastyHouse | null;

    getHeldTitles(character: Character): AbstractLandedTitle[];

    getPlayerNameByCharacterId(charId: string): string | null;

    getCulture(cultureIndex: number): Culture;

    getFaith(faithIndex: number): Faith;

    getTitleByIndex(index: number): AbstractLandedTitle | null;

    getLivingCharactersFiltered(filter: (character: Character) => boolean): Character[];

    getHolding(index: string): Holding | null;

    getTitle(key: string): AbstractLandedTitle;

    getCounties(): County[];

    getCK3(): CK3;

    isPlayerCharacter(character: Character): boolean;
}