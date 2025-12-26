import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, switchMap, from, shareReplay, map, forkJoin } from 'rxjs';
import { PdxFileService } from '../../services/pdx-file.service';
import { GoodCategory } from './enum/GoodCategory';
import { ResourceType } from './enum/ResourceType';
import { Good } from './game/Good';
import { MapStateRegion } from './game/MapStateRegion';
import { ModPop } from './game/ModPop';

interface HistoryStateRegion {
    stateKey: string;
    ownerCountryTag: string;
    tiles: string[];
    is_incorporated: boolean;
    homeland?: string;
}

class ModBuilding {
    constructor(
        public readonly state: string,
        public readonly regionState: string,
        public readonly buildingName: string,
        public readonly countryTag: string,
        public readonly buildingType: string,
        public readonly levels: number
    ) { }
}

@Injectable({ providedIn: 'root' })
export class Vic3GameFilesService {

    private readonly PATH = "http://localhost:5500/public/"

    private readonly goods$: Observable<Good[]>;
    private readonly mapStateRegions$: Observable<MapStateRegion[]>;
    private readonly historyStateRegions$: Observable<HistoryStateRegion[]>;

    private modPops$: Observable<ModPop[]>;
    private modBuildings$: Observable<ModBuilding[]>;
    private diplomaticPacts$: Observable<{overlordTag: string, vassalTag: string, type: string}[]>;

    constructor(private http: HttpClient, private fileService: PdxFileService) {
        const dataUrl = "https://codingafterdark.de/pdx/vic3gamedata/00_goods.txt";
        this.goods$ = this.http.get(dataUrl, { responseType: 'text' }).pipe(
            switchMap(data => from(this.parseGoodsList(data))),
            shareReplay(1)
        );
        this.mapStateRegions$ = this.fetchStateRegionFiles().pipe(
            switchMap(jsons => from([this.parseMapStateRegions(jsons)])),
            shareReplay(1)
        );
        this.historyStateRegions$ = this.http.get(this.PATH + "3624541199/common/history/states/99_converter_states.txt", { responseType: 'text' }).pipe(
            switchMap(data => from(this.fileService.parseContentToJsonPromise(data))),
            map(json => this.buildHistoryStateRegions(json)),
            shareReplay(1)
        );
        this.modPops$ = this.http.get(this.PATH + "3624541199/common/history/pops/99_converted_pops.txt", { responseType: 'text' }).pipe(
            switchMap(data => from(this.fileService.parseContentToJsonPromise(data))),
            map((json: any) => this.parseModPops(json)),
            shareReplay(1)
        );
        this.modBuildings$ = this.http.get(this.PATH + "3624541199/common/history/buildings/99_converted_buildings.txt", { responseType: 'text' }).pipe(
            switchMap(data => from(this.fileService.parseContentToJsonPromise(data))),
            map((json: any) => this.parseModBuildings(json)),
            shareReplay(1)
        );
        this.diplomaticPacts$ = this.http.get(this.PATH + "3624541199/common/history/diplomacy/00_subject_relationships.txt", { responseType: 'text' }).pipe(
            switchMap(data => from(this.fileService.parseContentToJsonPromise(data))),
            map((json) => this.parseDiplomaticPacts(json)),
            shareReplay(1)
        );
        this.diplomaticPacts$.subscribe(pacts => {
            console.log("Loaded diplomatic pacts:", pacts);
        });
    }

