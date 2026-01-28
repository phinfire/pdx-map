import * as THREE from 'three';
import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, forkJoin, map, shareReplay } from "rxjs";
import { CK3 } from "../../model/ck3/CK3";
import { AbstractLandedTitle } from "../../model/ck3/title/AbstractLandedTitle";
import { CK3Service } from "../../services/gamedata/CK3Service";
import { makeGeoJsonPolygons } from "../../util/geometry/threeGeometry";
import { MapService } from "../map.service";
import { ColorConfigProvider } from "../viewers/polygon-select/ColorConfigProvider";
import { ClusterManager } from "./mcsignup/ClusterManager";
import { RulerTier } from '../../model/ck3/RulerTier';
import { Ck3Save } from '../../model/ck3/Ck3Save';

export interface SignupAssetsData {
    geoJsonData: any;
    ck3SaveData: any;
    meshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[];
    configProviders: ColorConfigProvider[];
    clusterManager: ClusterManager;
    ck3: CK3;
}

class RegionConfig {
    constructor(public readonly regions: Region[],
        public readonly topLevelKeysToInclude: string[]) { }
}

class Region {

    constructor(public readonly name: string,
        public readonly plusElements: Set<string>,
        public readonly minusElements: Set<string>,
        public readonly baseElements: Set<string>) { }
}

@Injectable({
    providedIn: 'root'
})
export class SignupAssetsService {

    private readonly baseUrl = "https://codingafterdark.de/pdx"

    private mapService = inject(MapService);
    private ck3Service = inject(CK3Service);

    private _dataSubject = new BehaviorSubject<SignupAssetsData | null>(null);
    private _loadingSubject = new BehaviorSubject<boolean>(false);

    private fetchRegionConfig$(): Observable<RegionConfig> {
        return new Observable<RegionConfig>(observer => {
            fetch(this.baseUrl + '/mega/mc-regions.txt')
                .then(res => res.text())
                .then(text => {
                    observer.next(SignupAssetsService.parseRegionConfig(text));
                    observer.complete();
                })
                .catch(err => observer.error(err));
        }).pipe(shareReplay(1));
    }

    getRegionNameList$() {
        return this.fetchRegionConfig$().pipe(
            map(config => config.regions.map(region => region.name))
        );
    }

    private _loadMapData$: Observable<SignupAssetsData> | null = null;

