import { inject, Injectable } from "@angular/core";
import { from, map, mergeMap, Observable, shareReplay } from "rxjs";
import { PdxFileService } from "../../../services/pdx-file.service";
import { HttpClient } from "@angular/common/http";
import { Eu4SaveProvince } from "../../../model/eu4/Eu4SaveProvince";

@Injectable({
    providedIn: 'root',
})
export class MegaModderE2VService {

    private readonly eu2vicProvinceMapping$: Observable<{ eu4: string[], vic3: string[] }[]>;

    private http = inject(HttpClient);
    private fileService = inject(PdxFileService);

    constructor() {
        this.eu2vicProvinceMapping$ = this.http.get("http://localhost:5500/public/province_mappings.txt", { responseType: 'text' }).pipe(
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
                console.log('Reconstructed provinces:', reconProvince.size, 'out of', provinces.size);
                console.log('Reconstructed tags:', reconTags.size, 'out of', mappingVotes.size);
                return eu4ToVic3TagMapping;
            })
        );
    }
}