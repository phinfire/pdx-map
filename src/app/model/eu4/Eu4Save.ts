import { OwnershipChange } from "../common/OwnershipChange";

export class Eu4SaveProvince {
 
    constructor(private id: string, private data: any, private save: Eu4Save) {
        if (this.id == null || this.data == null) {
            throw new Error("Invalid parameters: id and data must not be null or undefined.");
        }
    }

    getName(): string {
        return this.data.name;
    }

    getDevelopment(): number[] {
        return [this.data.base_tax, this.data.base_production, this.data.base_manpower];
    }

    getBuildings(): string[] {
        if (this.data.buildings == null) {
            return [];
        }
        return Object.keys(this.data.buildings);
    }

    getTradePower(): number {
        return this.data.trade_power || 0;
    }

    getOwner(): Eu4SaveCountry | null {
        if (this.data.owner == null) {
            return null
        }
        return this.save.getCountry(this.data.owner);
    }

    getOwnershipChanges(): OwnershipChange<Date,Eu4SaveProvince,Eu4SaveCountry>[] {
        const changes = [];
        let previousOwner = null;
        for (const date of Object.keys(this.data.history)) {
            const entry = this.data.history[date];
            if (entry.owner) {
                const newOwner = this.save.getCountry(entry.owner);
                changes.push({
                    date: new Date(entry.date),
                    province: this,
                    oldOwner: previousOwner,
                    newOwner: newOwner
                });
                previousOwner = newOwner;
            }
        }
        return changes;
    }
}

export class Eu4SaveCountry {

    constructor(private tag: string, private countryData: any) {

    }

    getColor(): number[] {
        return Array.from(this.countryData.colors.map_color)
    }

    getTag(): string {
        return this.tag;
    }
}

export class Eu4Save {

    private cachedProvinces: Map<string,Eu4SaveProvince> = new Map<string,Eu4SaveProvince>();
    private cachedCountries: Map<string,Eu4SaveCountry> = new Map<string,Eu4SaveCountry>();

    constructor(private jsonData: any) {
    
    }

    getCountry(tag: string) {
        if (!this.cachedCountries.has(tag)) {
            const data = this.jsonData.countries[tag];
            if (data) {
                const country = new Eu4SaveCountry(tag, data);
                this.cachedCountries.set(tag, country);
            } else {
                throw new Error(`Country with tag ${tag} not found.`);
            }
        }
        return this.cachedCountries.get(tag)!;
    }

    private getProvinceIds(): string[] {
        return Object.keys(this.jsonData.provinces).map((id) => id.substring(1));
    }

    getProvinces() {
        if (this.cachedProvinces.size === 0) {
            const provinceIds = this.getProvinceIds();
            provinceIds.forEach((id) => {
                const data = this.jsonData.provinces["-" + id];
                const province = new Eu4SaveProvince(id, data, this);
                if (!(data.trade_power == undefined || data.trade_power == null || data.trade_power == 0)) {
                    this.cachedProvinces.set(id, province);
                }
            });
        }
        return this.cachedProvinces;
    }
}