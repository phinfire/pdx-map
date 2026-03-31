
import { Character } from "./Character";
import { ICk3Save } from "./save/ICk3Save";

export class DynastyHouse {

    private cachedHouseMembers: Character[] | null = null;

    constructor(private id: string, private data: any, private livingMembers: Character[], private deadMembers: Character[]) {

    }

    getHeadOfHouse() {
        return this.data.head_of_house;
    }

    public getHouseMembers() {
        return this.livingMembers.concat(this.deadMembers);
    }

    public getName() {
        return this.data.localized_name ? this.data.localized_name : (this.data.name && this.data.name.startsWith("dynn_") ? this.data.name.substring(5) : this.data.name);
    }
}