import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { Observable, map, shareReplay } from "rxjs";
import { Eu4SaveDataFacade, SaveDataDump, YearSnapshot } from "../../app/lineviewer/model/Eu4SaveDataFacade";

@Injectable({
    providedIn: 'root',
})
export class SkanderbegProxyService {
    private http = inject(HttpClient);

    private readonly IDS_AND_YEARS: YearSnapshot[] = [
        { id: "4ab822", year: 1705 },
        { id: "0554a9", year: 1652 },
        { id: "572a90", year: 1613 },
        { id: "0b9b77", year: 1557 },
        { id: "76c960", year: 1504 },
        { id: "54ebd1", year: 1444 },

    ];

    getPlayerData(): Observable<Eu4SaveDataFacade>[] {
        return this.IDS_AND_YEARS.map(({ id, year }) =>
            this.http.get<SaveDataDump>(
                "https://codingafterdark.de/skanderbeg/getSaveDataDump?save=" + id
            ).pipe(
                map(dump => new Eu4SaveDataFacade(dump, year)),
                shareReplay(1)
            )
        );
    }

    getAvailableSaves(): Array<{ id: string; year: number }> {
        return this.IDS_AND_YEARS;
    }
}