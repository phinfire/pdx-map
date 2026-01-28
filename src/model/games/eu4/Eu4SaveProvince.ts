import { OwnershipChange } from "../../common/OwnershipChange";
import { Eu4Save } from "./Eu4Save";
import { Eu4SaveCountry } from "./Eu4SaveCountry";

export class Eu4SaveProvince {
 
    constructor(private id: string, private data: any, private save: Eu4Save) {
        if (this.id == null || this.data == null) {
            throw new Error("Invalid parameters: id and data must not be null or undefined.");
        }
    }
    
    getId(): string {
        return this.id;
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