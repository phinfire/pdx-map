import { ParadoxSave } from "../ParadoxSave";
import { Building } from "./Building";
import { Country } from "./Country";
import { CountryBudget } from "./CountryBudget";
import { Pop } from "./Pop";
import { PowerBloc } from "./PowerBloc";
import { StateRegion } from "./StateRegion";

export class Vic3Save implements ParadoxSave {

    public static makeSaveFromRawData(saveData: any) {
        const overlordToVassals = Vic3Save.getOverlordToVassals(saveData.pacts.database);
        const state2ownerIndex = new Map<number, number>();
        const countryIndex2StateRegions: Map<string, StateRegion[]> = new Map();
        
        for (const stateEntryIndex in saveData.states.database) {
            const index = parseInt(stateEntryIndex);
            const stateEntry = saveData.states.database[index];
            state2ownerIndex.set(index, stateEntry["country"]);
            
            const stateRegion = StateRegion.fromRawData(stateEntry, index);
            const ownerIndex = stateRegion.getOwnerCountryIndex() + "";
            countryIndex2StateRegions.set(stateRegion.getOwnerCountryIndex() + "", (countryIndex2StateRegions.get(ownerIndex) || []).concat([stateRegion]));
        }

        const countries: Country[] = [];
        const country2buildingEntries = new Map<string, any[]>();
        const country2pops = new Map<string, Pop[]>();
        for (const buildingIndex in saveData.building_manager.database) {
            const buildingEntry = saveData.building_manager.database[buildingIndex];
            const state = buildingEntry["state"];
            const stateEntry = saveData.states.database[state];
            if (!stateEntry) {
                console.warn("State entry not found for building " + buildingEntry["building"] + " in state " + state);
                continue;
            }
            const country = stateEntry["country"] + "";
            if (!country2buildingEntries.has(country)) {
                country2buildingEntries.set(country, []);
            }
            const buildingsFromEntry = Building.fromRawData(buildingEntry, saveData.building_manager.database, saveData.building_ownership_manager.database, state2ownerIndex);
            country2buildingEntries.get(country)!.push(...buildingsFromEntry);
        }
        for (const popIndex in saveData.pops.database) {
            const popEntry = saveData.pops.database[popIndex];
            const state = popEntry["location"];
            const stateEntry = saveData.states.database[state];
            if (!stateEntry) {
                console.warn("State entry not found for pop " + popEntry["type"] + " in state " + state);
                continue;
            }
            const country = stateEntry["country"] + "";
            if (!country2pops.has(country)) {
                country2pops.set(country, []);
            }
            country2pops.get(country)!.push(Pop.fromRawData(popEntry));
        }
        const countryIndex2TechEntry = new Map<string, any>();
        for (const techIndex in saveData.technology.database) {
            const techEntry = saveData.technology.database[techIndex];
            if (techEntry["country"]) {
                countryIndex2TechEntry.set("" + techEntry["country"], techEntry);
            }
        }
        const country2playerName = new Map<string, string | null>();
        for (const index in saveData.player_manager.database) {
            const playerEntry = saveData.player_manager.database[index];
            if (playerEntry["country"] && playerEntry["user"]) {
                country2playerName.set("" + playerEntry["country"], playerEntry["user"]);
            }
        }
        const countryName2BlocIndex = new Map<string, string>();
        const index2Country = new Map<string, Country>();
        for (const countryIndex in saveData.country_manager.database) {
            const countryEntry = saveData.country_manager.database[countryIndex];
            const countryBudget = countryEntry["budget"] ? CountryBudget.fromRawData(countryEntry["budget"]) : CountryBudget.NONE;
            //if (true || countryEntry["country_type"] && countryEntry["country_type"] == "recognized") {
            if (countryEntry["country_type"] != undefined) {
                const techEntry = countryIndex2TechEntry.get(countryIndex) || {};
                const playerName = country2playerName.get(countryIndex) || null;
                const taxLevel = countryEntry["tax_level"] || "medium";
                const states = countryIndex2StateRegions.get(countryIndex) || [];
                const vassalTags = (overlordToVassals.get(countryIndex) || []).map(v => {
                    const vassalCountryEntry = saveData.country_manager.database[v];
                    return vassalCountryEntry ? vassalCountryEntry.definition : v;
                });
                const country = new Country(playerName, vassalTags, countryEntry.definition, countryEntry.pop_statistics, country2buildingEntries.get(countryIndex) || [],
                    country2pops.get(countryIndex) || [], techEntry, countryBudget, taxLevel);
                countries.push(country);
                index2Country.set(countryIndex, country);
                if (countryEntry["power_bloc_as_core"]) {
                    countryName2BlocIndex.set(country.getTag(), countryEntry["power_bloc_as_core"] + "");
                }
            }
        }
        const existingCountries = countries.filter(c => c.getPopulation() > 0);
        const blocs: PowerBloc[] = [];
        for (const blocIndex in saveData.power_bloc_manager.database) {
            const blocData = saveData.power_bloc_manager.database[blocIndex];
            const blocMemberNames = Array.from(countryName2BlocIndex.keys()).filter(name => countryName2BlocIndex.get(name) === blocIndex);
            const blocMembers: Country[] = blocMemberNames.map(name => existingCountries.find(c => c.getTag() === name)).filter(c => c !== undefined) as Country[];
            const bloc = PowerBloc.fromRawData(blocData, blocMembers, index2Country);
            if (bloc) {
                blocs.push(bloc);
            }
        }
        const nonBlocCountries = existingCountries.filter(c => blocs.every(bloc => !bloc.getCountries().getInternalElements().includes(c)));
        //"1863.6.3.18"
        const realDateString = saveData.meta_data.real_date;
        const ingameDateString = saveData.meta_data.game_date;
        const ingameDateStringDatePart = ingameDateString.substring(0, ingameDateString.lastIndexOf("."));
        const ingameDateParts = ingameDateStringDatePart.split(".");
        const ingameDate = new Date(parseInt(ingameDateParts[0]), parseInt(ingameDateParts[1]) - 1, parseInt(ingameDateParts[2]));
        const realDateParts = realDateString.split(".");
        const realDate = new Date(parseInt(realDateParts[0]), parseInt(realDateParts[1]) - 1, parseInt(realDateParts[2]));
        realDate.setFullYear(realDate.getFullYear() + 1900);
        return new Vic3Save(nonBlocCountries, blocs, ingameDate, realDate);
    }

