export class LabeledAndIconed<T> {
    constructor(
        public readonly categoryLabel: string | null,
        public readonly label: string,
        public readonly icon: string,
        public readonly target: T
    ) {        

    }   
}