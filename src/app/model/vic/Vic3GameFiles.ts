import { HttpClient } from "@angular/common/http";
import { Good } from "./game/Good";
import { PdxFileService } from "../../services/pdx-file.service";
import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class Vic3GameFiles {

    private goods: Good[] = [];

    private constructor(private http: HttpClient, private fileService: PdxFileService) {
                const dataUrl = "https://codingafterdark.de/pdx/vic3gamedata/"
        this.http.get(dataUrl + "00_goods.txt", { responseType: 'text' }).subscribe((data) => {
            fileService.importFile([new File([data], "00_goods.txt")], (name, json) => {
                /*
                let i = 0;
                for (const key in json) {
                    this.index2GoodKey.set(i, key);
                    const category = json[key]["category"];
                    this.goodKey2Category.set(key, category);
                    this.locLookup.set(key, key.charAt(0).toUpperCase() + key.slice(1));
                    i++;
                }
                this.refreshGoodColumnList();
                */
               for (const key in json) {
                    const good = new Good(key, json[key].index, json[key].category, json[key].locKey);
                    this.goods.push(good);
                }
            })
        });
    }

    public getGoodKey2Category(): Map<string, string> {
        const goodKey2Category = new Map<string, string>();
        for (const good of this.goods) {
            goodKey2Category.set(good.name, good.category);
        }
        return goodKey2Category;
    }

    public getGoods(): Good[] {
        return this.goods;
    }
}