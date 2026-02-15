import { inject, Injectable } from '@angular/core';
import { map, Observable, of, catchError, from, shareReplay, Subject, forkJoin } from 'rxjs';
import { MegaCampaign } from './MegaCampaign';
import { HttpClient } from '@angular/common/http';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';
import { PdxFileService } from '../../services/pdx-file.service';
import { Eu4Save } from '../../model/games/eu4/Eu4Save';
import { LegacyCampaignService } from './legacy-campaign.service';

@Injectable({
    providedIn: 'root'
})
export class MegaService {
    private readonly campaignsEndpoint = `http://localhost:8085`;

    private pdxFileService = inject(PdxFileService);
    private authService = inject(DiscordAuthenticationService);
    private legacyCampaignService = inject(LegacyCampaignService);

    private lastEu4Save$: Observable<Eu4Save>;

    private campaignsCacheInvalidated$ = new Subject<void>();
    private combinedCampaigns$?: Observable<MegaCampaign[]>;

    constructor(private http: HttpClient) {
        const eu4SaveURL = "https://codingafterdark.de/pdx-map-gamedata/Convert2_local.eu4";
        this.lastEu4Save$ = from(this.pdxFileService.loadEu4SaveFromUrl(eu4SaveURL));
    }

    private nations$?: Observable<any[]>;

    getNations$(): Observable<any[]> {
        if (!this.nations$) {
            const url = "https://codingafterdark.de/mc/ideas/flags/nations.json?" + Date.now();
            this.nations$ = from(fetch(url).then(r => r.json())).pipe(
                shareReplay(1)
            );
        }
        return this.nations$;
    }

    getNationNameMap$(): Observable<Map<string, string>> {
        return this.getNations$().pipe(
            map((arr: any[]) => {
                const m = new Map<string, string>();
                for (const n of arr || []) {
                    if (n && n.key && n.name) {
                        m.set(n.key, n.name);
                    }
                }
                return m;
            }),
            shareReplay(1)
        );
    }

    getAvailableCampaigns$(): Observable<MegaCampaign[]> {
        if (!this.combinedCampaigns$) {
            this.combinedCampaigns$ = forkJoin({
                legacy: this.legacyCampaignService.getLegacyCampaigns$(),
                new: this.http.get<any[]>(`${this.campaignsEndpoint}/campaigns`).pipe(
                    catchError(() => of([]))
                )
            }).pipe(
                map(({ legacy, new: newCampaigns }) => {
                    const newTransformed = newCampaigns
                        .map(c => this.transformNewApiCampaign(c))
                        .filter((c): c is MegaCampaign => c !== null);

                    const campaignMap = new Map<string, MegaCampaign>();

                    legacy.forEach((c: MegaCampaign) => {
                        campaignMap.set(c.getName(), c);
                    });

                    newTransformed.forEach(c => {
                        campaignMap.set(c.getName(), c);
                    });

                    return Array.from(campaignMap.values());
                }),
                shareReplay(1)
            );
        }
        return this.combinedCampaigns$;
    }

    private transformNewApiCampaign(campaign: any): MegaCampaign | null {
        try {
            if (!campaign || !campaign.name) {
                return null;
            }
            const regionDeadlineDate = campaign.signupDeadlineDate ? new Date(campaign.signupDeadlineDate) : new Date(0);
            const startDeadlineDate = campaign.pickDeadline ? new Date(campaign.pickDeadline) : new Date(0);
            const firstSessionDate = campaign.firstSessionDate ? new Date(campaign.firstSessionDate) : new Date(0);

            const result = new MegaCampaign(
                campaign.name,
                regionDeadlineDate,
                startDeadlineDate,
                firstSessionDate,
                campaign.firstEu4SessionDate ? new Date(campaign.firstEu4SessionDate) : null,
                campaign.id,
                campaign.signupsOpen || false,
                campaign.ck3MapGeoJsonUrl || '',
                campaign.ck3RegionsConfigUrl || '',
                campaign.nationsJsonUrl,
                campaign.moderatorIds || [],
                campaign.ck3LobbiesIdentifiers || [],
                campaign.eu4LobbiesIdentifiers || [],
                campaign.vic3LobbyIdentifiers || [],
                campaign.possibleKeys || []
            );
            return result;
        } catch (error) {
            console.error('Error transforming campaign:', error);
            return null;
        }
    }

    private invalidateCampaignsCache(): void {
        this.combinedCampaigns$ = undefined;
        this.legacyCampaignService.invalidateCache();
        this.campaignsCacheInvalidated$.next();
    }

    createCampaign$(name: string): Observable<any> {
        const headers = this.authService.getAuthenticationHeader();
        return this.http.post<any>(`${this.campaignsEndpoint}/campaigns?name=${encodeURIComponent(name)}`, {}, { headers }).pipe(
            map(result => {
                this.invalidateCampaignsCache();
                return result;
            })
        );
    }

    updateCampaign$(id: number, updates: any): Observable<any> {
        const headers = this.authService.getAuthenticationHeader();
        return this.http.patch<any>(`${this.campaignsEndpoint}/campaigns/${id}`, updates, { headers }).pipe(
            map(result => {
                this.invalidateCampaignsCache();
                return result;
            })
        );
    }

    updateCampaignDates$(id: number, updates: { signupDeadlineDate?: Date; pickDeadline?: Date; firstSessionDate?: Date; firstEu4SessionDate?: Date }): Observable<any> {
        const isoUpdates: any = {};
        if (updates.signupDeadlineDate) {
            isoUpdates.signupDeadlineDate = updates.signupDeadlineDate.toISOString();
        }
        if (updates.pickDeadline) {
            isoUpdates.pickDeadline = updates.pickDeadline.toISOString();
        }
        if (updates.firstSessionDate) {
            isoUpdates.firstSessionDate = updates.firstSessionDate.toISOString();
        }
        if (updates.firstEu4SessionDate) {
            isoUpdates.firstEu4SessionDate = updates.firstEu4SessionDate.toISOString();
        }
        return this.updateCampaign$(id, isoUpdates);
    }

    deleteCampaign$(id: number): Observable<any> {
        const headers = this.authService.getAuthenticationHeader();
        return this.http.delete<any>(`${this.campaignsEndpoint}/campaigns/${id}`, { headers }).pipe(
            map(result => {
                this.invalidateCampaignsCache();
                return result;
            })
        );
    }

    getLastEu4Save() {
        return this.lastEu4Save$;
    }

    getFlagUrl(nationKey: string): string {
        return `https://codingafterdark.de/mc/ideas/flags/${nationKey}.webp`;
    }
}