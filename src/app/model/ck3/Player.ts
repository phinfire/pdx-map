import { SimplifiedDate } from "../common/SimplifiedDate";
import { Character } from "./Character";

export class Ck3Player {

    constructor(private name: string, private currentCharacter: Character | null, private previousCharacters: Map<string,Character>) {

    }

    getName(): string {
        return this.name;
    }

    getCurrentCharacter(): Character | null {
        return this.currentCharacter;
    }

    getPreviousCharacters() {
        return this.previousCharacters;
    }
}