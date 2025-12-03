import { inject } from "@angular/core";
import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";
import { LineViewerData } from "./LineViewerData";
import { HttpClient } from "@angular/common/http";
import { Observable, forkJoin, map, shareReplay } from "rxjs";
import { DataSeries } from "../LinePlotterService";
import { RGB } from "../../../util/RGB";

interface CountryData {
    [key: string]: any;
    player?: string;
}

interface SaveDataDump {
    [countryId: string]: CountryData;
}

class CountryEntity implements LineableEntity {
    private visible = true;

    constructor(private countryId: string, private playerName: string, private color: RGB) { }

    getName(): string {
        return this.playerName;
    }

    getColor(): string {
        return this.color.toHexString();
    }

    isVisible(): boolean {
        return this.visible;
    }

    setVisible(visible: boolean): void {
        this.visible = visible;
    }
}

export class Eu4SaveSeriesData implements LineViewerData {

    private http = inject(HttpClient);

    private readonly ids_and_years = [
        { id: "0554a9", year: 1652 },
        { id: "572a90", year: 1613 },
        { id: "0b9b77", year: 1557 },
        { id: "76c960", year: 1504 },
        { id: "54ebd1", year: 1444 }
    ];

    private sumDictValues(dict: Record<string, number> | undefined): number {
        if (!dict || typeof dict !== 'object') return 0;
        return Object.values(dict).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }

    private colorAccess(country: CountryData): RGB {
        const mapColor = country["map_color"] as any;
        if (!mapColor || typeof mapColor !== 'object') {
            return new RGB(0, 0, 0);
        }
        const r = Math.min(255, Math.max(0, parseInt(mapColor.r ?? 0) || 0));
        const g = Math.min(255, Math.max(0, parseInt(mapColor.g ?? 0) || 0));
        const b = Math.min(255, Math.max(0, parseInt(mapColor.b ?? 0) || 0));
        return new RGB(r, g, b);
    }

    private ducatsSpentOnPlayers(country: CountryData): number {
        const dukatSpent = country["ducats_spent"] as any;
        if (!dukatSpent || typeof dukatSpent !== 'object') return 0;

        return (dukatSpent.great_power_action ?? 0) +
            (dukatSpent.gifts ?? 0) +
            (dukatSpent.subsidies ?? 0);
    }

    private playerData$: Observable<CountryData>[];
    private entities: LineableEntity[] | null = null;

    private options: Map<string, LineAccessor> = new Map();

    constructor() {
        this.playerData$ = this.ids_and_years.map(({ id }) =>
            this.http.get<SaveDataDump>(
                "https://codingafterdark.de/skanderbeg/getSaveDataDump?save=" + id
            ).pipe(
                shareReplay(1)
            )
        );
        this.options = new Map([
            ["Total Development", () => this.buildSeriesMap((c: CountryData) => parseInt((c["total_development"] ?? 0)))],
            ["Dev with Subjects", () => this.buildSeriesMap((c: CountryData) => parseInt((c["devWithSubjects"] ?? 0)))],
            ["Max Manpower", () => this.buildSeriesMap((c: CountryData) => parseInt((c["max_manpower"] ?? 0)))],
            ["Dev Clicks", () => this.buildSeriesMap((c: CountryData) => c["dev_clicks"] ?? 0)],
            ["Income (No Subsidies)", () => this.buildSeriesMap((c: CountryData) => parseInt((c["inc_no_subs"] ?? 0)))],
            ["Ducats Spent Total", () => this.buildSeriesMap((c: CountryData) => this.sumDictValues(c["ducats_spent"] as any))],
            ["Ducats Spent on Players", () => this.buildSeriesMap((c: CountryData) => this.ducatsSpentOnPlayers(c))],
            ["Battle Casualties", () => this.buildSeriesMap((c: CountryData) => parseInt((c["battleCasualties"] ?? 0)))],
            ["Total Casualties", () => this.buildSeriesMap((c: CountryData) => parseInt((c["total_casualties"] ?? 0)))],
            ["Casualties Inflicted", () => this.buildSeriesMap((c: CountryData) => parseInt((c["total_land_units_killed"] ?? 0)))],
            ["Army Size", () => this.buildSeriesMap((c: CountryData) => this.sumDictValues(c["army_size"] as any))],
            ["Mana Spent", () => this.buildSeriesMap((c: CountryData) => c["total_mana_spent"] ? c["total_mana_spent"]["s"] ?? 0 : 0)],
            ["Innovativeness", () => this.buildSeriesMap((c: CountryData) => parseFloat((c["innovativeness"] ?? 0)))],
            ["War Score Cost", () => this.buildSeriesMap((c: CountryData) => parseInt((c["warscore_cost"] ?? 0)))],
            ["Force Limit", () => this.buildSeriesMap((c: CountryData) => parseInt((c["FL"] ?? 0)))],
            ["Provinces Owned", () => this.buildSeriesMap((c: CountryData) => parseInt((c["provinces"] ?? 0)))],
        ]);
    }

