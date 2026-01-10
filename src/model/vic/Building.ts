import { Ownership } from "./Ownership";

export class Building {

    public static fromRawData(rawData: any, allBuildingsData: any[], allOwnershipsData: any[], state2OwnerCountry: Map<number, number>) {
        const { goodsIn, goodsOut } = this.setupGoodMaps(rawData);

        const location = rawData["state"];
        const locationCountryIndex = state2OwnerCountry.get(location);
        const buildings = [];
        const totalLevels = rawData["levels"] || 0;
        let remainingLevels = rawData["levels"] || 0
        if (rawData["owners"]) {
            for (const ownerEntryIndex in rawData["owners"]) {
                const i = parseInt(ownerEntryIndex);
                const ownershipEntry = allOwnershipsData[i];
                let ownershipType = Ownership.WORKERS;
                let levels = ownershipEntry ? ownershipEntry["levels"] || 0 : 0;
                const cleanName = this.cleanUpBuildingName(rawData["building"]);
                if (levels <= 0) {
                    continue;
                }
                if (ownershipEntry != undefined && ownershipEntry["identity"]) {
                    if (ownershipEntry["identity"]["building"]) {
                        const buildingEntry = allBuildingsData[ownershipEntry["identity"]["building"]];
                        const ownerBuildingLocation = buildingEntry["state"];
                        const ownerBuildingCountryIndex = state2OwnerCountry.get(ownerBuildingLocation);
                        if (locationCountryIndex == ownerBuildingCountryIndex) {
                            ownershipType = Ownership.LOCAL_CAPITALISTS;
                        } else {
                            ownershipType = Ownership.FOREIGN_CAPITALISTS;
                        }
                    } else if (ownershipEntry["identity"]["country"]) {
                        const ownerCountryIndex = ownershipEntry["identity"]["country"];
                        if (locationCountryIndex == ownerCountryIndex) {
                            ownershipType = Ownership.LOCAL_GOVERNMENT;
                        } else {
                            ownershipType = Ownership.FOREIGN_GOVERNMENT;
                        }
                    } else if (Building.isGovernmentBuildingName(cleanName)) {
                        ownershipType = Ownership.LOCAL_GOVERNMENT;
                    } else if (Building.isSubsistenceBuildingName(cleanName) || Building.isCapitalistDenName(cleanName)) {
                        ownershipType = Ownership.WORKERS;
                    } else {
                        console.warn("Unknown ownership identity for building " + rawData["building"] + " in state " + location + ": ", ownershipEntry, rawData);
                    }
                }
                const fraction = levels / totalLevels;
                remainingLevels -= levels;
                buildings.push(this.createBuilding(
                    rawData,
                    location,
                    levels,
                    fraction,
                    ownershipType,
                    Building.getScaledMap(goodsIn, fraction),
                    Building.getScaledMap(goodsOut, fraction)
                ));
            }
        }
        if (remainingLevels > 0) {
            const remainingFraction = remainingLevels / totalLevels;
            buildings.push(this.createBuilding(
                rawData,
                location,
                remainingLevels,
                remainingFraction,
                Ownership.WORKERS,
                Building.getScaledMap(goodsIn, remainingFraction),
                Building.getScaledMap(goodsOut, remainingFraction)
            ));
        }
        return {locationIndex: location, buildings: buildings};
    }

    private static setupGoodMaps(rawData: any): { goodsIn: Map<number, number>, goodsOut: Map<number, number> } {
        const goodsIn = new Map<number, number>();
        const goodsOut = new Map<number, number>();
        if (rawData["input_goods"]) {
            const inputGoodsData = rawData["input_goods"]["goods"];
            for (const good in inputGoodsData) {
                const goodId = parseInt(good);
                const amount = inputGoodsData[good].value;
                goodsIn.set(goodId, amount);
            }
        }
        if (rawData["output_goods"]) {
            const outputGoodsData = rawData["output_goods"]["goods"];
            for (const good in outputGoodsData) {
                const goodId = parseInt(good);
                const amount = outputGoodsData[good].value;
                goodsOut.set(goodId, amount);
            }
        }
        return { goodsIn, goodsOut };
    }

    private static getScaledMap(originalMap: Map<number, number>, scale: number): Map<number, number> {
        const scaledMap = new Map<number, number>();
        for (const [key, value] of originalMap.entries()) {
            scaledMap.set(key, value * scale);
        }
        return scaledMap;
    }

