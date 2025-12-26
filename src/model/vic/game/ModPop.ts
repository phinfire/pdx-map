export class ModPop {
    constructor(
        public readonly state: string,
        public readonly countryTag: string,
        public readonly culture: string,
        public readonly religion: string,
        public readonly size: number
    ) { }

    getScaled(scalingFactor: number): ModPop {
        return new ModPop(
            this.state,
            this.countryTag,
            this.culture,
            this.religion,
            Math.floor(this.size * scalingFactor)
        );
    }
}