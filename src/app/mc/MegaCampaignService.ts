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

    private readonly API_URL = "http://localhost:8085"

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
                            c.regionDeadlineDate &&
                            c.startDeadlineDate &&
                            c.firstSessionDate
                        )
                        .map(c =>
                            new MegaCampaign(
                                c.name,
                                this.utcToLocalDate(c.regionDeadlineDate),
                                this.utcToLocalDate(c.startDeadlineDate),
                                this.utcToLocalDate(c.firstSessionDate),
                                c.firstEu4Session ? this.utcToLocalDate(c.firstEu4Session) : null,
                                c.id                // API response includes id
                            )
                        ),
                    shareReplay({ bufferSize: 1, refCount: true })
                ), catchError(() => {
                    console.warn(
                        'MegaService: Failed to fetch campaigns from backend, returning empty list'
                    );
                    return of([]);
                })
            )
            ));
    }

    createNewCampaign(campaign: MegaCampaign) {
        return this.http.post(this.API_URL + "/megacampaigns", {
            name: campaign.getName(),
            regionDeadlineDate: campaign.getRegionDeadlineDate(),
            startDeadlineDate: campaign.getStartDeadlineDate(),
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