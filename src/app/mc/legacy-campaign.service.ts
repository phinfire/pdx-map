import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of, catchError, shareReplay } from 'rxjs';
import { MegaCampaign } from './MegaCampaign';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';

@Injectable({
    providedIn: 'root'
})
export class LegacyCampaignService {
    private readonly legacyCampaignsEndpoint = `${DiscordAuthenticationService.getApiUrl()}/megacampaigns`;
    private http = inject(HttpClient);

    private legacyCampaigns$?: Observable<MegaCampaign[]>;

    getLegacyCampaigns$(): Observable<MegaCampaign[]> {
        if (!this.legacyCampaigns$) {
            this.legacyCampaigns$ = this.http.get<any[]>(this.legacyCampaignsEndpoint).pipe(
                catchError(() => of([])),
                map(campaigns => this.transformLegacyCampaigns(campaigns)),
                shareReplay(1)
            );
        }
        return this.legacyCampaigns$;
    }

    invalidateCache(): void {
        this.legacyCampaigns$ = undefined;
    }

    private transformLegacyCampaigns(campaigns: any[]): MegaCampaign[] {
        return campaigns
            .filter(c =>
                c &&
                c.name &&
                c.regionDeadlineDate &&
                c.startDeadlineDate &&
                c.firstSessionDate
            )
            .map(c =>
                new MegaCampaign(
                    c.name,
                    new Date(c.regionDeadlineDate),
                    new Date(c.startDeadlineDate),
                    new Date(c.firstSessionDate),
                    c.firstEu4Session ? new Date(c.firstEu4Session) : null,
                    undefined,
                    c.ck3MapGeoJsonUrl || '',
                    c.nationsJsonUrl || 'https://codingafterdark.de/mc/ideas/flags/nations.json',
                    c.signupsOpen || false,
                    c.moderatorIds || [],
                    c.ck3LobbiesIdentifiers || [],
                    c.eu4LobbiesIdentifiers || [],
                    c.vic3LobbyIdentifiers || [],
                    c.possibleKeys || []
                )
            );
    }
}
