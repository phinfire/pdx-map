
export class Eu4SaveCountry {

    constructor(private tag: string, private countryData: any) {
        if (tag.startsWith("Z0A")) {
            console.log(`Loaded country ${tag}`, countryData);
        }
    }

    getColor(): number[] {
        return Array.from(this.countryData.colors.map_color)
    }

    getTag(): string {
        return this.tag;
    }

    getSubjectTags(): string[] {
        return this.countryData.subjects || [];
    }

    getOverlordTag(): string | null {
        return this.countryData.overlord || null;
    }

    isIndependent(): boolean {
        return this.getOverlordTag() === null;
    }

    getName(): string {
        return this.countryData.name || this.getTag();
    }
}