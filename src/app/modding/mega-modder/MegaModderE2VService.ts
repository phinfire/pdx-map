import { inject, Injectable } from "@angular/core";
import { BehaviorSubject, from, map, mergeMap, Observable, shareReplay, combineLatest } from "rxjs";
import { PdxFileService } from "../../../services/pdx-file.service";
import { HttpClient } from "@angular/common/http";
import { Eu4SaveProvince } from "../../../model/eu4/Eu4SaveProvince";
import { MapStateRegion } from "../../../model/vic/game/MapStateRegion";

export interface MappingTableRow {
    eu4Tag: string;
    eu4Name: string;
    vic3Tag: string;
    vic3Name: string;
    eu4Dev: number;
    vic3Pop: number;
    adjustedVic3Pop: number;
    scalingFactor: number;
    initialArableLand: number;
    scaledArableLand: number;
    subjects?: MappingTableRow[];
    vic3Subjects: string[];
}

interface HistoryStateRegion {
    stateKey: string;
    ownerCountryTag: string;
    tiles: string[];
    is_incorporated: boolean;
    homeland?: string;
}

@Injectable({
    providedIn: 'root',
})
export class MegaModderE2VService {

    private readonly eu2vicProvinceMapping$: Observable<{ eu4: string[], vic3: string[] }[]>;
    private readonly eu4ToVic3MappingSubject = new BehaviorSubject<Map<string, string>>(new Map());
    public readonly eu4ToVic3Mapping$ = this.eu4ToVic3MappingSubject.asObservable();
    private readonly scaledPopsByTagSubject = new BehaviorSubject<Map<string, number>>(new Map());
    public readonly scaledPopsByTag$ = this.scaledPopsByTagSubject.asObservable();
    private readonly scaledArableLandByTagSubject = new BehaviorSubject<Map<string, number>>(new Map());
    public readonly scaledArableLandByTag$ = this.scaledArableLandByTagSubject.asObservable();

    public readonly eu4PlayerTagToPopulation$ = combineLatest([
        this.eu4ToVic3Mapping$,
        this.scaledPopsByTag$
    ]).pipe(
        map(([eu4ToVic3, vic3Populations]) => {
            const playerTagPopulation = new Map<string, number>();
            for (const [eu4Tag, vic3Tag] of eu4ToVic3.entries()) {
                const population = vic3Populations.get(vic3Tag) || 0;
                playerTagPopulation.set(eu4Tag, population);
            }
            return playerTagPopulation;
        }),
        shareReplay(1)
    );

    private http = inject(HttpClient);
    private fileService = inject(PdxFileService);

    constructor() {
        this.eu2vicProvinceMapping$ = this.http.get("https://codingafterdark.de/pdx-map-gamedata/converter/province_mappings.txt", { responseType: 'text' }).pipe(
            mergeMap(data => from(this.fileService.importFilePromise(new File([data], "province_mappings.txt")))),
            map(value => {
                const mapping = value.json["1.37.0"].link;
                const filtered = mapping.filter((entry: any) => entry.eu4 !== undefined && entry.vic3 !== undefined).map((entry: any) => {
                    return {
                        eu4: typeof entry.eu4 === 'number' ? [entry.eu4.toString()] : entry.eu4.map((id: number) => id.toString()),
                        vic3: typeof entry.vic3 === 'string' ? [entry.vic3] : entry.vic3,
                    };
                });
                return filtered;
            }),
            shareReplay(1)
        );
    }

    getDevelopmentToPopTransformation(): (dev: number) => number {
        return dev => {
            if (dev < 1000) {
                return (15 / 1000) * dev;
            } else {
                return 15 * (1 + Math.log(dev / 1000));
            }
        }
    }

    getProvinceMapping(): Observable<{ eu4: string[], vic3: string[] }[]> {
        return this.eu2vicProvinceMapping$
    }

    guessTagMapping(provinces: Map<string, Eu4SaveProvince>, vic3OwnershipMap: Map<string, string>): Observable<Map<string, string>> {
        return this.eu2vicProvinceMapping$.pipe(
            map(mappings => {
                const reconProvince = new Set<string>();
                const reconTags = new Set<string>();
                const mappingVotes = new Map<string, Map<string, number>>();
                mappings.forEach((entry: any) => {
                    const eu4Provinces = entry.eu4
                        .map((id: string) => provinces.get(id))
                        .filter((prov: Eu4SaveProvince | undefined) => prov !== undefined) as Eu4SaveProvince[];
                    eu4Provinces.forEach(prov => reconProvince.add(prov.getId()));
                    eu4Provinces.forEach(prov => reconTags.add(prov.getOwner()!.getTag()));
                    const eu4Owners = eu4Provinces.map(prov => prov.getOwner()!.getTag());
                    const vic3Owners = entry.vic3
                        .map((id: string) => vic3OwnershipMap.get(id))
                        .filter((tag: string | undefined) => tag !== undefined) as string[];
                    for (const eu4Tag of eu4Owners) {
                        for (const vic3Tag of vic3Owners) {
                            if (!mappingVotes.has(eu4Tag)) {
                                mappingVotes.set(eu4Tag, new Map<string, number>());
                            }
                            const vic3VoteMap = mappingVotes.get(eu4Tag)!;
                            vic3VoteMap.set(vic3Tag, (vic3VoteMap.get(vic3Tag) ?? 0) + 1);
                        }
                    }
                });
                const eu4ToVic3TagMapping = new Map<string, string>();
                for (const [eu4Tag, vic3VoteMap] of mappingVotes.entries()) {
                    let maxVotes = 0;
                    let bestVic3Tag: string | null = null;
                    for (const [vic3Tag, votes] of vic3VoteMap.entries()) {
                        if (votes > maxVotes) {
                            maxVotes = votes;
                            bestVic3Tag = vic3Tag;
                        }
                    }
                    if (bestVic3Tag) {
                        eu4ToVic3TagMapping.set(eu4Tag, bestVic3Tag);
                    }
                }
                return eu4ToVic3TagMapping;
            })
        );
    }

