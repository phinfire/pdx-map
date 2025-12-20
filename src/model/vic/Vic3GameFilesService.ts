import { HttpClient } from "@angular/common/http";
import { Good } from "./game/Good";
import { Injectable } from "@angular/core";
import { GoodCategory } from "./enum/GoodCategory";
import { from, map, switchMap, Observable, shareReplay } from "rxjs";
import { PdxFileService } from "../../services/pdx-file.service";
import { MapStateRegion } from "./game/MapStateRegion";

interface HistoryStateRegion {
    stateKey: string;
    ownerCountryTag: string;
    tiles: string[];
    is_incorporated: boolean;
    homeland?: string;
}

class ModPop {
    constructor(
        public readonly state: string,
        public readonly countryTag: string,
        public readonly culture: string,
        public readonly religion: string,
        public readonly size: number
    ) { }
}

@Injectable({ providedIn: 'root' })
export class Vic3GameFilesService {
    private readonly goods$: Observable<Good[]>;
    private readonly mapStateRegions$: Observable<MapStateRegion[]>;
    private readonly historyStateRegions$: Observable<HistoryStateRegion[]>;

    private modPops$: Observable<ModPop[]>;

    constructor(private http: HttpClient, private fileService: PdxFileService) {
        const dataUrl = "https://codingafterdark.de/pdx/vic3gamedata/00_goods.txt";
        this.goods$ = this.http.get(dataUrl, { responseType: 'text' }).pipe(
            switchMap(data => from(this.parseGoodsList(data))),
            shareReplay(1)
        );
        this.mapStateRegions$ = this.http.get("http://localhost:5500/public/preparsed/state_regions.json").pipe(
            switchMap((json: any) => from([this.parseMapStateRegions(json)])),
            shareReplay(1)
        );
        this.historyStateRegions$ = this.http.get("http://localhost:5500/public/3622477799/common/history/states/99_converter_states.txt", { responseType: 'text' }).pipe(
            switchMap(data => from(this.fileService.parseContentToJsonPromise(data))),
            map(json => this.buildHistoryStateRegions(json)),
            shareReplay(1)
        );
        this.modPops$ = this.http.get("http://localhost:5500/public/3622477799/common/history/pops/99_converted_pops.txt", { responseType: 'text' }).pipe(
            switchMap(data => from(this.fileService.parseContentToJsonPromise(data))),
            map((json: any) => this.parseModPops(json)),
            shareReplay(1)
        );
    }

    getGoods(): Observable<Good[]> {
        return this.goods$;
    }

    getMapStateRegions(): Observable<MapStateRegion[]> {
        return this.mapStateRegions$;
    }

    getHistoryStateRegions(): Observable<HistoryStateRegion[]> {
        return this.historyStateRegions$;
    }

    getModPops(): Observable<ModPop[]> {
        return this.modPops$;
    }

    private parseGoodsList(data: string): Promise<Good[]> {
        return this.fileService.importFilePromise(new File([data], "00_goods.txt")).then(value => {
            return Object.entries(value.json).map(([key, entry]: any) => {
                const category = Object.values(GoodCategory).find(cat => cat.key === entry.category);
                if (!category) {
                    throw new Error(`Unknown good category: ${entry.category} for good ${key}`);
                }
                return new Good(key, entry.index, category, entry.locKey);
            });
        });
    }

    private parseMapStateRegions(json: JSON): MapStateRegion[] {
        const regions: MapStateRegion[] = [];
        for (const [filename, filejson] of Object.entries<any>(json as any)) {
            for (const [key, entry] of Object.entries<any>(filejson)) {
                const tiles = new Set<string>(entry.tiles);
                const possibleFarmTypes = new Set<string>(entry.arable_resources ?? []);
                const mineralResource2SlotCount = new Map<string, number>();
                regions.push(new MapStateRegion(key, key, tiles, entry.arable_land ?? 0, possibleFarmTypes, mineralResource2SlotCount));
            }
        }
        return regions;
    }
    /*
    private parseHistoryStateRegions(data: string): Promise<HistoryStateRegion[]> {
        return this.fileService.parseContentToJsonPromise(data).then(json => {
            return this.buildHistoryStateRegions(json);
        });
    }*/

