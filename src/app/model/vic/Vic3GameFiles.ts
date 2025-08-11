import { HttpClient } from "@angular/common/http";
import { Good } from "./game/Good";
import { PdxFileService } from "../../services/pdx-file.service";
import { Injectable } from "@angular/core";
import { GoodCategory } from "./enum/GoodCategory";
import { switchMap, from, mergeMap, Observable, shareReplay } from "rxjs";

@Injectable({ providedIn: 'root' })
export class Vic3GameFiles {
    private readonly goods$: Observable<Good[]>;

    constructor(private http: HttpClient, private fileService: PdxFileService) {
        const dataUrl = "https://codingafterdark.de/pdx/vic3gamedata/00_goods.txt";
        this.goods$ = this.http.get(dataUrl, { responseType: 'text' }).pipe(
            mergeMap(data => from(this.parseGoodsList(data))),
            shareReplay(1)
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

    getGoods(): Observable<Good[]> {
        return this.goods$;
    }
}