import { Injectable } from '@angular/core';
import { Jomini } from 'jomini';
import JSZip from 'jszip';
import { forkJoin, from, Observable } from 'rxjs';
import { catchError, map, switchMap, shareReplay } from 'rxjs/operators';
import { CK3 } from '../../model/ck3/CK3';
import { Trait } from '../../model/ck3/Trait';
import { RGB } from '../../util/RGB';

@Injectable({
    providedIn: 'root'
})
export class CK3Service {
    private readonly jomini$ = from(Jomini.initialize()).pipe(shareReplay(1));

    private ck3$: Observable<CK3> | null = null;

    private fetchText(url: string): Observable<string> {
        return from(fetch(url).then(res => res.text()));
    }

    private fetchAndParse<T>(url: string, parser: any, parseFn: (data: string) => T): Observable<T> {
        return this.fetchText(url).pipe(
            map(data => parseFn(data)),
            catchError(error => {
                console.error(`Failed to fetch or parse ${url}`, error);
                throw error;
            })
        );
    }

    private parseLocalisations(localisationMaps: [Map<string, string>, Map<string, string>]): Map<string, string> {
        const locs = new Map<string, string>();
        localisationMaps.forEach(map => {
            map.forEach((value, key) => locs.set(key, value));
        });
        return locs;
    }

    private parseTraits(data: string, parser: any): Trait[] {
        const traits: Trait[] = [];
        const parsed = parser.parseText(data);
        let i = 0;
        for (const key of Object.keys(parsed)) {
            if (!key.startsWith("@")) {
                traits.push(new Trait(key, parsed[key], i++));
            }
        }
        return traits;
    }

    private parseLandedTitles(data: string, parser: any): {
        titleKey2Color: Map<string, RGB>,
        county2Baronies: Map<string, string[]>,
        barony2provinceIndices: Map<string, number>
    } {
        const parsed = parser.parseText(data);
        const titleKey2Color = new Map<string, RGB>();
        const county2Baronies = new Map<string, string[]>();
        const barony2provinceIndices = new Map<string, number>();

        for (const key of Object.keys(parsed)) {
            CK3.recursivelyInsertBaronyIndices(
                parsed[key],
                key,
                titleKey2Color,
                county2Baronies,
                barony2provinceIndices
            );
        }

        return { titleKey2Color, county2Baronies, barony2provinceIndices };
    }

    private parseBuildings(zipBlob: Blob, parser: any): Observable<Map<string, any>> {
        const zip = new JSZip();
        return from(zip.loadAsync(zipBlob)).pipe(
            switchMap(zip => {
                const fileEntries = Object.keys(zip.files);
                const buildingKey2Data = new Map<string, any>();

                return forkJoin(
                    fileEntries.map(filename =>
                        zip.file(filename)
                            ? from(zip.file(filename)!.async("string")).pipe(
                                map(data => {
                                    const parsed = parser.parseText(data);
                                    for (const key of Object.keys(parsed)) {
                                        if (!key.startsWith("@")) {
                                            buildingKey2Data.set(key, parsed[key]);
                                        }
                                    }
                                })
                            )
                            : from(Promise.resolve()).pipe(map(() => { }))
                    )
                ).pipe(map(() => buildingKey2Data));
            })
        );
    }

    initializeCK3(): Observable<CK3> {
        if (!this.ck3$) {
            this.ck3$ = this.jomini$.pipe(
                switchMap(parser =>
                    forkJoin({
                        localisationMaps: forkJoin([
                            from(CK3.fetchAndInsertLocalisationMapping("traits_l_english.yml")),
                            from(CK3.fetchAndInsertLocalisationMapping("titles_l_english.yml"))
                        ]),
                        traits: this.fetchAndParse(
                            CK3.CK3_DATA_URL + "/common/traits/00_traits.txt",
                            parser,
                            d => this.parseTraits(d, parser)
                        ),
                        landedTitles: this.fetchAndParse(
                            CK3.CK3_DATA_URL + "/common/landed_titles/00_landed_titles.txt",
                            parser,
                            d => this.parseLandedTitles(d, parser)
                        ),
                        scriptedValues: this.fetchText(
                            CK3.CK3_DATA_URL + "/common/scripted_values/00_building_values.txt"
                        ).pipe(map(data => parser.parseText(data))),
                        buildings: from(fetch(CK3.CK3_DATA_URL + "/common/buildings.zip").then(r => r.blob())).pipe(
                            switchMap(blob => this.parseBuildings(blob, parser))
                        )
                    })
                ),
                map(({ localisationMaps, traits, landedTitles }) => {
                    const locs = this.parseLocalisations(localisationMaps);
                    return new CK3(
                        locs,
                        traits,
                        landedTitles.county2Baronies,
                        landedTitles.barony2provinceIndices,
                        landedTitles.titleKey2Color
                    );
                }),
                shareReplay(1)
            );
        }

        return this.ck3$;
    }
}
