import { Building } from "./Building";
import { CK3 } from "./game/CK3";

export class Holding {

    public static fromRawData(index: string, data: any, ck3: CK3): Holding {
        return new Holding(index, data, ck3);
    }

    public static readonly TYPE_CASTLE = "castle_holding";
    public static readonly TYPE_CHURCH = "church_holding";
    public static readonly TYPE_CITY = "city_holding";
    public static readonly TYPE_TRIBAL = "tribal_holding";

    private constructor(private index: string, private data: any, private ck3: CK3) {

    }

    getIndex() {
        return this.index;
    }

    getHoldingType() {
        return this.data.type;
    }   

    getIncome() {
        return this.data.income;
    }

    getLevy() {
        return this.data.levy || 0;
    }

    getGarrison() {
        return this.data.garrison;
    }

    getBuildings() {
        return this.data.buildings.map((building: any) => new Building(building.type, this.ck3.getBuildingData(building.type), this.ck3));
    }
}