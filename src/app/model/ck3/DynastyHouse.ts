import { Save } from "../Save";
import { Character } from "./Character";

export class DynastyHouse {

    constructor(private id: number, private data: any, private save: Save) {

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