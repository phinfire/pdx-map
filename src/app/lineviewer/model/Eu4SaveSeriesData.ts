import { inject } from "@angular/core";
import { Injectable } from "@angular/core";
import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";
import { LineViewerData } from "./LineViewerData";
import { Observable, forkJoin, map } from "rxjs";
import { SkanderbegProxyService } from "../../../services/api/SkanderbegProxyService";
import { Eu4SaveDataFacade, CountryDataFacade, CountryData } from "./Eu4SaveDataFacade";
import { DataSeries } from "./DataSeries";

class CountryEntity implements LineableEntity {
    private visible = true;

    constructor(private countryFacade: CountryDataFacade) { }

    getName(): string {
        return this.countryFacade.getPlayerName();
    }

    getColor(): string {
        return this.countryFacade.getColor().toHexString();
    }

    isVisible(): boolean {
        return this.visible;
    }

    setVisible(visible: boolean): void {
        this.visible = visible;
    }

    getCountryFacade(): CountryDataFacade {
        return this.countryFacade;
    }
}

@Injectable({ providedIn: 'root' })
export class Eu4SaveSeriesData implements LineViewerData {

    private apiService = inject(SkanderbegProxyService);

    private playerData$: Observable<Eu4SaveDataFacade>[];
    private entities: LineableEntity[] | null = null;
    private allDumps: Eu4SaveDataFacade[] | null = null;

    private readonly options = new Map([
        ["Total Development", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["total_development"] ?? 0)))],
        ["Dev with Subjects", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["devWithSubjects"] ?? 0)))],
        ["Max Manpower", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["max_manpower"] ?? 0)))],
        ["Dev Clicks", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractTimeSeries((d: CountryData | undefined) => d?.["dev_clicks"] ?? 0))],
        ["Income (No Subsidies)", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["inc_no_subs"] ?? 0)))],
        ["Ducats Spent Total", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractDictSumTimeSeries((d: CountryData | undefined) => d?.["ducats_spent"] as any))],
        ["Ducats Spent on Players", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractDucatsSpentOnPlayersTimeSeries())],
        ["Battle Casualties", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["battleCasualties"] ?? 0)))],
        ["Total Casualties", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["total_casualties"] ?? 0)))],
        ["Casualties Inflicted", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["total_land_units_killed"] ?? 0)))],
        ["Army Size", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractDictSumTimeSeries((d: CountryData | undefined) => d?.["army_size"] as any))],
        ["Mana Spent", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => {
            return d && d["total_mana_spent"] ? d["total_mana_spent"]["s"] ?? 0 : 0;
        }))],
        ["Innovativeness", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseFloat(d?.["innovativeness"] ?? 0)))],
        ["War Score Cost", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["warscore_cost"] ?? 0)))],
        ["Force Limit", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["FL"] ?? 0)))],
        ["Provinces Owned", () => this.buildSeriesMap((cf: CountryDataFacade) => cf.extractNumericTimeSeries((d: CountryData | undefined) => parseInt(d?.["provinces"] ?? 0)))],
    ]);

    constructor() {
        this.playerData$ = this.apiService.getPlayerData();
    }

    private buildSeriesMap(valueAccessor: (countryFacade: CountryDataFacade) => Array<{ year: number; value: any }>): Observable<Map<LineableEntity, DataSeries>> {
        return forkJoin(this.playerData$).pipe(
            map(allDumps => {
                this.allDumps = allDumps;
                if (!this.entities) {
                    this.entities = this.buildEntities(allDumps);
                }
                return this.buildSeriesForEntities(this.entities, valueAccessor);
            })
        );
    }

    private buildEntities(allDumps: Eu4SaveDataFacade[]): LineableEntity[] {
        const allCountryIds = new Set<string>();
        allDumps.forEach((dump) => {
            dump.getPlayerCountries().forEach((_, countryId) => {
                allCountryIds.add(countryId);
            });
        });
        return Array.from(allCountryIds).map(countryId => {
            const countryFacade = new CountryDataFacade(countryId, allDumps);
            return new CountryEntity(countryFacade);
        });
    }

    private buildSeriesForEntities(
        entities: LineableEntity[],
        valueAccessor: (countryFacade: CountryDataFacade) => Array<{ year: number; value: any }>
    ): Map<LineableEntity, DataSeries> {
        const seriesMap = new Map<LineableEntity, DataSeries>();
        entities.forEach((entity) => {
            const countryEntity = entity as any;
            const countryFacade = countryEntity.getCountryFacade();
            const timeSeries = valueAccessor(countryFacade);
            const series: DataSeries = {
                name: entity.getName(),
                color: entity.getColor(),
                values: timeSeries.map(point => ({
                    x: point.year,
                    y: typeof point.value === 'number' ? point.value : 0
                }))
            };
            seriesMap.set(entity, series);
        });
        return seriesMap;
    }

    getLineableEntities(): LineableEntity[] {
        return this.entities ?? [];
    }

    getOptions(): Map<string, LineAccessor> {
        return this.options;
    }
}