    loadMapData$(): Observable<SignupAssetsData> {
        const currentData = this._dataSubject.value;
        if (currentData) {
            return new Observable<SignupAssetsData>(observer => {
                observer.next(currentData);
                observer.complete();
            });
        }
        if (!this._loadMapData$) {
            this._loadingSubject.next(true);
            this._loadMapData$ = forkJoin({
                geoJson: this.mapService.fetchCK3GeoJson(true, false),
                ck3Save: this.ck3Service.openCk3ZeroSaveFromFile(),
                parsedRegionConfig: this.fetchRegionConfig$()
            }).pipe(
                map(({ geoJson, ck3Save, parsedRegionConfig }) => {
                    const ck3 = ck3Save.getCK3();
                    const key2color = new Map<string, number>();
                    const keysToExclude = SignupAssetsService.collectAllChildren(ck3Save, parsedRegionConfig.topLevelKeysToInclude);
                    const key2ClusterKey = SignupAssetsService.buildKey2Cluster(ck3, ck3Save, parsedRegionConfig.regions, keysToExclude);
                    ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
                        let liegeTitleKey = ck3.getDeJureLiegeTitle(title.getKey())!
                        liegeTitleKey = ck3.getDeJureLiegeTitle(liegeTitleKey)!;
                        const deFactoTopLiege = title.getUltimateLiegeTitle();
                        key2color.set(title.getKey(), deFactoTopLiege.getColor().toNumber());
                    });
                    const colorIn1066Provider = new ColorConfigProvider(key2color);
                    const forceNonInteractive = (key: string) => {
                        return keysToExclude.has(key) ? true : false;
                    };
                    //const countyRealms = SignupAssetsService.findCountiesOwnedByAtMostDoubleCounts(ck3Save, 2);
                    //const countiesPartOfCountyRealms = new Set<string>();
                    //countyRealms.forEach(realm => realm.forEach(county => countiesPartOfCountyRealms.add(county)));
                    //const dotTexture = makeDotTexture(0.6);
                    const meshes = makeGeoJsonPolygons(geoJson, colorIn1066Provider, (countyKey) => null, forceNonInteractive, 1.5);
                    const clusterManager = new ClusterManager(key2ClusterKey);
                    const data: SignupAssetsData = {
                        geoJsonData: geoJson,
                        ck3SaveData: ck3Save,
                        meshes: meshes,
                        configProviders: [colorIn1066Provider],
                        clusterManager: clusterManager,
                        ck3: ck3,
                    };
                    this._dataSubject.next(data);
                    this._loadingSubject.next(false);
                    return data;
                }),
                shareReplay(1)
            );
        }
        return this._loadMapData$;
    }

    loadRegionMapData$(regionKey: string): Observable<SignupAssetsData> {
        return forkJoin({
            geoJson: this.mapService.fetchCK3GeoJson(true, false),
            ck3Save: this.ck3Service.openCk3ZeroSaveFromFile(),
            parsedRegionConfig: this.fetchRegionConfig$()
        }).pipe(
            map(({ geoJson, ck3Save, parsedRegionConfig }) => {
                const ck3 = ck3Save.getCK3();
                const keysToExclude = SignupAssetsService.collectAllChildren(ck3Save, parsedRegionConfig.topLevelKeysToInclude);
                const key2ClusterKey = SignupAssetsService.buildKey2Cluster(ck3, ck3Save, parsedRegionConfig.regions, keysToExclude);
                const baseClusterManager = new ClusterManager(key2ClusterKey);
                const countiesInRegion = baseClusterManager.getCluster2Keys(regionKey);

                const countyRealms = SignupAssetsService.findCountiesOwnedByAtMostDoubleCounts(ck3Save, 2);
                const countyToRealmMap = new Map<string, string>();
                countyRealms.forEach((realm, realmIndex) => {
                    const realmKey = `realm_${realmIndex}_${realm[0]}`;
                    realm.forEach(countyKey => {
                        if (countiesInRegion.includes(countyKey)) {
                            countyToRealmMap.set(countyKey, realmKey);
                        }
                    });
                });
                countiesInRegion.forEach(countyKey => {
                    if (!countyToRealmMap.has(countyKey)) {
                        countyToRealmMap.set(countyKey, `single_${countyKey}`);
                    }
                });

                const key2color = new Map<string, number>();
                ck3Save.getLandedTitles()
                    .filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_") && countiesInRegion.includes(title.getKey()))
                    .forEach((title: AbstractLandedTitle) => {
                        const deFactoTopLiege = title.getUltimateLiegeTitle();
                        key2color.set(title.getKey(), deFactoTopLiege.getColor().toNumber());
                    });

                const colorProvider = new ColorConfigProvider(key2color);
                const forceNonInteractive = (key: string) => {
                    return keysToExclude.has(key) ? true : false;
                };

                const countiesOwnedByDoubleOrSingleCounts = new Set<string>();
                countyRealms.forEach(realm => {
                    realm.forEach(county => {
                        if (countiesInRegion.includes(county)) {
                            countiesOwnedByDoubleOrSingleCounts.add(county);
                        }
                    })
                });
                const allMeshes = makeGeoJsonPolygons(geoJson, colorProvider, (countyKey) => null, forceNonInteractive, 1.5);
                const meshes = allMeshes.filter(mesh => countiesInRegion.includes(mesh.key));
                meshes.forEach(mesh => {
                    if (!countiesOwnedByDoubleOrSingleCounts.has(mesh.key)) {
                        mesh.interactive = false;
                    }
                    //mesh.interactive = true;
                    //mesh.locked = false;
                });

                const clusterManager = new ClusterManager(countyToRealmMap);
                const data: SignupAssetsData = {
                    geoJsonData: geoJson,
                    ck3SaveData: ck3Save,
                    meshes: meshes,
                    configProviders: [colorProvider],
                    clusterManager: clusterManager,
                    ck3: ck3,
                };

                return data;
            }),
            shareReplay(1)
        );
    }

    static findCountiesOwnedByAtMostDoubleCounts(save: Ck3Save, k: number): string[][] {
        const holder2CountyTitles = new Map<string, string[]>();
        const holder2PrimaryTitle = new Map<string, string>();
        for (const title of save.getLandedTitles()) {
            if (!title.getKey().startsWith("c_")) {
                continue;
            }
            const holder = title.getHolder();
            if (holder == null) {
                console.warn(`Title ${title.getKey()} has no holder`);
                continue;
            }
            if (holder.getCharacterTier() == RulerTier.COUNT) {
                if (!holder2PrimaryTitle.has(holder.getCharacterId())) {
                    holder2PrimaryTitle.set(holder.getCharacterId(), holder.getPrimaryTitle()!.getKey());
                }
                if (!holder2CountyTitles.has(holder.getCharacterId())) {
                    holder2CountyTitles.set(holder.getCharacterId(), []);
                }
                if (title.getKey() == holder2PrimaryTitle.get(holder.getCharacterId())) {
                    holder2CountyTitles.get(holder.getCharacterId())!.unshift(title.getKey());
                } else {
                    holder2CountyTitles.get(holder.getCharacterId())!.push(title.getKey());
                }
            }
        }
        return Array.from(holder2CountyTitles.values()).filter(titles => titles.length <= k).sort((a, b) => a.length - b.length);
    }

    private static collectAllChildren(ck3Save: Ck3Save, topLevelKeys: string[]): Set<string> {
        const allChildren = new Set<string>();
        ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
            this.getPathToTheTop(title.getKey(), ck3Save.getCK3()).forEach(key => {
                if (topLevelKeys.includes(key)) {
                    allChildren.add(title.getKey());
                    return;
                }
            });
        });
        return allChildren;
    }

    private static buildKey2Cluster(ck3: CK3, ck3Save: Ck3Save, regions: Region[], key2Exclude: Set<string>) {
        const key2ClusterKey = new Map<string, string>();
        ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
            if (key2Exclude.has(title.getKey())) {
                return;
            }
            let matchedRegionNames = [];
            const pathToTheTop = SignupAssetsService.getPathToTheTop(title.getKey(), ck3);
            for (const region of regions) {
                for (const key of pathToTheTop) {
                    if (region.plusElements.has(key) || region.baseElements.has(key)) {
                        matchedRegionNames.push(region.name);
                    }
                    if (region.minusElements.has(key)) {
                        break;
                    }
                }
            }
            if (matchedRegionNames.length == 0) {
                console.error(`Title\n${this.getPathToTheTop(title.getKey(), ck3).join(" -> ")} \ndoes not belong to any region`);
            }
            if (matchedRegionNames.length > 1) {
                console.error(`Title\n${this.getPathToTheTop(title.getKey(), ck3).join(" -> ")} \nbelongs to multiple regions: ${matchedRegionNames.join(", ")}`);
            }
            key2ClusterKey.set(title.getKey(), matchedRegionNames[0]);
        });
        return key2ClusterKey;
    }

    private static getPathToTheTop(titleKey: string, ck3: CK3) {
        const path = [];
        let currentKey: string | null | undefined = titleKey;
        while (currentKey) {
            path.push(currentKey);
            currentKey = ck3.getDeJureLiegeTitle(currentKey);
        }
        return path;
    }

    private static parseRegionConfig(fileContent: string) {
        const keysToExclude = [];
        const regions: Region[] = [];
        const cleanLines = Array.from(fileContent.split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0 && !line.startsWith("#")));
        for (const line of cleanLines) {
            if (line.startsWith("!")) {
                keysToExclude.push(line.substring(1).trim());
                continue;
            }
            const parts = line.split("=");
            if (parts.length != 2) {
                console.warn(`Invalid line in region config: ${line}`);
                return { regions: [], topLevelKeysToInclude: [] };
            }
            const regionName = parts[0].trim();
            const formula = parts[1].trim();
            const plusElements = new Set<string>();
            const minusElements = new Set<string>();
            const baseElements = new Set<string>();
            let currentOp: '+' | '~' = '+';
            const tokens = formula.match(/([+~])|([a-zA-Z0-9_-]+)/g) || [];
            tokens.forEach((token, idx) => {
                if (token === '+' || token === '~') {
                    currentOp = token as '+' | '~';
                } else {
                    if (idx === 0) {
                        baseElements.add(token);
                    } else if (currentOp === '+') {
                        plusElements.add(token);
                    } else if (currentOp === '~') {
                        minusElements.add(token);
                    }
                }
            });
            regions.push(new Region(regionName, plusElements, minusElements, baseElements));
        }
        return new RegionConfig(regions, keysToExclude);
    }

    isDataReady(): boolean {
        const data = this._dataSubject.value;
        return data !== null && data.geoJsonData && data.ck3SaveData && data.meshes && data.configProviders.length > 0;
    }

    getCurrentData(): SignupAssetsData | null {
        return this._dataSubject.value;
    }

    isLoading(): boolean {
        return this._loadingSubject.value;
    }

    getMeshStatistics(meshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[]): { meshCount: number, triangleCount: number } {
        const totalTriangles = meshes.reduce((total, polygon) => {
            const geometry = polygon.geometry;
            if (geometry.index) {
                return total + (geometry.index.count / 3);
            } else {
                const positions = geometry.attributes['position'] as THREE.BufferAttribute;
                return total + (positions.count / 3);
            }
        }, 0);

        return {
            meshCount: meshes.length,
            triangleCount: Math.floor(totalTriangles)
        };
    }
}