    private static getOverlordToVassals(pactData: any): Map<string, string[]> {
        return Object.values(pactData)
            .filter((pact: any) => pact["action"] === "colony")
            .reduce((overlordToVassals: Map<string, string[]>, pact: any) => {
                const overlord = String(pact["targets"]["first"]);
                const vassal = String(pact["targets"]["second"]);
                
                if (!overlordToVassals.has(overlord)) {
                    overlordToVassals.set(overlord, []);
                }
                overlordToVassals.get(overlord)!.push(vassal);
                
                return overlordToVassals;
            }, new Map<string, string[]>());
    }

    private cachedCountries: Country[];
    private stateRegions: Map<string, StateRegion> = new Map<string, StateRegion>();

    private constructor(private nonBlocCountries: Country[], private blocs: PowerBloc[], private ingameDate: Date, private realDate: Date) {
        this.cachedCountries = this.nonBlocCountries.concat(this.blocs.flatMap(bloc => bloc.getCountries().getInternalElements()));
    }

    getCountries(includeAI: boolean) {
        return this.cachedCountries.filter(c => includeAI || c.getPlayerName() !== null);
    }

    getPowerBlocs() {
        return this.blocs;
    }

    getIngameDate() {
        return this.ingameDate;
    }

    getRealDate() {
        return this.realDate;
    }

    toJson() {
        return {
            "countries": this.nonBlocCountries.map(c => c.toJson()),
            "blocs": this.blocs.map(b => b.toJson()),
            "ingameDate": this.ingameDate.toISOString(),
            "realDate": this.realDate.toISOString(),
            "stateRegions": Array.from(this.stateRegions.values()).map(r => r.toJson())
        };
    }
}