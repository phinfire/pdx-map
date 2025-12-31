import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class MapService {

    private readonly eu4GeoJsonUrl = "https://codingafterdark.de/pdx/data/eu4_provinces.geojson";
    private readonly ck3GeoJsonUrl = "https://codingafterdark.de/pdx/data/counties.geojson"
    private readonly vic3GeoJsonUrl = "https://codingafterdark.de/pdx-map-gamedata/states.geojson";

    constructor(private http: HttpClient) {
        
    }

    fetchEU4GeoJson(removeWater: boolean, removeWastelands: boolean): Observable<any> {
        return this.http.get(this.eu4GeoJsonUrl).pipe(
            map((geojson: any) => this.filterGeoJsonFeatures(geojson, removeWater, removeWastelands, ['sea'], ['wasteland'])),
            shareReplay(1)
        );
    }

    fetchCK3GeoJson(removeWater: boolean, removeWastelands: boolean): Observable<any> {
        return this.http.get(this.ck3GeoJsonUrl).pipe(
            map((geojson: any) => this.filterGeoJsonFeatures(geojson, removeWater, removeWastelands, ['sea', 'river'], ['wasteland'])),
            shareReplay(1)
        );
    }

    fetchVic3GeoJson(removeWastelands: boolean): Observable<any> {
        return this.http.get(this.vic3GeoJsonUrl).pipe(
            shareReplay(1)
        );
    }

    private filterGeoJsonFeatures(
        geojson: any,
        removeWater: boolean,
        removeWastelands: boolean,
        waterTypes: string[],
        wastelandTypes: string[]
    ): any {
        if (!geojson || !geojson.features) return geojson;
        geojson.features = geojson.features.filter((feature: any) => {
            const type = feature.properties?.type;
            const isWater = waterTypes.includes(type);
            const isWasteland = wastelandTypes.includes(type);
            return (!removeWater || !isWater) && (!removeWastelands || !isWasteland);
        });
        return geojson;
    }
}