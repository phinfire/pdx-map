import { Good } from "./Good";
import { ResourceType } from "../enum/ResourceType";

export class MapStateRegion {

    private readonly tiles: Set<string>;

    constructor(
        private name: string,
        private identifier: string,
        tiles: Set<string>,
        private arableLand: number,
        private possibleFarmTypes: Set<string>,
        private arableResources: Map<string, number>,
        private otherResources: Map<string, number>,
        private filename: string,
        private id?: number,
        private subsistence_building?: string,
        private traits: Set<string> = new Set(),
        private city?: string,
        private port?: string,
        private farm?: string,
        private mine?: string,
        private wood?: string,
        private cappedResources: Map<string, number> = new Map(),
        private naval_exit_id?: number,
        private uncappedResources: Array<{ type: string; undiscovered_amount: number }> = []
    ) {
        this.tiles = Object.freeze(tiles);
        // Ensure arable land is always an integer
        this.arableLand = Math.round(arableLand);
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

    getArableResources(): ReadonlyMap<string, number> {
        return new Map(this.arableResources);
    }

    getOtherResources(): ReadonlyMap<string, number> {
        return new Map(this.otherResources);
    }

    getCappedResources(): ReadonlyMap<string, number> {
        return new Map(this.cappedResources);
    }

    getUncappedResources(): ReadonlyArray<{ type: string; undiscovered_amount: number }> {
        return [...this.uncappedResources];
    }

    getId(): number | undefined {
        return this.id;
    }

    getSubsistenceBuilding(): string | undefined {
        return this.subsistence_building;
    }

    getTraits(): ReadonlySet<string> {
        return new Set(this.traits);
    }

    getCity(): string | undefined {
        return this.city;
    }

    getPort(): string | undefined {
        return this.port;
    }

    getFarm(): string | undefined {
        return this.farm;
    }

    getMine(): string | undefined {
        return this.mine;
    }

    getWood(): string | undefined {
        return this.wood;
    }

    getResourceType(resourceName: string): ResourceType | null {
        if (this.arableResources.has(resourceName)) {
            return ResourceType.ARABLE;
        }
        if (this.cappedResources.has(resourceName)) {
            return ResourceType.CAPPED;
        }
        if (this.uncappedResources.some(r => r.type === resourceName)) {
            return ResourceType.UNCAPPED;
        }
        return null;
    }

    getNavalExitId(): number | undefined {
        return this.naval_exit_id;
    }

    getMineralResourceSlot(resource: string): number {
        return this.arableResources.get(resource) ?? this.otherResources.get(resource) ?? 0;
    }

    getFilename(): string {
        return this.filename;
    }

    getName(): string {
        return this.name;
    }

    withArableLand(arableLand: number): MapStateRegion {
        return new MapStateRegion(
            this.name,
            this.identifier,
            this.tiles,
            arableLand,
            this.possibleFarmTypes,
            this.arableResources,
            this.otherResources,
            this.filename,
            this.id,
            this.subsistence_building,
            this.traits,
            this.city,
            this.port,
            this.farm,
            this.mine,
            this.wood,
            this.cappedResources,
            this.naval_exit_id,
            this.uncappedResources
        );
    }
}