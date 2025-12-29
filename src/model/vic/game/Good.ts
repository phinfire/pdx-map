import { GoodCategory } from "../enum/GoodCategory";

export class Good {

    public readonly name: string;

    constructor(public readonly key: string, public readonly index: number, public readonly category: GoodCategory, public readonly locKey: string) {
        this.name = key.charAt(0).toUpperCase() + key.slice(1);
    }

    getIconUrl(): string {
        return "https://codingafterdark.de/pdx-map-gamedata/vic3/goods_icons/" + this.key + ".webp";
    }
}