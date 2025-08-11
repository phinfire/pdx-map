
import { Character } from "./Character";
import { LegacyCk3Save } from "./LegacyCk3Save";
import { ICk3Save } from "./save/ICk3Save";

export class DynastyHouse {

    constructor(private id: number, private data: any, private save: ICk3Save) {

    }

    getHeadOfHouse() {
        return this.data.head_of_house;
    }

    public getHouseMembers() {
        return this.save.getLivingCharactersFiltered((character: any) => {
            return character.dynasty_house == this.id;   
        });
    }


    public getName() {
        return this.data.localized_name ? this.data.localized_name : (this.data.name && this.data.name.startsWith("dynn_") ? this.data.name.substring(5) : this.data.name);
    }
}