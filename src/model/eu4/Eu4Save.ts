import { OwnershipChange } from "../common/OwnershipChange";
import { Eu4SaveCountry } from "./Eu4SaveCountry";
import { Eu4SaveProvince } from "./Eu4SaveProvince";

export class Eu4Save {

    private cachedProvinces: Map<string,Eu4SaveProvince> = new Map<string,Eu4SaveProvince>();
    private cachedCountries: Map<string,Eu4SaveCountry> = new Map<string,Eu4SaveCountry>();

    constructor(private jsonData: any) {
    
    }

    getCountry(tag: string) {
        if (!this.cachedCountries.has(tag)) {
            const data = this.jsonData.countries[tag];
            if (data) {
                const country = new Eu4SaveCountry(tag, data);
                this.cachedCountries.set(tag, country);
            } else {
                throw new Error(`Country with tag ${tag} not found.`);
            }
        }
        return this.cachedCountries.get(tag)!;
    }

    private getProvinceIds(): string[] {
        return Object.keys(this.jsonData.provinces).map((id) => id.substring(1));
    }

    getProvinces() {
        if (this.cachedProvinces.size === 0) {
            const provinceIds = this.getProvinceIds();
            provinceIds.forEach((id) => {
                const data = this.jsonData.provinces["-" + id];
                const province = new Eu4SaveProvince(id, data, this);
                if (!(data.trade_power == undefined || data.trade_power == null || data.trade_power == 0)) {
                    this.cachedProvinces.set(id, province);
                }
            });
        }
        return this.cachedProvinces;
    }

    getAllExistingCountryTags(): Set<string> {
        return new Set(Array.from(this.getProvinces().values()).map(prov => prov.getOwner() ? prov.getOwner()!.getTag() : null).filter(tag => tag !== null));
    }
}