import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DiscordAuthenticationService } from './discord-auth.service';
import { BackendConfigService } from './megacampaign/backend-config.service';
import { MapClaimSession, MapClaimCountryData } from '../model/megacampaign/MapClaimSession';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RGB } from '../util/RGB';

export interface MapClaimSessionHeader {
    id: number;
    name: string;
    isPublic: boolean;
    creatorId: string;
}

@Injectable({
    providedIn: 'root',
})
export class MapClaimService {

    private http = inject(HttpClient);
    private authService = inject(DiscordAuthenticationService);
    private backendConfig = inject(BackendConfigService);

    canEdit(session: MapClaimSession): Observable<boolean> {
        return this.authService.loggedInUser$.pipe(
            map(user => user ? user.id === session.creatorId : false)
        );
    }

    private getHeaders() {
        return new HttpHeaders({
            'Content-Type': 'application/json',
            ...this.authService.getAuthenticationHeader()
        });
    }

    private deserializeSession(data: any): MapClaimSession {
        const countries = new Map<string, MapClaimCountryData>();
        for (const [key, country] of Object.entries(data.countries || {})) {
            const countryData = country as any;
            countries.set(key, {
                name: countryData.name,
                color: new RGB(countryData.color.r, countryData.color.g, countryData.color.b)
            });
        }
        
        const ownership = new Map(Object.entries(data.ownership || {})) as Map<string, string>;
        
        return new MapClaimSession(
            data.id,
            data.creatorId,
            data.name,
            data.game,
            countries,
            ownership,
            data.isPublic
        );
    }

    private serializeSession(session: MapClaimSession): any {
        const countriesObj = Object.fromEntries(session.countries);
        const ownershipObj = Object.fromEntries(session.ownership);
        return {
            ...session,
            countries: countriesObj,
            ownership: ownershipObj
        };
    
    
    }

    getSessions$(): Observable<MapClaimSessionHeader[]> {
        return this.http.get<MapClaimSessionHeader[]>(`${this.backendConfig.getMapClaimApiUrl()}`, { headers: this.getHeaders() });
    }

    getSession$(sessionId: number): Observable<MapClaimSession> {
        return this.http.get<any>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}`, { headers: this.getHeaders() })
            .pipe(map(data => this.deserializeSession(data)));
    }

    createSession$(session: MapClaimSession): Observable<{ id: number }> {
        return this.http.post<{ id: number }>(`${this.backendConfig.getMapClaimApiUrl()}`, this.serializeSession(session), { headers: this.getHeaders() });
    }

    deleteSession$(sessionId: number): Observable<void> {
        return this.http.delete<void>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}`, { headers: this.getHeaders() });
    }

    setCountries$(sessionId: number, countries: Map<string, { name: string, color: RGB }>) {
        return this.http.patch<void>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}`, { countries: Object.fromEntries(countries) }, { headers: this.getHeaders() });
    }

    setIsPublic$(sessionId: number, isPublic: boolean) {
        return this.http.patch<void>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}`, { isPublic }, { headers: this.getHeaders() });
    }

    setName$(sessionId: number, name: string) {
        return this.http.patch<void>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}`, { name }, { headers: this.getHeaders() });
    }

    replaceOwnership$(sessionId: number, ownership: Map<string, string>) {
        return this.http.put<void>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}/ownership`, Object.fromEntries(ownership), { headers: this.getHeaders() });
    }

    updateOwnershipEntry$(sessionId: number, key: string, countryId: string) {
        return this.http.patch<void>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}/ownership/${key}`, { countryId }, { headers: this.getHeaders() });
    }

    deleteCountry$(sessionId: number, countryId: string) {
        return this.http.delete<void>(`${this.backendConfig.getMapClaimApiUrl()}/${sessionId}/countries/${countryId}`, { headers: this.getHeaders() });
    }
}