export class Faith {

    constructor(private faithId: number, private faithData: any) {
        
    }

    getId() {
        return this.faithId;
    }

    getName() {
        return this.faithData.name ? this.faithData.name : this.faithData.tag;
    }
}