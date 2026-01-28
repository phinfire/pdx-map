export class Plotable {
    constructor(
        public readonly label: string,
        public readonly value: number,
        public readonly color: string,
        private readonly imageUrl?: string
    ) {}

    public getImageUrl(): string | undefined {
        return this.imageUrl;
    }
}