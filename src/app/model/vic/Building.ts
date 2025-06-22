export class Building {

    public static fromRawData(rawData: any): Building {
        const goodsIn = new Map<number, number>();
        const goodsOut = new Map<number, number>();
        if (rawData["input_goods"]) {
            for (const good in rawData["input_goods"]["goods"]) {
                const goodId = parseInt(good);
                const amount = rawData["input_goods"]["goods"][good];
                goodsIn.set(goodId, amount);
            }
        }
        if (rawData["output_goods"]) {
            for (const good in rawData["output_goods"]["goods"]) {
                const goodId = parseInt(good);
                const amount = rawData["output_goods"]["goods"][good];
                goodsOut.set(goodId, amount);
            }
        }
        return new Building(
            rawData["building"].replace("building_", ""),
            rawData["state"],
            rawData["levels"] || 0,
            rawData["goods_cost"] || 0,
            rawData["goods_sales"] || 0,
            rawData["cash_reserves"] || 0,
            rawData["dividends"] || 0,
            goodsIn,
            goodsOut
        );
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
        new Map(Object.entries(json.goodsIn).map(([key, value]) => [parseInt(key), value as number])),
        new Map(Object.entries(json.goodsOut).map(([key, value]) => [parseInt(key), value as number]))
    );
}

    constructor(private name: string, private state: number, private levels: number, private valueGoodsBought: number,
        private valueGoodsSold: number, private cashReserves: number, private dividends: number, private goodsIn: Map<number, number>, private goodsOut: Map<number, number>) {

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

    isSubsistence(): boolean {
        return this.getName().startsWith("subsistence_");
    }

    isGovernment(): boolean {
        return ["urban_center", "government_administration",
            "university", "barracks", "conscription_center", "naval_base", "construction_sector", "trade_center"].some((govBuildingName) => this.getName() == govBuildingName);
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
        return ["manor_house", "financial_district"].some((capitalistBuildingName) => this.getName() == capitalistBuildingName);
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
            goodsIn: Array.from(this.goodsIn.entries()).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
            goodsOut: Array.from(this.goodsOut.entries()).reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
        };
    }

}