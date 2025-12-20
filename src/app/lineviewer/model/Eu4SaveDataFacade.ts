import { RGB } from "../../../util/RGB";

export interface CountryData {
    [key: string]: any;
    player?: string;
}

export interface SaveDataDump {
    [countryId: string]: CountryData;
}

export interface YearSnapshot {
    id: string;
    year: number;
}

export class Eu4SaveDataFacade {
    readonly year: number;
    private readonly dump: SaveDataDump;

    constructor(dump: SaveDataDump, year: number) {
        this.dump = dump;
        this.year = year;
    }

    getCountryIds(): string[] {
        return Object.keys(this.dump);
    }

    getCountryData(countryId: string): CountryData | undefined {
        return this.dump[countryId];
    }

    getPlayerCountries(): Map<string, CountryData> {
        const players = new Map<string, CountryData>();
        Object.entries(this.dump).forEach(([countryId, countryData]) => {
            if (countryData && typeof countryData === 'object' && 'player' in countryData) {
                players.set(countryId, countryData);
            }
        });
        return players;
    }

    getPlayerNames(): Record<string, string> {
        return Object.entries(this.dump).reduce((acc, [k, v]) => {
            acc[k] = (v as any).player ?? k;
            return acc;
        }, {} as Record<string, string>);
    }

    extractValues(accessor: (data: CountryData) => any): Record<string, any> {
        return Object.entries(this.dump).reduce((acc, [k, v]) => {
            acc[k] = accessor(v);
            return acc;
        }, {} as Record<string, any>);
    }

    sumDictValues(dict: Record<string, number> | undefined): number {
        if (!dict || typeof dict !== 'object') return 0;
        return Object.values(dict).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
    }

    getCountryColor(country: CountryData): RGB {
        const mapColor = country["map_color"] as any;
        if (!mapColor || typeof mapColor !== 'object') {
            return new RGB(0, 0, 0);
        }
        const r = Math.min(255, Math.max(0, parseInt(mapColor.r ?? 0) || 0));
        const g = Math.min(255, Math.max(0, parseInt(mapColor.g ?? 0) || 0));
        const b = Math.min(255, Math.max(0, parseInt(mapColor.b ?? 0) || 0));
        return new RGB(r, g, b);
    }

    ducatsSpentOnPlayers(country: CountryData): number {
        const dukatSpent = country["ducats_spent"] as any;
        if (!dukatSpent || typeof dukatSpent !== 'object') return 0;

        return (dukatSpent.great_power_action ?? 0) +
            (dukatSpent.gifts ?? 0) +
            (dukatSpent.subsidies ?? 0);
    }
}

export class CountryDataFacade {
    constructor(
        private countryId: string,
        private allDumps: Eu4SaveDataFacade[]
    ) {}

    getCountryId(): string {
        return this.countryId;
    }

    getPlayerName(): string {
        const dump = this.allDumps[0];
        const countryData = dump.getCountryData(this.countryId);
        return (countryData as any)?.player ?? this.countryId;
    }

    getColor(): RGB {
        const dump = this.allDumps[0];
        const countryData = dump.getCountryData(this.countryId);
        if (!countryData) {
            return new RGB(128, 128, 128);
        }
        return dump.getCountryColor(countryData);
    }

    extractTimeSeries(valueAccessor: (data: CountryData | undefined) => any): Array<{ year: number; value: any }> {
        return this.allDumps.map(dump => ({
            year: dump.year,
            value: valueAccessor(dump.getCountryData(this.countryId))
        }));
    }

    extractNumericTimeSeries(valueAccessor: (data: CountryData | undefined) => number): Array<{ year: number; value: number }> {
        return this.allDumps.map(dump => ({
            year: dump.year,
            value: valueAccessor(dump.getCountryData(this.countryId))
        }));
    }

    extractDictSumTimeSeries(accessor: (data: CountryData | undefined) => Record<string, number> | undefined): Array<{ year: number; value: number }> {
        return this.allDumps.map(d => ({
            year: d.year,
            value: d.sumDictValues(accessor(d.getCountryData(this.countryId)))
        }));
    }

    extractDucatsSpentOnPlayersTimeSeries(): Array<{ year: number; value: number }> {
        return this.allDumps.map(d => {
            const countryData = d.getCountryData(this.countryId);
            return {
                year: d.year,
                value: countryData ? d.ducatsSpentOnPlayers(countryData) : 0
            };
        });
    }
}