    private buildStateRegions(json: any): MapStateRegion[] {
        const regions: MapStateRegion[] = [];
        for (const [key, entry] of Object.entries<any>(json)) {
            const tiles = new Set<string>(entry.tiles ?? []);
            const possibleFarmTypes = new Set<string>(entry.arable_resources ?? []);
            const mineralResource2SlotCount = new Map<string, number>();
            regions.push(new MapStateRegion(key, entry.id, tiles, entry.arable_land ?? 0, possibleFarmTypes, mineralResource2SlotCount));
        }
        return regions;
    }

    private buildHistoryStateRegions(json: any): HistoryStateRegion[] {
        const actualJSON = json.STATES;
        const regions: HistoryStateRegion[] = [];
        for (const [fullKey, stateData] of Object.entries<any>(actualJSON)) {
            const createStates = Array.isArray(stateData.create_state) 
                ? stateData.create_state 
                : [stateData.create_state];
            
            for (const createState of createStates) {
                const countryStr = createState.country;
                const country = typeof countryStr === 'string' ? countryStr.split(':')[1] : countryStr;
                const provincesData = createState.owned_provinces;
                const tiles = Array.isArray(provincesData)
                    ? provincesData
                    : Object.values(provincesData || {}) as string[];

                const homelandStr = stateData.add_homeland;
                const homeland = typeof homelandStr === 'string' ? homelandStr.split(':')[1] : undefined;
                const result = {
                    stateKey: fullKey.split(':')[1] || fullKey,
                    ownerCountryTag: country,
                    tiles,
                    is_incorporated: createState.state_type === 'incorporated',
                    homeland
                }
                regions.push(result);
            }
        }
        
        return regions;
    }

    private parseModPops(json: JSON) {
        const pops: ModPop[] = [];
        for (const [_, filejson] of Object.entries<any>(json as any)) {
            for (const [stateKey, stateData] of Object.entries<any>(filejson)) {
                for (const [countryKey, data] of Object.entries<any>(stateData)) {
                    if (data["create_pop"]) {
                        const popDataList = Array.isArray(data["create_pop"]) ? data["create_pop"] : [data["create_pop"]];
                        for (const popData of popDataList) {
                            pops.push(new ModPop(
                                stateKey.split(":")[1],
                                countryKey.split(":")[1],
                                popData["culture"],
                                popData["religion"],
                                popData["size"] || 0
                            ));
                        }
                    }
                }
            }
        }
        return pops;
    }

    private writeBackModPops(pops: ModPop[]): string {
        const lines: string[] = [];
        lines.push("POPS = {");
        const popsByState = new Map<string, ModPop[]>();
        for (const pop of pops) {
            if (!popsByState.has(pop.state)) {
                popsByState.set(pop.state, []);
            }
            popsByState.get(pop.state)!.push(pop);
        }
        for (const [state, stateList] of popsByState.entries()) {
            lines.push(`\ts:${state} = {`);
            const popsByCountry = new Map<string, ModPop[]>();
            for (const pop of stateList) {
                if (!popsByCountry.has(pop.countryTag)) {
                    popsByCountry.set(pop.countryTag, []);
                }
                popsByCountry.get(pop.countryTag)!.push(pop);
            }
            for (const [region, regionList] of popsByCountry.entries()) {
                lines.push(`\t\tregion_state:${region} = {`);
                for (const pop of regionList) {
                    lines.push(`\t\t\tcreate_pop = {`);
                    lines.push(`\t\t\t\tculture = ${pop.culture}`);
                    lines.push(`\t\t\t\treligion = ${pop.religion}`);
                    lines.push(`\t\t\t\tsize = ${pop.size}`);
                    lines.push(`\t\t\t}`);
                }
                lines.push(`\t\t}`);
            }
            lines.push(`\t}`);
        }
        lines.push("}");
        return lines.join("\n");
    }
}