    private static createBuilding(rawData: any, location: number, levels: number, fraction: number, ownership: Ownership, goodsIn: Map<number, number>, goodsOut: Map<number, number>): Building {
        const b = new Building(
            this.cleanUpBuildingName(rawData["building"]),
            location,
            levels,
            (rawData["goods_cost"] || 0) * fraction,
            (rawData["goods_sales"] || 0) * fraction,
            (rawData["cash_reserves"] || 0) * fraction,
            (rawData["dividends"] || 0) * fraction,
            ownership,
            goodsIn,
            goodsOut
        );
        if (rawData["building"] === "building_arms_industry") {
            console.log("Created building", b);
        }
        return b;
    }

    private static cleanUpBuildingName(rawName: string): string {
        return rawName.replace("building_", "");
    }

    public static fromJson(json: any): Building {
        return new Building(
            json.name,
            json.state,
            json.levels,
            json.valueGoodsBought,
            json.valueGoodsSold,
            json.cashReserves,
            json.dividends,
            json.ownership,
            new Map(Object.entries(json.goodsIn).map(([key, value]) => [parseInt(key), value as number])),
            new Map(Object.entries(json.goodsOut).map(([key, value]) => [parseInt(key), value as number])),
        );
    }

    constructor(private name: string, private state: number, private levels: number, private valueGoodsBought: number,
        private valueGoodsSold: number, private cashReserves: number, private dividends: number, private ownership: Ownership, private goodsIn: Map<number, number>, private goodsOut: Map<number, number>) {
    }

    private static isGovernmentBuildingName(buildingName: string): boolean {
        return ["urban_center", "government_administration",
            "university", "barracks", "conscription_center", "naval_base", "construction_sector", "trade_center"].some((govBuildingName) => buildingName == govBuildingName);
    }
    
    private static isSubsistenceBuildingName(buildingName: string): boolean {
        return buildingName.startsWith("subsistence_");
    }

    private static isCapitalistDenName(buildingName: string) {
        return ["manor_house", "financial_district"].some((capitalistBuildingName) => buildingName == capitalistBuildingName);
    }

    getGoodsIn(): Map<number, number> {
        return this.goodsIn;
    }

    getGoodsOut(): Map<number, number> {
        return this.goodsOut;
    }

    getDividends(): number {
        return this.dividends;
    }

    getMarketValueOfGoodSold(): number {
        return this.valueGoodsSold;
    }

    getNetValueAdded(): number {
        return this.valueGoodsSold - this.valueGoodsBought;
    }

    getName(): string {
        return this.name;
    }

    getLevels(): number {
        return this.levels;
    }

    getCashReserves(): number {
        return this.cashReserves;
    }

    getOwnership(): Ownership {
        return this.ownership;
    }

    isSubsistence(): boolean {
        return Building.isSubsistenceBuildingName(this.getName());
    }

    isGovernment(): boolean {
        return Building.isGovernmentBuildingName(this.getName());
    }

    isInfrastructure(): boolean {
        return ["railway", "port"].some((infraBuildingName) => this.getName() == infraBuildingName);
    }

    isAgricultural(): boolean {
        return !this.isSubsistence() &&
            (this.getName().indexOf("_farm") != -1
                || this.getName().indexOf("_plantation") != -1
                || this.getName().indexOf("_ranch") != -1
                || this.getName() == "logging_camp"
                || this.getName() == "fishing_wharf");
    }

    isMine(): boolean {
        return this.getName().endsWith("_mine") || this.getName() == "oil_rig";
    }

    isCapitalistDen() {
        return Building.isCapitalistDenName(this.getName());
    }

    isCompany() {
        return this.getName().startsWith("company_");
    }

    isFactory(): boolean {
        return !this.isSubsistence() && !this.isGovernment() && !this.isInfrastructure() && !this.isCapitalistDen() &&
            !this.isAgricultural() && !this.isMine() && !this.isCompany();
    }

    isConstructionSector(): boolean {
        return this.getName() == "construction_sector";
    }

    toJson() {
        return {
            name: this.name,
            state: this.state,
            levels: this.levels,
            valueGoodsBought: this.valueGoodsBought,
            valueGoodsSold: this.valueGoodsSold,
            cashReserves: this.cashReserves,
            dividends: this.dividends,
            ownership: this.ownership,
            goodsIn: Array.from(this.goodsIn.entries()).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
            goodsOut: Array.from(this.goodsOut.entries()).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
        };
    }
}