    private buildEntities(allPlayerData: SaveDataDump[]): LineableEntity[] {
        const allCountryIds = new Set<string>();
        const playerNames = new Map<string, string>();
        const countryColors = new Map<string, RGB>();

        allPlayerData.forEach((playerCountries) => {
            Object.entries(playerCountries).forEach(([countryId, countryData]) => {
                if (countryData && typeof countryData === 'object' && 'player' in countryData) {
                    allCountryIds.add(countryId);
                    playerNames.set(countryId, (countryData as any).player ?? countryId);
                    const color = this.colorAccess(countryData);
                    countryColors.set(countryId, color);
                }
            });
        });

        return Array.from(allCountryIds).map(countryId =>
            new CountryEntity(countryId, playerNames.get(countryId) || countryId, countryColors.get(countryId) || new RGB(128, 128, 128))
        );
    }

    private buildSeriesForEntities(
        allPlayerData: SaveDataDump[],
        entities: LineableEntity[],
        valueAccessor: (data: CountryData) => any
    ): Map<LineableEntity, DataSeries> {
        const seriesMap = new Map<LineableEntity, DataSeries>();

        entities.forEach((entity) => {
            const countryId = (entity as any).countryId;
            const values = allPlayerData.map(playerCountries => {
                const countryData = playerCountries[countryId];
                if (countryData) {
                    return valueAccessor(countryData);
                }
                return 0;
            });

            const series: DataSeries = {
                name: entity.getName(),
                color: entity.getColor(),
                values: values.map((value, index) => ({
                    x: this.ids_and_years[index].year,
                    y: typeof value === 'number' ? value : 0
                }))
            };
            seriesMap.set(entity, series);
        });

        return seriesMap;
    }

    private buildSeriesMap(valueAccessor: (data: CountryData) => any): Observable<Map<LineableEntity, DataSeries>> {
        return forkJoin(this.playerData$).pipe(
            map(allPlayerData => {
                if (!this.entities) {
                    this.entities = this.buildEntities(allPlayerData as SaveDataDump[]);
                }
                return this.buildSeriesForEntities(allPlayerData as SaveDataDump[], this.entities, valueAccessor);
            })
        );
    }

    private colorToHex(color: RGB): string {
        return color.toHexString();
    }

    private filterPlayerCountries(data: SaveDataDump): CountryData {
        return Object.entries(data).reduce((acc, [k, v]) => {
            if (typeof v === 'object' && v !== null && 'player' in v) {
                acc[k] = v;
            }
            return acc;
        }, {} as CountryData);
    }

    accessWithAccessor(accessor: (data: CountryData) => any): Observable<Record<string, any>[]> {
        return forkJoin(this.playerData$).pipe(
            map(allPlayerData =>
                allPlayerData.map(playerCountries =>
                    Object.entries(playerCountries).reduce((acc, [k, v]) => {
                        acc[k] = accessor(v);
                        return acc;
                    }, {} as Record<string, any>)
                )
            )
        );
    }

    getAllCountryIds(finalYearAccessor: (data: CountryData) => number): Observable<string[]> {
        return this.accessWithAccessor(finalYearAccessor).pipe(
            map(allData => {
                const names = new Set<string>();

                for (const data of allData) {
                    Object.keys(data).forEach(name => names.add(name));
                }

                const nameArray = Array.from(names);
                const finalData = allData[0];

                return nameArray.sort((a, b) =>
                    (finalData[b] ?? 0) - (finalData[a] ?? 0)
                );
            })
        );
    }

    getPlayerNames(): Observable<Record<string, string>> {
        return this.playerData$[0].pipe(
            map(playerCountries =>
                Object.entries(playerCountries).reduce((acc, [k, v]) => {
                    acc[k] = (v as any).player ?? k;
                    return acc;
                }, {} as Record<string, string>)
            )
        );
    }

    getEntities(): LineableEntity[] {
        if (!this.entities) {
            throw new Error("Entities not yet loaded. Call an accessor first to populate entities.");
        }
        return this.entities;
    }

    getOptions(): Map<string, LineAccessor> {
        return this.options;
    }


}