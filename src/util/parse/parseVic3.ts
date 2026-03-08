import { Building } from "../../model/vic/Building";
import { Pop } from "../../model/vic/Pop";
import { StateRegion } from "../../model/vic/StateRegion";

export function buildCountryIndex2StateRegionsAndState2OwnerIndex(saveData: any, stateRegion2Buildings: Map<number, Building[]>) {
    const countryIndex2StateRegions: Map<string, StateRegion[]> = new Map();
    const state2ownerIndex: Map<number, string> = new Map();
    for (const stateEntryIndex in saveData.states.database) {
        const index = parseInt(stateEntryIndex);
        const stateDatabaseEntry = saveData.states.database[index];
        state2ownerIndex.set(index, stateDatabaseEntry["country"]);
        const buildingsInState = stateRegion2Buildings.get(index) || [];
        const stateRegion = StateRegion.fromRawData(stateDatabaseEntry, index, buildingsInState);
        const ownerIndex = stateRegion.getOwnerCountryIndex() + "";
        countryIndex2StateRegions.set(stateRegion.getOwnerCountryIndex() + "", (countryIndex2StateRegions.get(ownerIndex) || []).concat([stateRegion]));
    }
    return { countryIndex2StateRegions, state2ownerIndex };
}

export function buildCountryToPops(saveData: any) {
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
    return country2pops;
}

export function getOverlordToVassals(pactData: any): Map<string, string[]> {
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


export function assembleStateRegion2BuildingsMap(buildingManager: any): Map<number, Building[]> {
    const stateRegion2Buildings = new Map<number, Building[]>();
    for (const buildingIndex in buildingManager.database) {
        const buildingEntry = buildingManager.database[buildingIndex];
        if (buildingEntry !== "none") {
            const { locationIndex, buildings } = Building.fromRawData(buildingEntry, buildingManager.database, buildingManager.database, new Map());
            if (!stateRegion2Buildings.has(locationIndex)) {
                stateRegion2Buildings.set(locationIndex, []);
            }
            stateRegion2Buildings.get(locationIndex)!.push(...buildings);
        }
    }
    return stateRegion2Buildings;
}