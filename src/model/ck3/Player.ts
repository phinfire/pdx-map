import { SimplifiedDate } from "../common/SimplifiedDate";
import { Character } from "./Character";

export class Ck3Player {

    constructor(private name: string, private currentCharacter: Character | null, private previousCharacters: Map<string,Character>) {
        console.log("Created player", name, "with current character", currentCharacter ? currentCharacter!.getCharacterId() : "none", "and previous characters", previousCharacters);
    }

    getName(): string {
        return this.name;
    }

    /**
     * Gets the current character of the player, or null if the player has no current character i.e. is not currently part of the lobby
     * Fragile. Avoid using this method where possible.
     * @returns  The current character of the player, or null if none
     */
    getCurrentCharacter(): Character | null {
        return this.currentCharacter;
    }

    getLastPlayedCharacter(): Character | null {
        if (this.getCurrentCharacter()) {
            return this.getCurrentCharacter();
        }
        const sortedDates = Array.from(this.previousCharacters.keys()).sort((a, b) => {
            const dateA = new Date(a).getTime();
            const dateB = new Date(b).getTime();
            return dateB - dateA;
        });
        for (const date of sortedDates) {
            const char = this.previousCharacters.get(date);
            if (char && char.isAlive()) {
                return char;
            }
        }
        if (sortedDates.length > 0) {
            return this.previousCharacters.get(sortedDates[0]) || null;
        }
        return null;
    }

    getPreviousCharacters() {
        return this.previousCharacters;
    }
}