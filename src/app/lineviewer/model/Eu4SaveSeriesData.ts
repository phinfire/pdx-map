import { inject } from "@angular/core";
import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";
import { LineViewerData } from "./LineViewerData";
import { HttpClient } from "@angular/common/http";
import { Observable, forkJoin, map, shareReplay } from "rxjs";
import { DataSeries } from "../LinePlotterService";

interface CountryData {
    [key: string]: any;
    player?: string;
}

interface SaveDataDump {
    [countryId: string]: CountryData;
}

class CountryEntity implements LineableEntity {
    private visible = true;

    constructor(private countryId: string, private playerName: string, private color: string) { }

    getName(): string {
        return this.playerName;
    }

    getColor(): string {
        return this.color;
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
        { id: "76c960", year: 1504 }
    ];

    private sumDictValues(dict: Record<string, number> | undefined): number {
        if (!dict || typeof dict !== 'object') return 0;
        return Object.values(dict).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }

    private colorAccess(country: CountryData): [number, number, number] {
        const mapColor = country["map_color"] as any;
        if (!mapColor || typeof mapColor !== 'object') {
            return [0, 0, 0];
        }
        return [
            (parseInt(mapColor.r ?? 0) || 0) / 255,
            (parseInt(mapColor.g ?? 0) || 0) / 255,
            (parseInt(mapColor.b ?? 0) || 0) / 255
        ];
    }

    private ducatsSpentOnPlayers(country: CountryData): number {
        const dukatSpent = country["ducats_spent"] as any;
        if (!dukatSpent || typeof dukatSpent !== 'object') return 0;

        return (dukatSpent.great_power_action ?? 0) +
            (dukatSpent.gifts ?? 0) +
            (dukatSpent.subsidies ?? 0);
    }

    private playerData$: Observable<CountryData>[];
    private allPlayerDataCache: CountryData[] | null = null;
    private entities: LineableEntity[] | null = null;

    private options: Map<string, LineAccessor> = new Map();

    constructor() {
        this.playerData$ = this.ids_and_years.map(({ id }) =>
            this.http.get<SaveDataDump>(
                `http://skanderbeg.pm/api.php?scope=getSaveDataDump&save=${id}&type=countriesData`
            ).pipe(
                map(data => this.filterPlayerCountries(data)),
                shareReplay(1)
            )
        );

        // Initialize options with accessor functions
        this.initializeOptions();
    }

    private initializeOptions(): void {
        this.options = new Map([
            ["Total Development", () => this.buildSeriesMap((c: CountryData) => parseInt((c["total_development"] ?? 0) as string))],
            ["Max Manpower", () => this.buildSeriesMap((c: CountryData) => parseInt((c["max_manpower"] ?? 0) as string))],
            ["Dev Clicks", () => this.buildSeriesMap((c: CountryData) => c["dev_clicks"] ?? 0)],
            ["Income (No Subsidies)", () => this.buildSeriesMap((c: CountryData) => parseInt((c["inc_no_subs"] ?? 0) as string))],
            ["Ducats Spent Total", () => this.buildSeriesMap((c: CountryData) => this.sumDictValues(c["ducats_spent"] as any))],
            ["Ducats Spent on Players", () => this.buildSeriesMap((c: CountryData) => this.ducatsSpentOnPlayers(c))],
            ["Battle Casualties", () => this.buildSeriesMap((c: CountryData) => parseInt((c["battleCasualties"] ?? 0) as string))],
        ]);
    }

    private buildEntities(allPlayerData: CountryData[]): LineableEntity[] {
        // Collect all country IDs that appear as players in ANY save
        const allCountryIds = new Set<string>();
        const playerNames = new Map<string, string>();
        const countryColors = new Map<string, string>();

        allPlayerData.forEach((playerCountries) => {
            Object.entries(playerCountries).forEach(([countryId, countryData]) => {
                allCountryIds.add(countryId);
                
                // Always update to latest player name (most recent save wins)
                playerNames.set(countryId, (countryData as any).player ?? countryId);
                
                // Always update to latest color
                const color = this.colorToHex(this.colorAccess(countryData));
                countryColors.set(countryId, color);
            });
        });

        return Array.from(allCountryIds).map(countryId =>
            new CountryEntity(countryId, playerNames.get(countryId) || countryId, countryColors.get(countryId) || '#808080')
        );
    }

    private buildSeriesForEntities(
        allPlayerData: CountryData[],
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
                return 0; // Country not present in this save, use 0
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
                // Build entities once on first call, reuse on subsequent calls
                if (!this.entities) {
                    this.entities = this.buildEntities(allPlayerData);
                }
                return this.buildSeriesForEntities(allPlayerData, this.entities, valueAccessor);
            })
        );
    }

    private colorToHex(color: [number, number, number] | number): string {
        if (typeof color === 'number') {
            return '#808080';
        }
        const [r, g, b] = color;
        const toHex = (c: number) => {
            const hex = Math.round(c * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
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