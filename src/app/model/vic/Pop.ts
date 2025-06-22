export class Pop {
    
    public static fromRawData(rawData: any): Pop {
        return new Pop(
            rawData["type"],
            rawData["workforce"] || 0,
            rawData["dependents"] || 0,
            rawData["num_literate"] || 0,
            rawData["wealth"] || 0
        );
    }

    public static fromJson(json: any): Pop {
        return new Pop(
            json.type,
            json.workforce,
            json.dependents,
            json.literateWorkers,
            json.wealth
        );
    }

    constructor(private type: string, private workforce: number, private dependents: number, private literateWorkers: number, private wealth: number) {

    }

    getSize(): number {
        return this.workforce + this.dependents;
    }

    getType(): string {
        return this.type;
    }

    toJson(): any {
        return {
            type: this.type,
            workforce: this.workforce,
            dependents: this.dependents,
            literateWorkers: this.literateWorkers,
            wealth: this.wealth
        };
    }
}