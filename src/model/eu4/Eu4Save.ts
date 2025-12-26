import { OwnershipChange } from "../common/OwnershipChange";
import { Eu4SaveCountry } from "./Eu4SaveCountry";
import { Eu4SaveProvince } from "./Eu4SaveProvince";

export class Eu4Save {

    private cachedProvinces: Map<string,Eu4SaveProvince> = new Map<string,Eu4SaveProvince>();
    private cachedCountries: Map<string,Eu4SaveCountry> = new Map<string,Eu4SaveCountry>();
    
    private tag2PlayerName: Map<string, string> = new Map<string, string>();


    constructor(private jsonData: any) {
        for (let i = 0; i < this.jsonData.players_countries.length; i = i + 2) {
            const playerName = this.jsonData.players_countries[i];
            const countryTag = this.jsonData.players_countries[i + 1];
            this.tag2PlayerName.set(countryTag, playerName);
        }
    }

    getCountry(tag: string) {
        if (!this.cachedCountries.has(tag)) {
            const data = this.jsonData.countries[tag];
            if (data) {
                const country = new Eu4SaveCountry(tag, data, this.tag2PlayerName.get(tag) || null);
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

    getTotalCountryDevelopment(tag: string) {
        let dev = 0;
        this.getProvinces().forEach(prov => {
            if (prov.getOwner() && prov.getOwner()!.getTag() === tag) {
                dev += prov.getDevelopment().reduce((a, b) => a + b, 0);
            }
        });
        return dev;
    }

    getVassalsOfOverlord(overlordTag: string) {
        const vassals: string[] = [];
        this.getAllExistingCountryTags().forEach(tag => {
            const country = this.getCountry(tag);
            if (country.getOverlordTag() === overlordTag) {
                vassals.push(tag);
            }
        });
        return vassals;
    }
}