import { Good } from "./Good";

export class MapStateRegion {

    private readonly tiles: Set<string>;

    constructor(private name: string, private identifier: string, tiles: Set<string>, private arableLand: number, private possibleFarmTypes: Set<string>, private mineralResource2SlotCount: Map<string, number>) {
        this.tiles = Object.freeze(tiles);
    }

    getIdentifier(): string {
        return this.identifier;
    }

    getTiles(): ReadonlySet<string> {
        return this.tiles;
    }

    getArableLand(): number {
        return this.arableLand;
    }

    getPossibleFarmTypes(): ReadonlySet<string> {
        return this.possibleFarmTypes;
    }

    getMineralResourceSlot(resource: string): number {
        return this.mineralResource2SlotCount.get(resource) ?? 0;
    }
}