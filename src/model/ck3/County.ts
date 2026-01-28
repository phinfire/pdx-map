import { CK3 } from "./CK3";
import { Holding } from "./Holding";
import { ICk3Save } from "./save/ICk3Save";

export class County {

    static fromRawData(key: string, data: any, save: ICk3Save, ck3: CK3): County {
        const faithId = parseInt(data.faith);
        const cultureId = parseInt(data.culture);
        const countyControl = data.county_control || 0;
        const development = data.development || 0;
        const developmentProgress = data.development_progress || 0;
        return new County(key, faithId, cultureId, countyControl, development, developmentProgress, save, ck3);
    }

    private constructor(
        private key: string,
        private faithId: number,
        private cultureId: number,
        private countyControl: number,
        private development: number,
        private developmentProgress: number,
        private save: ICk3Save,
        private ck3: CK3
    ) { }

    getKey() {
        return this.key;
    }

    getFaith() {
        return this.save.getFaith(this.faithId);
    }

    getCulture() {
        return this.save.getCulture(this.cultureId);
    }

    getControl() {
        return this.countyControl;
    }

    getDevelopment() {
        return this.development;
    }

    getDevelopmentProgress() {
        return this.developmentProgress;
    }

    getHoldings() {
        const baronyKeys = this.ck3.getCountyBaronies(this.key)!;
        const pairs: Array<[string, Holding]> = [];
        for (const barony of baronyKeys) {
            const provinceIndex = this.ck3.getBaronyProvinceIndex(barony);
            if (provinceIndex == null) continue;
            const holding = this.save.getHolding(provinceIndex + "");
            if (holding != null) {
                pairs.push([barony, holding]);
            }
        }
        return pairs;
    }

    getTitle() {
        return this.save.getTitle(this.key);
    }
}