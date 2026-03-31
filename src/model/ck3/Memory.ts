export class Memory {

    fromRawData(data: any) {
        return new Memory(data.type);
    }

    constructor(private type: string) {

    }

    getType() {
        return this.type;
    }
}