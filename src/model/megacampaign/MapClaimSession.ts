import { Game } from "../Game";

export interface CountryData {
    name: string;
    color: number;
}

export class MapClaimSession {

    constructor(
        public id: number | null,
        public creatorId: string,
        public name: string,
        public game: Game,
        public countries: Map<string, CountryData>,
        public ownership: Map<string, string>,
        public isPublic: boolean
    ) {

    }
}