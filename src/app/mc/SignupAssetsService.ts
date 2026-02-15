import * as THREE from 'three';
import { Injectable, inject } from "@angular/core";
import { Observable, forkJoin, map, shareReplay, switchMap, filter } from "rxjs";
import { CK3 } from "../../model/ck3/game/CK3";
import { AbstractLandedTitle } from "../../model/ck3/title/AbstractLandedTitle";
import { CK3Service } from "../../services/gamedata/CK3Service";
import { makeGeoJsonPolygons } from "../../util/geometry/threeGeometry";
import { MapService } from "../map.service";
import { ColorConfigProvider } from "../viewers/polygon-select/ColorConfigProvider";
import { ClusterManager } from "./mcsignup/ClusterManager";
import { MegaBrowserSessionService } from './mega-browser-session.service';
import { MegaCampaign } from './MegaCampaign';
import { RegionConfig } from '../../model/megacampaign/RegionConfig';
import { collectAllChildren, buildKey2Cluster, findCountiesOwnedByAtMostDoubleCounts, parseRegionConfig, buildColorConfigProvider } from '../../util/signup';

export interface SignupAssetsData {
    ck3SaveData: any;
    meshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[];
    configProviders: ColorConfigProvider[];
    clusterManager: ClusterManager;
}

@Injectable({
    providedIn: 'root'
})
export class SignupAssetsService {

    private mapService = inject(MapService);
    private ck3Service = inject(CK3Service);
    private megaSessionService = inject(MegaBrowserSessionService);

    private readonly selectedCampaignRegionConfig$ = this.megaSessionService.selectedMegaCampaign$.pipe(
        filter((campaign): campaign is MegaCampaign => campaign != null && campaign.getId() != null),
        switchMap(campaign => {
            const regionConfigUrl = campaign.getCk3RegionsConfigUrl();
            console.log("Loading region config from URL:", regionConfigUrl);
            return new Observable<RegionConfig>(observer => {
                fetch(regionConfigUrl)
                    .then(res => res.text())
                    .then(text => {
                        observer.next(parseRegionConfig(text));
                        observer.complete();
                    })
                    .catch(err => observer.error(err));
            });
        }),
        shareReplay(1)
    );

    readonly mapData$ = this.selectedCampaignRegionConfig$.pipe(
        switchMap(parsedRegionConfig =>
            forkJoin({
                geoJson: this.mapService.fetchCK3GeoJson(true, false),
                ck3Save: this.ck3Service.openCk3ZeroSaveFromFile(),
            }).pipe(
                map(({ geoJson, ck3Save }) => {
                    console.log("Loaded geoJson and CK3 save, processing data...");
                    const ck3 = ck3Save.getCK3();
                    const keysToExclude = collectAllChildren(ck3Save, parsedRegionConfig.topLevelKeysToInclude);
                    const key2ClusterKey = buildKey2Cluster(ck3, ck3Save, parsedRegionConfig.regions, keysToExclude);
                    const colorIn1066Provider = buildColorConfigProvider(ck3Save, ck3);
                    const forceNonInteractive = (key: string) => {
                        return keysToExclude.has(key) || !key2ClusterKey.has(key);
                    };
                    const meshes = makeGeoJsonPolygons(geoJson, colorIn1066Provider, (countyKey) => null, forceNonInteractive, 1.5);
                    const data: SignupAssetsData = {
                        ck3SaveData: ck3Save,
                        meshes: meshes,
                        configProviders: [colorIn1066Provider],
                        clusterManager: new ClusterManager(key2ClusterKey),
                    };
                    return data;
                })
            )
        ),
        shareReplay(1)
    );

    getRegionNameList$() {
        return this.selectedCampaignRegionConfig$.pipe(
            map(config => config.regions.map(region => region.name))
        );
    }

    loadRegionMapData$(regionKey: string): Observable<SignupAssetsData> {
        return forkJoin({
            geoJson: this.mapService.fetchCK3GeoJson(true, false),
            ck3Save: this.ck3Service.openCk3ZeroSaveFromFile(),
            parsedRegionConfig: this.selectedCampaignRegionConfig$
        }).pipe(
            map(({ geoJson, ck3Save, parsedRegionConfig }) => {
                const ck3 = ck3Save.getCK3();
                const keysToExclude = collectAllChildren(ck3Save, parsedRegionConfig.topLevelKeysToInclude);
                const key2ClusterKey = buildKey2Cluster(ck3, ck3Save, parsedRegionConfig.regions, keysToExclude);
                const baseClusterManager = new ClusterManager(key2ClusterKey);
                const countiesInRegion = baseClusterManager.getCluster2Keys(regionKey);

                const countyRealms = findCountiesOwnedByAtMostDoubleCounts(ck3Save, 2);
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
                const data: SignupAssetsData = {
                    ck3SaveData: ck3Save,
                    meshes: meshes,
                    configProviders: [colorProvider],
                    clusterManager: new ClusterManager(countyToRealmMap),
                };

                return data;
            }),
            shareReplay(1)
        );
    }
}