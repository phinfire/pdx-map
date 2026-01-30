import { OwnershipChange } from "../../common/OwnershipChange";
import { Eu4Save } from "./Eu4Save";
import { Eu4SaveCountry } from "./Eu4SaveCountry";

export class Eu4SaveProvince {

    static fromRawData(id: string, data: any) {
        if (id == null || data == null) {
            throw new Error("Invalid parameters: id and data must not be null or undefined.");
        }
        const name = data.name;
        const development = [data.base_tax, data.base_production, data.base_manpower];
        const buildings = data.buildings == null ? [] : Object.keys(data.buildings);
        const tradePower = data.trade_power || 0;
        const ownerTag = data.owner || null;
        return new Eu4SaveProvince(id, name, development, buildings, tradePower, ownerTag, data);
    }

    constructor(private id: string, private name: string, private development: number[], private buildings: string[], private tradePower: number, private ownerTag: string | null, private data: any) {
        
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            development: this.development,
            buildings: this.buildings,
            tradePower: this.tradePower,
            ownerTag: this.ownerTag,
            data: this.data
        };
    }

    getId(): string {
        return this.id;
    }

    getName(): string {
        return this.name;
    }

    getDevelopment(): number[] {
        return this.development;
    }

    getBuildings(): string[] {
        return this.buildings;
    }

    getTradePower(): number {
        return this.tradePower;
    }

    getOwnerTag(): string | null {
        return this.ownerTag;
    }

    getOwner(save: Eu4Save): Eu4SaveCountry | null {
        return this.ownerTag ? save.getCountry(this.ownerTag) : null;
    }

    getOwnershipChanges(save: Eu4Save): OwnershipChange<Date, Eu4SaveProvince, Eu4SaveCountry>[] {
        const changes = [];
        let previousOwner = null;
        for (const date of Object.keys(this.data.history)) {
            const entry = this.data.history[date];
            if (entry.owner) {
                const newOwner = save.getCountry(entry.owner);
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