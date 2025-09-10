import { Injectable } from '@angular/core';
import { Jomini } from 'jomini';
import JSZip from 'jszip';
import { forkJoin, from, Observable } from 'rxjs';
import { catchError, map, switchMap, shareReplay } from 'rxjs/operators';
import { RGB } from '../../util/RGB';
import { PdxFileService } from '../pdx-file.service';
import { CK3 } from '../../model/ck3/CK3';
import { Trait } from '../../model/ck3/Trait';
import { Ck3Save } from '../../model/Ck3Save';
import { CustomRulerFile } from './CustomRulerFile';

@Injectable({
    providedIn: 'root'
})
export class CK3Service {

    private readonly baseUrl = 'assets/gamedata/ck3';

    private readonly jomini$ = from(Jomini.initialize()).pipe(shareReplay(1));

    private ck3$: Observable<CK3> | null = null;

    constructor(private paradoxFileService: PdxFileService) {

    }

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
        barony2provinceIndices: Map<string, number>,
        vassalTitle2OverlordTitle: Map<string, string>
    } {
        const parsed = parser.parseText(data);
        const titleKey2Color = new Map<string, RGB>();
        const county2Baronies = new Map<string, string[]>();
        const barony2provinceIndices = new Map<string, number>();
        const vassalTitle2OverlordTitle = new Map<string, string>();

        for (const key of Object.keys(parsed)) {
            CK3.recursivelyInsertBaronyIndices(
                parsed[key],
                key,
                titleKey2Color,
                county2Baronies,
                barony2provinceIndices,
                vassalTitle2OverlordTitle
            );
        }

        return { titleKey2Color, county2Baronies, barony2provinceIndices, vassalTitle2OverlordTitle };
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
                        landedTitles.titleKey2Color,
                        landedTitles.vassalTitle2OverlordTitle
                    );
                }),
                shareReplay(1)
            );
        }

        return this.ck3$;
    }

    openCk3SaveFromFile(fileURL: string): Observable<Ck3Save> {
        return this.initializeCK3().pipe(
            switchMap(ck3 => 
                from(fetch(fileURL)).pipe(
                    switchMap(response => from(response.blob())),
                    map(blob => new File([blob], "save.ck3")),
                    switchMap(file => from(this.paradoxFileService.importFilePromise(file))),
                    map(result => {
                        return Ck3Save.fromRawData(result.json, ck3);
                    })
                )
            ),
            catchError(error => {
                console.error("Failed to import CK3 save:", error);
                throw error;
            })
        );
    }

    openCk3ZeroSaveFromFile(): Observable<Ck3Save> {
        return this.openCk3SaveFromFile("https://codingafterdark.de/pdx/ZERO_WILLIAM.ck3").pipe(
            shareReplay(1)
        );
    }

    downloadJsonFromFileUrl(fileURL: string, filename: string = 'data.json'): Observable<void> {
        return from(fetch(fileURL)).pipe(
            switchMap(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return from(response.blob());
            }),
            switchMap(blob => from(this.paradoxFileService.importFilePromise(new File([blob], 'temp')))),
            map(result => {
                const jsonBlob = new Blob([JSON.stringify(result.json, null, 2)], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(jsonBlob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename.endsWith('.json') ? filename : `${filename}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }),
            catchError(error => {
                console.error('Failed to download JSON from file URL:', error);
                throw error;
            })
        );
    }

    parseCustomCharacter(parsedJson: any, ck3: CK3): CustomRulerFile | null {
        if (!parsedJson || !parsedJson.ruler || !parsedJson.ruler.config) {
            console.warn("Invalid custom character JSON structure:", parsedJson);
            return null;
        }
        const config = parsedJson.ruler.config;
        const culture = config.culture;
        const faith = config.faith;
        const age = config.age;

        let traitsArray: string[] = [];
        if (Array.isArray(config.traits)) {
            traitsArray = config.traits;
        } else if (typeof config.traits === 'string') {
            traitsArray = [config.traits];
        }
        let education = null;
        for (const trait of traitsArray) {
            if (typeof trait === 'string' && trait.startsWith('education_')) {
                education = trait;
                break;
            }
        }
        if (!education) {
            console.warn("No education trait found in custom character");
        }
        const traits = traitsArray.map(name => {
            const trait = ck3.getTraitByName(name);
            if (trait) {
                return trait;
            } 
            console.warn(`Trait not found: ${name}`);
            return null;
        }).filter((t): t is Trait => t !== null);
        const educationTrait = education ? ck3.getTraitByName(education) : null;
        console.log("character", parsedJson.ruler);
        console.log("name", parsedJson.ruler.name);
        return new CustomRulerFile(
            config.name,
            age,
            culture,
            faith,
            traits.filter(t => !t.getName().startsWith('education_')),
            educationTrait
        );
    }
}
