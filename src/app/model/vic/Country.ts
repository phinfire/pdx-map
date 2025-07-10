import { Building } from "./Building";
import { CountryBudget } from "./CountryBudget";
import { ModelElementList } from "./ModelElementList";
import { Pop } from "./Pop";

export class Country {

    public static fromJson(json: any) {
        return new Country(
            json.playerName,
            json.tag,
            json.popStatistics,
            json.buildings.map((b: any) => Building.fromJson(b)),
            json.pops.map((p: any) => Pop.fromJson(p)),
            json.techEntry,
            CountryBudget.fromJson(json.budget),
            json.taxLevel
        );
    }


    private buildings: ModelElementList<Building>;
    private pops: ModelElementList<Pop>;
    private cachedGoodIn: Map<number, number> = new Map();
    private cachedGoodOut: Map<number, number> = new Map();

    constructor(private playerName: string | null, private tag: string, private popStatistics: any, buildings: any[], pops: Pop[], private techEntry: any, private budget: CountryBudget, private taxLevel: string) {
        this.buildings = new ModelElementList<Building>(buildings);
        this.pops = new ModelElementList<Pop>(pops);
    }

    getBudget(): CountryBudget {
        return this.budget;
    }

    getTaxLevel(): string {
        return this.taxLevel;
    }

    getGoodIn(goodId: number): number {
        if (!this.cachedGoodIn.has(goodId)) {
            const val = this.buildings.getTotal("goodIn" + goodId, _ => true, building => building.getGoodsIn().get(goodId) || 0);
            this.cachedGoodIn.set(goodId, val);
        }
        return this.cachedGoodIn.get(goodId)!;
    }

    getGoodOut(goodId: number): number {
        if (!this.cachedGoodOut.has(goodId)) {
            const val = this.buildings.getTotal("goodOut" + goodId, _ => true, building => building.getGoodsOut().get(goodId) || 0);
            this.cachedGoodOut.set(goodId, val);
        }
        return this.cachedGoodOut.get(goodId)!;
    }

    getName(): string {
        return this.tag
    }

    getPopulation(): number {
        return this.popStatistics["population_lower_strata"]
            + this.popStatistics["population_middle_strata"]
            + this.popStatistics["population_upper_strata"];
    }

    getBuildings(): ModelElementList<Building> {
        return this.buildings;
    }

    getNumberOfEmployed(): number {
        return this.popStatistics["population_salaried_workforce"];
    }

    getPops(): ModelElementList<Pop> {
        return this.pops;
    }

    getAcquiredTechs(): string[] {
        return this.techEntry["acquired_technologies"] ? Object.values(this.techEntry["acquired_technologies"]) : [];
    }

    getPlayerName(): string | null {
        return this.playerName;
    }

    toJson() {
        return {
            playerName: this.playerName,
            tag: this.tag,
            popStatistics: this.popStatistics,
            buildings: this.buildings.getInternalElements().map(b => b.toJson()),
            pops: this.pops.getInternalElements().map(p => p.toJson()),
            techEntry: this.techEntry,
            budget: this.budget.toJson(),
            taxLevel: this.taxLevel
        };
    }
}