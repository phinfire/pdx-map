export class AccumulatableCurrenty {
    
    public static NONE = new AccumulatableCurrenty({accumulated: 0, currency: 0});

    constructor(private data: any) {

    }

    getAccumulated() {
        return this.data.accumulated ? this.data.accumulated : 0;
    }

    getCurrent() {
        return this.data.currency ? this.data.currency : 0;
    }
}