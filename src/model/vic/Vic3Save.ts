import { Curve } from "three";
import { ParadoxSave } from "../common/ParadoxSave";
import { Building } from "./Building";
import { Country } from "./Country";
import { CountryBudget } from "./CountryBudget";
import { ResourceHaver } from "./game/ResourceHaver";
import { Pop } from "./Pop";
import { PowerBloc } from "./PowerBloc";
import { StateRegion } from "./StateRegion";
import { CurveBuffer } from "./CurveBuffer";

interface RawSaveData {
    states: any;
    state_region_manager: any;
    pops: any;
    technology: any;
    player_manager: any;
    country_manager: any;
    power_bloc_manager: any;
    building_manager: any;
    building_ownership_manager: any;
    pacts: any;
    meta_data: {
        real_date: string;
        game_date: string;
    };
}

export class Vic3Save implements ParadoxSave {

    public static makeSaveFromRawData(saveData: RawSaveData) {
        const overlordToVassals = Vic3Save.getOverlordToVassals(saveData.pacts.database);
        const stateRegion2Buildings = Vic3Save.assembleStateRegion2BuildingsMap(saveData);
        const state2ownerIndex = new Map<number, number>();
        const countryIndex2StateRegions: Map<string, StateRegion[]> = new Map();
        for (const stateEntryIndex in saveData.states.database) {
            const index = parseInt(stateEntryIndex);
            const stateDatabaseEntry = saveData.states.database[index];
            state2ownerIndex.set(index, stateDatabaseEntry["country"]);
            const buildingsInState = stateRegion2Buildings.get(index) || [];
            const stateRegion = StateRegion.fromRawData(stateDatabaseEntry, index, buildingsInState);
            const ownerIndex = stateRegion.getOwnerCountryIndex() + "";
            countryIndex2StateRegions.set(stateRegion.getOwnerCountryIndex() + "", (countryIndex2StateRegions.get(ownerIndex) || []).concat([stateRegion]));
        }
        const country2pops = new Map<string, Pop[]>();
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
            if (countryEntry["country_type"] !== undefined && countryEntry["country_type"] !== "decentralized") {
                const techEntry = countryIndex2TechEntry.get(countryIndex) || {};
                const playerName = country2playerName.get(countryIndex) || null;
                const taxLevel = countryEntry["tax_level"] || "medium";
                const states = countryIndex2StateRegions.get(countryIndex) || [];
                const vassalTags = (overlordToVassals.get(countryIndex) || []).map(v => {
                    const vassalCountryEntry = saveData.country_manager.database[v];
                    return vassalCountryEntry ? vassalCountryEntry.definition : v;
                });
                const gdp = CurveBuffer.fromRawData(countryEntry.gdp);
                const prestige = CurveBuffer.fromRawData(countryEntry.prestige);
                const literacy = CurveBuffer.fromRawData(countryEntry.literacy);
                const avgsoltrend = CurveBuffer.fromRawData(countryEntry.avgsoltrend);
                const country = new Country(playerName, vassalTags, countryEntry.definition, states, countryEntry.pop_statistics,
                    gdp, prestige, literacy, avgsoltrend,
                    country2pops.get(countryIndex) || [], techEntry, countryBudget, taxLevel);
                index2Country.set(countryIndex, country);
                if (countryEntry["power_bloc_as_core"]) {
                    countryName2BlocIndex.set(country.getTag(), countryEntry["power_bloc_as_core"] + "");
                }
            }
        }
        const existingCountries = Array.from(index2Country.values()).filter(c => c.getPopulation() > 0);
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
        const ingameDateParts = saveData.meta_data.game_date.split(".");
        const ingameDate = new Date(parseInt(ingameDateParts[0]), parseInt(ingameDateParts[1]) - 1, parseInt(ingameDateParts[2]));
        const realDateParts = saveData.meta_data.real_date.split(".");
        const realDate = new Date(parseInt(realDateParts[0]), parseInt(realDateParts[1]) - 1, parseInt(realDateParts[2]));
        realDate.setFullYear(realDate.getFullYear() + 1900);
        return new Vic3Save(nonBlocCountries, blocs, ingameDate, realDate);
    }

    private static parseStateRegionEntries(saveData: RawSaveData): Map<string, ResourceHaver> {
        const stateRegionMap = new Map<string, ResourceHaver>();

        const arableResourceTypes = new Set([
            'bg_maize_farms', 'bg_millet_farms', 'bg_rice_farms', 'bg_rye_farms', 'bg_wheat_farms',
            'bg_banana_plantations', 'bg_coffee_plantations', 'bg_cotton_plantations', 'bg_dye_plantations',
            'bg_livestock_ranches', 'bg_opium_plantations', 'bg_silk_plantations', 'bg_sugar_plantations',
            'bg_tea_plantations', 'bg_tobacco_plantations', 'bg_vineyard_plantations'
        ]);

        for (const stateIndex in saveData.state_region_manager.database) {
            const stateEntry = saveData.state_region_manager.database[stateIndex];
            const identifier = stateEntry["template"];
            const arableLand = stateEntry["arable_land"] || 0;

            const arableResources = new Map<string, number>();
            const otherResources = new Map<string, number>();
            const uncappedResources: Array<{ type: string; undiscovered_amount: number }> = [];

            const resources = stateEntry.persistent_resources?.resources || [];
            for (const resource of resources) {
                const resourceType = resource.type;

                if (arableResourceTypes.has(resourceType)) {
                    const amount = resource.amount || 0;
                    arableResources.set(resourceType, amount);
                } else {
                    if (resource.amount !== undefined) {
                        otherResources.set(resourceType, resource.amount);
                    } else if (resource.discovered_amount !== undefined) {
                        otherResources.set(resourceType, resource.discovered_amount);
                    }
                }
                if (resource.undiscovered_amount !== undefined) {
                    uncappedResources.push({
                        type: resourceType,
                        undiscovered_amount: resource.undiscovered_amount
                    });
                }
            }

            const resourceHaver = new ResourceHaver(
                identifier,
                arableLand,
                new Set(arableResources.keys()),
                arableResources,
                otherResources
            );

            stateRegionMap.set(identifier, resourceHaver);
        }
        return stateRegionMap;
    }

    private static assembleStateRegion2BuildingsMap(saveData: RawSaveData): Map<number, Building[]> {
        const stateRegion2Buildings = new Map<number, Building[]>();
        for (const buildingIndex in saveData.building_manager.database) {
            const buildingEntry = saveData.building_manager.database[buildingIndex];
            if (buildingEntry !== "none") {
                const { locationIndex, buildings } = Building.fromRawData(buildingEntry, saveData.building_manager.database, saveData.building_ownership_manager.database, new Map());
                if (!stateRegion2Buildings.has(locationIndex)) {
                    stateRegion2Buildings.set(locationIndex, []);
                }
                stateRegion2Buildings.get(locationIndex)!.push(...buildings);
            }
        }
        return stateRegion2Buildings;
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

    public static fromJSON(json: any): Vic3Save {
        const nonBlocCountries = (json.countries || []).map((cJson: any) => Country.fromJson(cJson));
        const blocs = (json.blocs || []).map((bJson: any) => PowerBloc.fromJson(bJson));
        const ingameDate = new Date(json.ingameDate);
        const realDate = new Date(json.realDate);
        const save = new Vic3Save(nonBlocCountries, blocs, ingameDate, realDate);
        return save;
    }

    private constructor(private nonBlocCountries: Country[], private blocs: PowerBloc[], private ingameDate: Date, private realDate: Date) {
        this.cachedCountries = this.nonBlocCountries.concat(this.blocs.flatMap(bloc => bloc.getCountries().getInternalElements()));
    }

    toJson() {
        return {
            "ingameDate": this.ingameDate.toISOString(),
            "realDate": this.realDate.toISOString(),
            "countries": this.nonBlocCountries.map(c => c.toJson()),
            "blocs": this.blocs.map(b => b.toJson()),
            "stateRegions": Array.from(this.stateRegions.values()).map(r => r.toJson())
        };
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

    getDemographics(countries: Country[]) {
        return {
            populationByCountry: countries.map(c => ({
                name: c.getTag(),
                tag: c.getTag(),
                population: c.getPopulation(),
                playerName: c.getPlayerName() || null,
                vassalTags: c.getVassalTags()
            }))
        };
    }
}