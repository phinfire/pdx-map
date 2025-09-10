import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class MapService {

    private readonly eu4GeoJsonUrl = "https://codingafterdark.de/pdx/provinces_contours.geojson";

    private readonly ck3GeoJsonUrl = "https://codingafterdark.de/pdx/counties.geojson"

    //private readonly ck3GeoJsonUrl = "http://127.0.0.1:5500/public/counties.geojson"


    constructor(private http: HttpClient) {
        
    }

    fetchEU4GeoJson(): Observable<any> {
        return this.http.get(this.eu4GeoJsonUrl).pipe(
            shareReplay(1)
        );
    }

    fetchCK3GeoJson(removeWater: boolean, removeWastelands: boolean): Observable<any> {
        return this.http.get(this.ck3GeoJsonUrl).pipe(
            map((geojson: any) => {
                if (!geojson || !geojson.features) return geojson;
                geojson.features = geojson.features.filter((feature: any) => {
                    return (!removeWater || feature.properties?.type !== 'sea' && feature.properties?.type !== 'river') &&
                        (!removeWastelands || feature.properties?.type !== 'wasteland');
                });
                return geojson;
            }),
            shareReplay(1)
        );
    }
}