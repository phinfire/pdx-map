export class ResourceHaver {

    constructor(private identifier: string,
        private arableLand: number,
        private possibleFarmTypes: Set<string>,
        private arableResources: Map<string, number>,
        private otherResources: Map<string, number>) {
        this.arableLand = Math.round(arableLand);
    }

        getIdentifier(): string {
        return this.identifier;
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
}