    refineTagMapping(mapping: Map<string, string>,
        eu4DevLookup: (tag: string) => number,
        eu4VassalLookup: (tag: string) => string[],
        vic3VassalLookup: (tag: string) => string[]
    ): Map<string, string> {
        const refined = new Map<string, string>();
        const conflictingMappings = this.getConflictingMappings(mapping);
        for (const [eu4Tag, vic3Tag] of mapping.entries()) {
            if (!conflictingMappings.has(vic3Tag)) {
                refined.set(eu4Tag, vic3Tag);
            }
        }

        // Case: A is a vassal of B, both have been mapped to vic(B). vic(A) is unassigned.
        for (const [vic3Tag, eu4Tags] of conflictingMappings.entries()) {
            if (eu4Tags.length === 2) {
                console.log(`Refining mapping for VIC3 tag ${vic3Tag} with EU4 tags ${eu4Tags.join(", ")}`);
                const tagOfPotentialOverlord = eu4DevLookup(eu4Tags[0]) > eu4DevLookup(eu4Tags[1]) ? eu4Tags[0] : eu4Tags[1];
                const tagOfPotentialSubject = eu4DevLookup(eu4Tags[0]) > eu4DevLookup(eu4Tags[1]) ? eu4Tags[1] : eu4Tags[0];
                const eu4OverlordVassals = eu4VassalLookup(tagOfPotentialOverlord);
                const vic3Vassals = vic3VassalLookup(vic3Tag);
                if (eu4OverlordVassals.includes(tagOfPotentialSubject)) {
                    const unmatchedVassals = vic3Vassals.filter(vic3VassalTag => {
                        return !Array.from(refined.values()).includes(vic3VassalTag);
                    });
                    if (unmatchedVassals.length === 1) {
                        refined.set(tagOfPotentialSubject, unmatchedVassals[0]);
                        continue;
                    }
                    if (unmatchedVassals.length === 0) {
                        refined.set(tagOfPotentialOverlord, vic3Tag);
                        continue;
                    }
                }
            }
            for (const eu4Tag of eu4Tags) {
                refined.set(eu4Tag, vic3Tag);
            }
        }
        return refined;
    }


    private getConflictingMappings(mapping: Map<string, string>): Map<string, string[]> {
        const vic3TagCounts = new Map<string, string[]>();
        for (const [eu4Tag, vic3Tag] of mapping.entries()) {
            if (!vic3TagCounts.has(vic3Tag)) {
                vic3TagCounts.set(vic3Tag, []);
            }
            vic3TagCounts.get(vic3Tag)!.push(eu4Tag);
        }
        const conflictingMappings = new Map<string, string[]>();
        for (const [vic3Tag, eu4Tags] of vic3TagCounts.entries()) {
            if (eu4Tags.length > 1) {
                conflictingMappings.set(vic3Tag, eu4Tags);
            }
        }

        return conflictingMappings;
    }

    private buildTileOwnershipMap(historyRegions: HistoryStateRegion[]): Map<string, string> {
        const tileOwnerMap = new Map<string, string>();
        for (const region of historyRegions) {
            for (const tile of region.tiles) {
                tileOwnerMap.set(tile, region.ownerCountryTag);
            }
        }
        return tileOwnerMap;
    }

    getInitialArableLandByCountry(
        historyRegions: HistoryStateRegion[],
        mapStateRegions: MapStateRegion[]
    ): Map<string, number> {
        const tileOwnerMap = this.buildTileOwnershipMap(historyRegions);
        const arableLandByCountry = new Map<string, number>();
        for (const mapState of mapStateRegions) {
            const tiles = Array.from(mapState.getTiles());

            if (tiles.length === 0 || mapState.getArableLand() === 0) {
                continue;
            }

            const tilesByOwner = new Map<string, string[]>();
            for (const tile of tiles) {
                const owner = tileOwnerMap.get(tile) || '';
                if (!tilesByOwner.has(owner)) {
                    tilesByOwner.set(owner, []);
                }
                tilesByOwner.get(owner)!.push(tile);
            }

            const arableLandPerTile = mapState.getArableLand() / tiles.length;

            for (const [owner, ownerTiles] of tilesByOwner.entries()) {
                if (!owner) continue;

                const countryArableLand = arableLandPerTile * ownerTiles.length;
                const currentTotal = arableLandByCountry.get(owner) ?? 0;
                arableLandByCountry.set(owner, currentTotal + countryArableLand);
            }
        }

        return arableLandByCountry;
    }

