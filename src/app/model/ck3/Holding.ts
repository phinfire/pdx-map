import { CK3 } from "../CK3";
import { Building } from "./Building";

export class Holding {

    public static readonly TYPE_CASTLE = "castle_holding";
    public static readonly TYPE_CHURCH = "church_holding";
    public static readonly TYPE_CITY = "city_holding";
    public static readonly TYPE_TRIBAL = "tribal_holding";

    constructor(private data: any, private ck3: CK3) {
        
    }

    getHoldingType() {
        return this.data.type;
    }   

    getIncome() {
        return this.data.income;
    }

    getLevy() {
        if (this.data.levy> 10000) {
            console.log("levy: ", this.data.levy);
        }
        return this.data.levy || 0;
    }

    getGarrison() {
        return this.data.garrison;
    }

    getBuildings() {
        return this.data.buildings.map((building: any) => new Building(building.type, this.ck3.getBuildingData(building.type), this.ck3));
    }
}