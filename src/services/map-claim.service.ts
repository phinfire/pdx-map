import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DiscordAuthenticationService } from './discord-auth.service';
import { BackendConfigService } from './megacampaign/backend-config.service';
import { MapClaimSession } from '../model/megacampaign/MapClaimSession';
import { Observable } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class MapClaimService {

    private http = inject(HttpClient);
    private authService = inject(DiscordAuthenticationService);    
    private backendConfig = inject(BackendConfigService);

    private getHeaders(): HttpHeaders {
        return new HttpHeaders({
            'Content-Type': 'application/json',
            ...this.authService.getAuthenticationHeader()
        });
    }

    private getBaseUrl(): string {
        return `${this.backendConfig.getMapClaimApiUrl()}/mapclaims`;
    }

    getAvailableSessions$(): Observable<MapClaimSession[]> {
        return this.http.get<MapClaimSession[]>(this.getBaseUrl(), {
            headers: this.getHeaders()
        });
    }

    getSession$(sessionId: string | number): Observable<MapClaimSession> {
        return this.http.get<MapClaimSession>(`${this.getBaseUrl()}/${sessionId}`, {
            headers: this.getHeaders()
        });
    }

    postSession$(session: MapClaimSession): Observable<MapClaimSession> {
        return this.http.post<MapClaimSession>(this.getBaseUrl(), session, {
            headers: this.getHeaders()
        });
    }

    putSession$(sessionId: string | number, session: MapClaimSession): Observable<MapClaimSession> {
        return this.http.put<MapClaimSession>(`${this.getBaseUrl()}/${sessionId}`, session, {
            headers: this.getHeaders()
        });
    }

    deleteSession$(sessionId: string | number): Observable<void> {
        return this.http.delete<void>(`${this.getBaseUrl()}/${sessionId}`, {
            headers: this.getHeaders()
        });
    }

    createSession$(session: MapClaimSession): Observable<MapClaimSession> {
        // Create session with isPublic = false by default
        const newSession = new MapClaimSession(
            null,
            session.creatorId,
            session.name,
            session.game,
            session.countries,
            session.ownership,
            false
        );
        return this.postSession$(newSession);
    }
}
