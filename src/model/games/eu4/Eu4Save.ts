import { Eu4SaveCountry } from "./Eu4SaveCountry";
import { Eu4SaveProvince } from "./Eu4SaveProvince";

export class Eu4Save {

    static makeSaveFromRawData(rawData: any): Eu4Save {
        const tag2PlayerName = new Map<string, string>();
        for (let i = 0; i < rawData.players_countries.length; i = i + 2) {
            const playerName = rawData.players_countries[i];
            const countryTag = rawData.players_countries[i + 1];
            tag2PlayerName.set(countryTag, playerName);
        }
        const cachedProvinces = new Map<string, Eu4SaveProvince>();
        const provinceIds = Object.keys(rawData.provinces).map((id) => id.substring(1));
        provinceIds.forEach((id) => {
            const data = rawData.provinces["-" + id];
            if (!(data.trade_power == undefined || data.trade_power == null || data.trade_power == 0)) {
                const province = Eu4SaveProvince.fromRawData(id, data);
                cachedProvinces.set(id, province);
            }
        });
        const cachedCountries = new Map<string, Eu4SaveCountry>();
        const countryTags = Object.keys(rawData.countries);
        countryTags.forEach((tag) => {
            const data = rawData.countries[tag];
            const country = Eu4SaveCountry.fromRawData(tag, data, tag2PlayerName.get(tag) || null);
            cachedCountries.set(tag, country);
        });
        const dateParts = rawData.date.split(".").map((part: string) => parseInt(part, 10));
        return new Eu4Save(cachedProvinces, cachedCountries, tag2PlayerName, new Date(dateParts[0], dateParts[1] - 1, dateParts[2]));
    }

    static fromJSON(json: any): Eu4Save {
        // TODO: Implement deserialization from Eu4Save JSON format
        throw new Error('fromJSON not yet implemented');
    }

    private constructor(
        private provinces: Map<string, Eu4SaveProvince>,
        private countries: Map<string, Eu4SaveCountry>,
        private tag2PlayerName: Map<string, string>,
        private ingameDate: Date
    ) { }

    toJSON(): any {
        return {
            countries: Array.from(this.countries.values()).map(c => c.toJSON()),
            provinces: Array.from(this.provinces.values()).map(p => p.toJSON()),
            date: this.ingameDate.toISOString()
        };
    }

    getIngameDate(): Date {
        return this.ingameDate;
    }

    getCountry(tag: string) {
        const country = this.countries.get(tag);
        if (!country) {
            throw new Error(`Country with tag ${tag} not found.`);
        }
        return country;
    }

    getProvinces() {
        return this.provinces;
    }

    getAllExistingCountryTags(): Set<string> {
        return new Set(Array.from(this.getProvinces().values()).map(prov => prov.getOwner(this) ? prov.getOwner(this)!.getTag() : null).filter(tag => tag !== null));
    }

    getTotalCountryDevelopment(tag: string) {
        let dev = 0;
        this.getProvinces().forEach(prov => {
            if (prov.getOwner(this) && prov.getOwner(this)!.getTag() === tag) {
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