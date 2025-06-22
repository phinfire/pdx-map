import { Building } from "./Building";
import { ModelElementList } from "./ModelElementList";

export class BuildingList extends ModelElementList<Building> {
    constructor(buildings: Building[]) {
        super(buildings);
    }
}