import { Building } from "./Building";
import { CountryBudget } from "./CountryBudget";
import { ModelElementList } from "./ModelElementList";
import { Pop } from "./Pop";
import { HasElements } from "../../util/table/HasElements";
import { StateRegion } from "./StateRegion";

export class Country implements HasElements<Building> {

    private buildings: ModelElementList<Building>;
    private pops: ModelElementList<Pop>;
    private cachedGoodIn: Map<number, number> = new Map();
    private cachedGoodOut: Map<number, number> = new Map();


    public static fromJson(json: any) {
        return new Country(
            json.playerName,
            json.vassalTags,
            json.tag,
            json.states.map((s: any) => StateRegion.fromJson(s)),
            json.popStatistics,
            json.buildings.map((b: any) => Building.fromJson(b)),
            json.pops.map((p: any) => Pop.fromJson(p)),
            json.techEntry,
            CountryBudget.fromJson(json.budget),
            json.taxLevel
        );
    }

    toJson() {
        return {
            playerName: this.playerName,
            vassalTags: this.vassalTags,
            tag: this.tag,
            states: this.states.map(s => s.toJson()),
            popStatistics: this.popStatistics,
            buildings: this.buildings.getInternalElements().map(b => b.toJson()),
            pops: this.pops.getInternalElements().map(p => p.toJson()),
            techEntry: this.techEntry,
            budget: this.budget.toJson(),
            taxLevel: this.taxLevel
        };
    }

    constructor(private playerName: string | null, private vassalTags: string[], private tag: string, private states: StateRegion[], private popStatistics: any, buildings: any[], pops: Pop[], private techEntry: any, private budget: CountryBudget, private taxLevel: string) {
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

    getTag(): string {
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

    getElements(): ModelElementList<Building> {
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

    getVassalTags(): string[] {
        return this.vassalTags;
    }
}