    scaleArableLandByCountry(
        historyRegions: HistoryStateRegion[],
        mapStateRegions: MapStateRegion[],
        scalingFactors: Map<string, number>
    ): MapStateRegion[] {
        const tileOwnerMap = this.buildTileOwnershipMap(historyRegions);
        const scaledRegionsByName = new Map<string, { region: MapStateRegion; arableLand: number }>();

        for (const mapState of mapStateRegions) {
            const stateKey = mapState.getIdentifier();
            const tiles = Array.from(mapState.getTiles());

            if (tiles.length === 0 || mapState.getArableLand() === 0) {
                continue;
            }

            const tilesByOwner = new Map<string, string[]>();
            for (const tile of tiles) {
                const owner = tileOwnerMap.get(tile) || '';
                if (!tilesByOwner.has(owner)) {
                    tilesByOwner.set(owner, []);
                }
                tilesByOwner.get(owner)!.push(tile);
            }

            const arableLandPerTile = mapState.getArableLand() / tiles.length;
            let totalScaledArableLand = 0;

            for (const [owner, ownerTiles] of tilesByOwner.entries()) {
                if (!owner) continue;

                const countryArableLand = arableLandPerTile * ownerTiles.length;
                const rawScaleFactor = scalingFactors.get(owner) ?? 1;
                totalScaledArableLand += countryArableLand * Math.max(rawScaleFactor, 1);
            }

            // Aggregate by state name - if same state appears multiple times, combine arable land
            if (scaledRegionsByName.has(stateKey)) {
                const existing = scaledRegionsByName.get(stateKey)!;
                existing.arableLand += totalScaledArableLand;
            } else {
                scaledRegionsByName.set(stateKey, { region: mapState, arableLand: totalScaledArableLand });
            }
        }

        // Create final regions with aggregated arable land
        const scaledRegions: MapStateRegion[] = [];
        for (const [stateKey, data] of scaledRegionsByName.entries()) {
            const scaledRegion = data.region.withArableLand(data.arableLand);
            scaledRegions.push(scaledRegion);
        }

        return scaledRegions;
    }

    aggregateCountryMetrics(
        metrics: Map<string, Map<string, number>>
    ): Map<string, any> {
        const metricNames = Array.from(metrics.keys());
        const allCountries = new Set<string>();
        for (const metricMap of metrics.values()) {
            for (const tag of metricMap.keys()) {
                allCountries.add(tag);
            }
        }

        const aggregated = new Map<string, any>();

        for (const countryTag of allCountries) {
            const countryData: any = {};
            const ratios = new Map<string, number>();
            for (const metricName of metricNames) {
                const metricMap = metrics.get(metricName)!;
                countryData[metricName] = metricMap.get(countryTag) ?? 0;
            }
            for (let i = 0; i < metricNames.length; i++) {
                for (let j = i + 1; j < metricNames.length; j++) {
                    const numerator = metricNames[i];
                    const denominator = metricNames[j];
                    const numeratorValue = countryData[numerator];
                    const denominatorValue = countryData[denominator];

                    const ratio = denominatorValue > 0 ? numeratorValue / denominatorValue : 0;
                    ratios.set(`${numerator}/${denominator}`, ratio);
                }
            }

            countryData.ratios = ratios;
            aggregated.set(countryTag, countryData);
        }

        return aggregated;
    }

    updateMappingResults(
        mapping: Map<string, string>,
        scaledPops: Map<string, number>,
        scaledArableLand: Map<string, number>
    ): void {
        this.eu4ToVic3MappingSubject.next(new Map(mapping));
        this.scaledPopsByTagSubject.next(new Map(scaledPops));
        this.scaledArableLandByTagSubject.next(new Map(scaledArableLand));
    }

    private updateEu4ToVic3Mapping(mapping: Map<string, string>): void {
        this.eu4ToVic3MappingSubject.next(new Map(mapping));
    }

    private updateScaledPopsByTag(scaledPops: Map<string, number>): void {
        this.scaledPopsByTagSubject.next(new Map(scaledPops));
    }

    private updateScaledArableLandByTag(scaledArableLand: Map<string, number>): void {
        this.scaledArableLandByTagSubject.next(new Map(scaledArableLand));
    }

    clear(): void {
        this.eu4ToVic3MappingSubject.next(new Map());
        this.scaledPopsByTagSubject.next(new Map());
        this.scaledArableLandByTagSubject.next(new Map());
    }
}