import { Country } from "./Country";
import { ModelElementList } from "./ModelElementList";

export class PowerBloc {

    public static fromRawData(rawData: any, memberCountries: Country[], index2Country: Map<string, Country>) {
        const name = PowerBloc.findBlocNameInData(rawData);
        if (name) {
            const color = rawData["map_color"]["rgb"];
            const principles = rawData["principles"];
            const leaderIndex = rawData["leader"] + "";
            if (leaderIndex && index2Country.has(leaderIndex) && memberCountries.indexOf(index2Country.get(leaderIndex)!) >= 0) {
                const leader = index2Country.get(leaderIndex)!;
                return new PowerBloc(
                    memberCountries.indexOf(leader),
                    memberCountries,
                    name,
                    color,
                    principles
                );
            } else {
                console.warn("PowerBloc leader index not found in index2Country or not a member country", name, leaderIndex, index2Country, memberCountries);
            }
        }
        return null;
    }

    private static findBlocNameInData(rawData: any) {
        let name = null;
        if (rawData["name"] && rawData["name"]["name"]) {
            const nameNameData = rawData["name"]["name"];
            if (nameNameData["custom"]) {
                name = nameNameData["custom"];
            } else if (nameNameData["power_bloc_name"]) {
                name = nameNameData["power_bloc_name"];
            }
        }
        return name;
    }

    public static fromJson(json: any) {
        return new PowerBloc(
            json.leaderIndex,
            json.countries.map((c: any) => Country.fromJson(c)),
            json.name,
            json.color,
            json.principles
        );
    }
    
    private memberCountries: ModelElementList<Country>;

    constructor(private leaderIndex: number, countries: Country[], private name: string, private color: string, private principles: string[]) {
        this.memberCountries = new ModelElementList<Country>(countries);
    }

    public getName(): string {
        return this.name;
    }

    getCountries() {
        return this.memberCountries;
    }

    getLeader(): Country {
        return this.memberCountries.getInternalElements()[this.leaderIndex];
    }

    toJson() {
        return {
            leaderIndex: this.leaderIndex,
            countries: this.memberCountries.getInternalElements().map(c => c.toJson()),
            name: this.name,
            color: this.color,
            principles: this.principles
        };
    }
}