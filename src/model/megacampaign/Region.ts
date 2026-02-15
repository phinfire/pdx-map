export class Region {

    constructor(public readonly name: string,
        public readonly plusElements: Set<string>,
        public readonly minusElements: Set<string>,
        public readonly baseElements: Set<string>) { }
}