    parseDiplomaticPacts(json: JSON): {overlordTag: string, vassalTag: string, type: string}[] {
        const pacts: {overlordTag: string, vassalTag: string, type: string}[] = [];
        const diplomacyData = (json as any)["DIPLOMACY"];
        
        if (!diplomacyData || !Array.isArray(diplomacyData)) {
            return pacts;
        }

        // The DIPLOMACY data is parsed as a flat array: [countryTag, {?{pactData}}, countryTag2, ...]
        for (let i = 0; i < diplomacyData.length; i += 2) {
            const overlordKey = diplomacyData[i];
            const countryData = diplomacyData[i + 1];
            
            if (!overlordKey || !countryData) continue;
            
            const overlordTag = overlordKey.split(":")[1] || overlordKey;
            const pactWrapper = countryData["?"];
            
            if (!pactWrapper) continue;
            
            // pactWrapper contains the actual pact definitions
            if (pactWrapper["create_diplomatic_pact"]) {
                const pactsList = Array.isArray(pactWrapper["create_diplomatic_pact"])
                    ? pactWrapper["create_diplomatic_pact"]
                    : [pactWrapper["create_diplomatic_pact"]];
                
                for (const pact of pactsList) {
                    if (pact && pact["country"] && pact["type"]) {
                        const vassalKey = pact["country"];
                        const vassalTag = typeof vassalKey === 'string' ? vassalKey.split(":")[1] : vassalKey;
                        
                        pacts.push({
                            overlordTag: overlordTag,
                            vassalTag: vassalTag,
                            type: pact["type"]
                        });
                    }
                }
            }
        }
        
        return pacts;
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

    getModBuildings(): Observable<ModBuilding[]> {
        return this.modBuildings$;
    }

    getDiplomaticPacts() {
        return this.diplomaticPacts$;
    }

    getAllAvailableResources(): Observable<string[]> {
        return this.mapStateRegions$.pipe(
            map(regions => {
                const resources = new Set<string>();
                for (const region of regions) {
                    // Get arable resources
                    const arableResourcesMap = region.getArableResources();
                    for (const [resource, slots] of arableResourcesMap.entries()) {
                        if (slots > 0) {
                            resources.add(resource);
                        }
                    }
                    // Get other resources
                    const otherResourcesMap = region.getOtherResources();
                    for (const [resource, slots] of otherResourcesMap.entries()) {
                        if (slots > 0) {
                            resources.add(resource);
                        }
                    }
                }
                return Array.from(resources).sort();
            })
        );
    }

    getResourceTypes(): Observable<Map<string, ResourceType>> {
        return this.mapStateRegions$.pipe(
            map(regions => {
                const resourceTypes = new Map<string, ResourceType>();
                for (const region of regions) {
                    // Map arable resources
                    const arableResourcesMap = region.getArableResources();
                    for (const resource of arableResourcesMap.keys()) {
                        resourceTypes.set(resource, ResourceType.ARABLE);
                    }
                    // Map capped resources
                    const cappedResourcesMap = region.getCappedResources();
                    for (const resource of cappedResourcesMap.keys()) {
                        resourceTypes.set(resource, ResourceType.CAPPED);
                    }
                    // Map uncapped resources
                    const uncappedResources = region.getUncappedResources();
                    for (const res of uncappedResources) {
                        resourceTypes.set(res.type, ResourceType.UNCAPPED);
                    }
                }
                return resourceTypes;
            })
        );
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
        const normalizeToArray = (value: any): any[] => {
            if (!value) return [];
            if (!Array.isArray(value)) return [value];
            return value.flatMap(item => Array.isArray(item) ? item : [item]);
        };

        const regions: MapStateRegion[] = [];
        for (const [filename, filejson] of Object.entries<any>(json as any)) {
            for (const [key, entry] of Object.entries<any>(filejson)) {
                const tiles = new Set<string>(entry.provinces ? normalizeToArray(entry.provinces) : []);
                const arableLand = entry.arable_land ?? 0;
                const arableResources = normalizeToArray(entry.arable_resources);
                const possibleFarmTypes = new Set<string>(arableResources);
                
                const arableResourcesMap = new Map<string, number>();
                const otherResourcesMap = new Map<string, number>();
                const cappedResourcesMap = new Map<string, number>();
                const uncappedResourcesArray: Array<{ type: string; undiscovered_amount: number }> = [];
                
                for (const resource of arableResources) {
                    arableResourcesMap.set(resource, arableLand);
                }
                for (const cappedResources of normalizeToArray(entry.capped_resources)) {
                    if (cappedResources && typeof cappedResources === 'object') {
                        Object.entries<number>(cappedResources).forEach(([resourceName, slotCount]) => {
                            otherResourcesMap.set(resourceName, slotCount);
                            cappedResourcesMap.set(resourceName, slotCount);
                        });
                    }
                }
                for (const resource of normalizeToArray(entry.resource)) {
                    if (resource && typeof resource === 'object') {
                        const resourceName = resource.type;
                        const slotCount = resource.undiscovered_amount || 0;
                        otherResourcesMap.set(resourceName, slotCount);
                        uncappedResourcesArray.push({ type: resourceName, undiscovered_amount: slotCount });
                    }
                }

                const traits = new Set<string>(entry.traits ? normalizeToArray(entry.traits) : []);
                
                regions.push(new MapStateRegion(
                    key,
                    key,
                    tiles,
                    arableLand,
                    possibleFarmTypes,
                    arableResourcesMap,
                    otherResourcesMap,
                    filename,
                    entry.id,
                    entry.subsistence_building,
                    traits,
                    entry.city,
                    entry.port,
                    entry.farm,
                    entry.mine,
                    entry.wood,
                    cappedResourcesMap,
                    entry.naval_exit_id,
                    uncappedResourcesArray
                ));
            }
        }
        return regions;
    }

    private fetchStateRegionFiles(): Observable<any> {
        const stateRegionFiles = [
            '00_west_europe.txt',
            '01_south_europe.txt',
            '02_east_europe.txt',
            '03_north_africa.txt',
            '04_subsaharan_africa.txt',
            '05_north_america.txt',
            '06_central_america.txt',
            '07_south_america.txt',
            '08_middle_east.txt',
            '09_central_asia.txt',
            '10_india.txt',
            '11_east_asia.txt',
            '12_indonesia.txt',
            '13_australasia.txt',
            '14_siberia.txt',
            '15_russia.txt'
        ];

        const fileRequests = stateRegionFiles.map(filename =>
            this.http.get(this.PATH + `hosted/map_data/${filename}`, { responseType: 'text' }).pipe(
                switchMap(data => from(this.fileService.parseContentToJsonPromise(data))),
                map(json => ({ [filename]: json }))
            )
        );

        return forkJoin(fileRequests).pipe(
            map(jsons => Object.assign({}, ...jsons))
        );
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

    private parseModBuildings(json: JSON) {
        const buildings: ModBuilding[] = [];
        const buildingsData = (json as any)["BUILDINGS"];
        
        for (const [stateKey, stateData] of Object.entries<any>(buildingsData)) {
            const stateName = stateKey.split(":")[1] || stateKey;
            
            for (const [regionStateKey, regionStateData] of Object.entries<any>(stateData)) {
                const regionStateName = regionStateKey.split(":")[1] || regionStateKey;
                
                if (regionStateData["create_building"]) {
                    const buildingsList = Array.isArray(regionStateData["create_building"]) 
                        ? regionStateData["create_building"] 
                        : [regionStateData["create_building"]];
                    
                    for (const buildingData of buildingsList) {
                        const buildingName = buildingData["building"];
                        const ownershipList = Array.isArray(buildingData["add_ownership"])
                            ? buildingData["add_ownership"]
                            : [buildingData["add_ownership"]];
                        
                        for (const ownership of ownershipList) {
                            if (ownership && ownership["building"]) {
                                const bldg = ownership["building"];
                                buildings.push(new ModBuilding(
                                    stateName,
                                    regionStateName,
                                    buildingName,
                                    bldg["country"].split(":")[1] || bldg["country"],
                                    bldg["type"],
                                    bldg["levels"] || 0
                                ));
                            }
                        }
                    }
                }
            }
        }
        
        return buildings;
    }

    public writeBackModPops(pops: ModPop[]): string {
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
            for (const [country, countryList] of popsByCountry.entries()) {
                lines.push(`\t\tregion_state:${country} = {`);
                for (const pop of countryList) {
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

    scalePopulationsByCountry(pops: ModPop[], scalingFactors: Map<string, number>): ModPop[] {
        return pops.map(pop => {
            const scaleFactor = scalingFactors.get(pop.countryTag) ?? 1;
            return pop.getScaled(scaleFactor);
        });
    }

    public writeBackHistoryStateRegions(regions: HistoryStateRegion[]): string {
        const lines: string[] = [];
        lines.push("STATES = {");
        
        const regionsByState = new Map<string, HistoryStateRegion[]>();
        for (const region of regions) {
            if (!regionsByState.has(region.stateKey)) {
                regionsByState.set(region.stateKey, []);
            }
            regionsByState.get(region.stateKey)!.push(region);
        }
        for (const [stateKey, stateList] of regionsByState.entries()) {
            lines.push(`\ts:${stateKey} = {`);
            for (const region of stateList) {
                lines.push(`\t\tcreate_state = {`);
                lines.push(`\t\t\tcountry = c:${region.ownerCountryTag}`);
                lines.push(`\t\t\tstate_type = ${region.is_incorporated ? 'incorporated' : 'unincorporated'}`);
                if (region.tiles.length > 0) {
                    lines.push(`\t\t\towned_provinces = {`);
                    region.tiles.forEach(tile => {
                        lines.push(`\t\t\t\t${tile}`);
                    });
                    lines.push(`\t\t\t}`);
                }
                lines.push(`\t\t}`);
            }
            if (stateList.length > 0 && stateList[0].homeland) {
                lines.push(`\t\tadd_homeland = ${stateList[0].homeland}`);
            }
            lines.push(`\t}`);
        }
        
        lines.push("}");
        return lines.join("\n");
    }

    public async writeBackHistoryStateRegionsToZip(regions: HistoryStateRegion[]): Promise<Blob> {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const fileContent = this.writeBackHistoryStateRegions(regions);
        zip.file('99_converter_states.txt', fileContent);
        return await zip.generateAsync({ type: 'blob' });
    }

public async writeMapStateRegionsToZip(regions: MapStateRegion[]): Promise<Blob> {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const regionsByFile = new Map<string, MapStateRegion[]>();
        for (const region of regions) {
            const filename = region.getFilename();
            if (!regionsByFile.has(filename)) {
                regionsByFile.set(filename, []);
            }
            regionsByFile.get(filename)!.push(region);
        }
        for (const [filename, fileRegions] of regionsByFile.entries()) {
            const fileContent = this.buildStateRegionContent(fileRegions);
            zip.file(filename, fileContent);
        }
        return await zip.generateAsync({ type: 'blob' });
    }

    private buildStateRegionContent(regions: MapStateRegion[]): string {
        const lines: string[] = [];
        for (const region of regions) {
            const name = region.getName();
            
            lines.push(`${name} = {`);
            
            if (region.getId() !== undefined) {
                lines.push(`\tid = ${region.getId()}`);
            }
            
            if (region.getSubsistenceBuilding()) {
                lines.push(`\tsubsistence_building = "${region.getSubsistenceBuilding()}"`);
            }
            
            const tiles = Array.from(region.getTiles());
            if (tiles.length > 0) {
                lines.push(`\tprovinces = { ${tiles.map(t => `"${t}"`).join(' ')} }`);
            }
            
            const traits = Array.from(region.getTraits());
            if (traits.length > 0) {
                lines.push(`\ttraits = { ${traits.join(' ')} }`);
            }
            
            if (region.getCity()) {
                lines.push(`\tcity = "${region.getCity()}"`);
            }
            if (region.getPort()) {
                lines.push(`\tport = "${region.getPort()}"`);
            }
            if (region.getFarm()) {
                lines.push(`\tfarm = "${region.getFarm()}"`);
            }
            if (region.getMine()) {
                lines.push(`\tmine = "${region.getMine()}"`);
            }
            if (region.getWood()) {
                lines.push(`\twood = "${region.getWood()}"`);
            }
            
            const arableLand = region.getArableLand();
            if (arableLand > 0) {
                lines.push(`\tarable_land = ${arableLand}`);
            }
            
            const farmTypes = Array.from(region.getPossibleFarmTypes());
            if (farmTypes.length > 0) {
                lines.push(`\tarable_resources = { ${farmTypes.join(' ')} }`);
            }
            
            const cappedResources = region.getCappedResources();
            if (cappedResources.size > 0) {
                lines.push(`\tcapped_resources = {`);
                for (const [resourceName, slotCount] of cappedResources.entries()) {
                    lines.push(`\t\t${resourceName} = ${slotCount}`);
                }
                lines.push(`\t}`);
            }
            
            const uncappedResources = region.getUncappedResources();
            if (uncappedResources.length > 0) {
                lines.push(`\tresource = {`);
                for (const res of uncappedResources) {
                    lines.push(`\t\ttype = ${res.type}`);
                    lines.push(`\t\tundiscovered_amount = ${res.undiscovered_amount}`);
                }
                lines.push(`\t}`);
            }
            
            if (region.getNavalExitId() !== undefined) {
                lines.push(`\tnaval_exit_id = ${region.getNavalExitId()}`);
            }
            
            lines.push(`}`);
            lines.push(``);
        }
        return lines.join('\n');
    }
}
