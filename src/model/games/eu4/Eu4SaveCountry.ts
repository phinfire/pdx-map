export class Eu4SaveCountry {

    static fromRawData(tag: string, countryData: any, playerName: string | null) {
        const color = Array.from(countryData.colors.map_color);
        const subjects = countryData.subjects || [];
        const overlord = countryData.overlord || null;
        const name = countryData.name || tag;
        return new Eu4SaveCountry(tag, color as number[], subjects, overlord, name, playerName);
    }

    constructor(private tag: string, private color: number[], private subjects: string[], private overlord: string | null, private name: string, private playerName: string | null) {
        
    }

    toJSON(): any {
        return {
            tag: this.tag,
            color: this.color,
            subjects: this.subjects,
            overlord: this.overlord,
            name: this.name,
            playerName: this.playerName
        };
    }

    getColor(): number[] {
        return this.color;
    }

    getTag(): string {
        return this.tag;
    }

    getSubjectTags(): string[] {
        return this.subjects;
    }

    getOverlordTag(): string | null {
        return this.overlord;
    }

    isIndependent(): boolean {
        return this.getOverlordTag() === null;
    }

    getName(): string {
        return this.name;
    }
    
    getPlayerName(): string | null {
        return this.playerName;
    }
}