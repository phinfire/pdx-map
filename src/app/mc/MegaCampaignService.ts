import { inject, Injectable } from "@angular/core";
import { DiscordAuthenticationService } from "../../services/discord-auth.service";
import { HttpClient } from "@angular/common/http";
import { Subject, of } from "rxjs";
import { map, catchError, switchMap, startWith, tap, shareReplay} from "rxjs/operators";
import { MegaCampaign } from "./MegaCampaign";

@Injectable({
    providedIn: 'root'
})
export class MegaCampaignService {

    private readonly API_URL = "https://codingafterdark.de/megacampaign"

    private discordAuthService = inject(DiscordAuthenticationService);
    private http = inject(HttpClient);

    private campaignsRefresh$ = new Subject<void>();

    getCampaigns$() {
        return this.campaignsRefresh$.pipe(
            startWith(undefined),
            switchMap(() => this.http.get<any[]>(this.API_URL + "/megacampaigns").pipe(
                map(campaigns =>
                    campaigns
                        .filter(c =>
                            c &&
                            c.name &&
                            c.signupDeadlineDate &&
                            c.pickDeadline &&
                            c.firstSessionDate &&
                            c.id
                        )
                        .map(c =>
                            new MegaCampaign(
                                c.name,
                                this.utcToLocalDate(c.signupDeadlineDate),
                                this.utcToLocalDate(c.pickDeadline),
                                this.utcToLocalDate(c.firstSessionDate),
                                c.firstEu4SessionDate ? this.utcToLocalDate(c.firstEu4SessionDate) : null,
                                c.id,
                                c.signupsOpen ?? false,
                                c.ck3MapGeoJsonUrl ?? '',
                                c.ck3RegionsConfigUrl ?? '',
                                c.nationsJsonUrl ?? 'https://codingafterdark.de/mc/ideas/flags/nations.json',
                                c.moderatorIds ?? [],
                                c.ck3LobbiesIdentifiers ?? [],
                                c.eu4LobbiesIdentifiers ?? [],
                                c.vic3LobbyIdentifiers ?? [],
                                c.possibleKeys ?? []
                            )
                        ),
                    shareReplay({ bufferSize: 1, refCount: true })
                ), catchError(() => {
                    console.warn(
                        'MegaCampaignService: Failed to fetch campaigns from backend, returning empty list'
                    );
                    return of([]);
                })
            )
            ));
    }

    createNewCampaign(campaign: MegaCampaign) {
        return this.http.post(this.API_URL + "/megacampaigns", {
            name: campaign.getName(),
            signupDeadlineDate: campaign.getRegionDeadlineDate(),
            pickDeadline: campaign.getStartDeadlineDate(),
            firstSessionDate: campaign.getFirstSessionDate(),
        }).pipe(
            tap(() => this.campaignsRefresh$.next())
        );
    }

    private utcToLocalDate(dateString: string | Date): Date {
        const date = new Date(dateString);
        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return localDate;
    }

}