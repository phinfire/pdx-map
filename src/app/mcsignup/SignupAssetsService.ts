import { Injectable, inject } from "@angular/core";
import { forkJoin, Observable, BehaviorSubject } from 'rxjs';
import { MapService } from '../map.service';
import { CK3Service } from '../services/gamedata/CK3Service';
import { tap, map } from 'rxjs/operators';
import { RendererConfigProvider } from '../polygon-select/RendererConfigProvider';
import { ThreeService } from './ThreeService';
import * as THREE from 'three';
import { AbstractLandedTitle } from "../model/ck3/title/AbstractLandedTitle";
import { ClusterManager } from './ClusterManager';
import { Ck3Save } from "../model/Ck3Save";
import { CK3 } from "../model/ck3/CK3";

export interface SignupAssetsData {
    geoJsonData: any;
    ck3SaveData: any;
    meshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[];
    configProvider: RendererConfigProvider;
    key2ClusterKey: Map<string, string>;
    clusterManager: ClusterManager;
    ck3: CK3;
}

@Injectable({
    providedIn: 'root'
})
export class SignupAssetsService {

    //private readonly baseUrl="http://127.0.0.1:5500/public"
    private readonly baseUrl="https://codingafterdark.de/pdx/"

    private mapService = inject(MapService);
    private ck3Service = inject(CK3Service);

    private _dataSubject = new BehaviorSubject<SignupAssetsData | null>(null);
    private _loadingSubject = new BehaviorSubject<boolean>(false);

    public data$ = this._dataSubject.asObservable();
    public loading$ = this._loadingSubject.asObservable();

    loadMapData(): Observable<SignupAssetsData> {
        this._loadingSubject.next(true);

        return forkJoin({
            geoJson: this.mapService.fetchCK3GeoJson(true, false),
            ck3Save: this.ck3Service.openCk3SaveFromFile(this.baseUrl + "/ZERO_WILLIAM.ck3"),
            regionConfig: fetch(this.baseUrl +'/mc-regions.txt').then(res => res.text())
        }).pipe(
            map(({ geoJson, ck3Save, regionConfig }) => {
                const ck3 = ck3Save.getCK3();
                const key2color = new Map<string, number>();
                const parsedRegionConfig = SignupAssetsService.parseRegionConfig(regionConfig);
                const keysToExclude = SignupAssetsService.collectAllChildren(ck3Save, parsedRegionConfig.topLevelKeysToInclude);
                const key2ClusterKey = SignupAssetsService.buildKey2Cluster(ck3, ck3Save, parsedRegionConfig.regions, keysToExclude);
                ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
                    let liegeTitleKey = ck3.getDeJureLiegeTitle(title.getKey())!
                    liegeTitleKey = ck3.getDeJureLiegeTitle(liegeTitleKey)!;
                    //liegeTitleKey = ck3.getDeJureLiegeTitle(liegeTitleKey)!;

                    const deFactoTopLiege = title.getUltimateLiegeTitle();
                    key2color.set(title.getKey(), deFactoTopLiege.getColor().toNumber());
                });
                const configProvider = new RendererConfigProvider(key2color);
                const forceNonInteractive = (key: string) => {
                    return keysToExclude.has(key) ? true : false;
                };
                const meshes = ThreeService.makeGeoJsonPolygons(geoJson, configProvider, () => false, forceNonInteractive);
                const clusterManager = new ClusterManager(key2ClusterKey);
                const data: SignupAssetsData = {
                    geoJsonData: geoJson,
                    ck3SaveData: ck3Save,
                    meshes: meshes,
                    configProvider: configProvider,
                    key2ClusterKey: key2ClusterKey,
                    clusterManager: clusterManager,
                    ck3: ck3,
                };
                this._dataSubject.next(data);
                this._loadingSubject.next(false);
                return data;
            })
        );
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

    private static buildKey2Cluster(ck3: CK3, ck3Save: Ck3Save, regions: { name: string, plusElements: Set<string>, minusElements: Set<string>, baseElements: Set<string> }[], key2Exclude: Set<string>) {
        const key2ClusterKey = new Map<string, string>();
        ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
            /*let liegeTitleKey = ck3.getDeJureLiegeTitle(title.getKey())!
            liegeTitleKey = ck3.getDeJureLiegeTitle(liegeTitleKey)!;
            liegeTitleKey = ck3.getDeJureLiegeTitle(liegeTitleKey)!;
            const liegeTitle = ck3Save.getTitle(liegeTitleKey);
            key2ClusterKey.set(title.getKey(), liegeTitle.getKey());*/
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
        const regions: { name: string, plusElements: Set<string>, minusElements: Set<string>, baseElements: Set<string> }[] = [];
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

            regions.push({ name: regionName, plusElements, minusElements, baseElements });
        }
        return { regions: regions, topLevelKeysToInclude: keysToExclude }
    }

    isDataReady(): boolean {
        const data = this._dataSubject.value;
        return data !== null && data.geoJsonData && data.ck3SaveData && data.meshes && data.configProvider;
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