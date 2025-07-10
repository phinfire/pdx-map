export class GoodCategory {

    static STAPLE = new GoodCategory("staple", "Staple");
    static INDUSTRIAL = new GoodCategory("industrial", "Industrial");
    static LUXURY = new GoodCategory("luxury", "Luxury");
    static MILITARY = new GoodCategory("military", "Military");

    constructor(public readonly key: string, public readonly name: string) {
        
    }
}