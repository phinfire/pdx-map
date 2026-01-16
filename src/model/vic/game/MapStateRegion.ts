import { ResourceType } from "../enum/ResourceType";
import { ResourceHaver } from "./ResourceHaver";

export class MapStateRegion extends ResourceHaver {

    private readonly tiles: Set<string>;

    constructor(
        identifier: string,
        tiles: Set<string>,
        arableLand: number,
        possibleFarmTypes: Set<string>,
        arableResources: Map<string, number>,
        otherResources: Map<string, number>,
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
        super(identifier, arableLand, possibleFarmTypes, arableResources, otherResources);
        this.tiles = Object.freeze(tiles);
    }

    getTiles(): ReadonlySet<string> {
        return this.tiles;
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
        if (this.getArableResources().has(resourceName)) {
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
        return this.getArableResources().get(resource) ?? this.getOtherResources().get(resource) ?? 0;
    }

    getFilename(): string {
        return this.filename;
    }

    getMaxAvailableResourceSlots(resource: string) {
        if (this.getArableResources().has(resource)) {
            return this.getArableLand();
        } else if (this.cappedResources.has(resource)) {
            return this.cappedResources.get(resource)!;
        } else if (this.uncappedResources.some(r => r.type === resource)) {
            return this.uncappedResources.find(r => r.type === resource)!.undiscovered_amount;
        }
        return 0;
    }

    withArableLand(arableLand: number): MapStateRegion {
        return new MapStateRegion(
            this.getIdentifier(),
            this.tiles,
            arableLand,
            new Set(this.getPossibleFarmTypes()),
            new Map(this.getArableResources()),
            new Map(this.getOtherResources()),
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

    getHumanReadableName(): string {
        return this.getIdentifier().replace("STATE_", "").toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
}