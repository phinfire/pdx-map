import { inject, Injectable } from '@angular/core';
import { map, Observable, of, catchError, from, shareReplay } from 'rxjs';
import { MegaCampaign } from './MegaCampaign';
import { CustomRulerFile } from '../../services/gamedata/CustomRulerFile';
import { Trait } from '../../model/ck3/Trait';
import { TraitType } from '../../model/ck3/enum/TraitType';
import { HttpClient } from '@angular/common/http';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';
import { PdxFileService } from '../../services/pdx-file.service';
import { Eu4Save } from '../../model/eu4/Eu4Save';

@Injectable({
    providedIn: 'root'
})
export class MegaService {
    private readonly campaignsEndpoint = `${DiscordAuthenticationService.getApiUrl()}/megacampaigns`;

    private pdxFileService = inject(PdxFileService);

    private lastEu4Save$: Observable<Eu4Save>;

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

    /**
     * Returns a cached Observable that resolves to a Map of nation key -> nation name.
     */
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
        return this.http.get<any[]>(this.campaignsEndpoint).pipe(
            map(campaigns => campaigns.map(c =>
                new MegaCampaign(
                    c.name,
                    new Date(c.regionDeadlineDate),
                    new Date(c.startDeadlineDate),
                    new Date(c.firstSessionDate),
                    c.firstEu4Session ? new Date(c.firstEu4Session) : null
                )
            )),
            catchError(() => {
                console.warn('MegaService: Failed to fetch campaigns from backend, returning empty list');
                return of([]);
            })
        );
    }

    getCurrentCampaign$(): Observable<MegaCampaign | null> {
        return this.getAvailableCampaigns$().pipe(
            map(campaigns => campaigns.length > 0
                ? campaigns.reduce((mostRecent, current) =>
                    current.getFirstSessionDate() > mostRecent.getFirstSessionDate() ? current : mostRecent)
                : null)
        );
    }

    getIllegalityReport(ruler: CustomRulerFile) {
        const negativeTraits = ruler.traits.filter(t => t.getRulerDesignerCost() < 0);
        const incompatibleTraits = this.getIncomptaibleTraits(ruler.traits);
        const illegalTraits = this.getIllegalTraits(ruler.traits);
        let message = "";
        if (negativeTraits.length > 1) {
            message += `You have ${negativeTraits.length} negative traits: ${negativeTraits.map(t => t.getName()).join(", ")}, but only 1 is allowed.`;
        }
        if (illegalTraits.length > 0) {
            message += `The following traits are not allowed: ${illegalTraits.map(t => t.getName()).join(", ")}. `;
        }
        if (incompatibleTraits.length > 1) {
            message += `You have ${incompatibleTraits.length} inheritable traits: ${incompatibleTraits.map(t => t.getName()).join(", ")}, but only 1 is allowed.`;
        }
        return message;
    }

    private getIllegalTraits(traits: Trait[]) {
        return traits.filter(t => t.getTraitType() === TraitType.LIFESTYLE ||
            (t.getName().endsWith("3") && t.getName().indexOf("education") == -1 && t.getRulerDesignerCost() > 0));
    }

    private getIncomptaibleTraits(traits: Trait[]) {
        const inheritableTraits = traits.filter(t => t.getTraitType() === TraitType.INHERITABLE && t.getRulerDesignerCost() > 0);
        if (inheritableTraits.length <= 1) {
            return [];
        }
        return inheritableTraits;
    }


    getLastEu4Save() {
        return this.lastEu4Save$;
    }

    getFlagUrl(nationKey: string): string {
        return `https://codingafterdark.de/mc/ideas/flags/${nationKey}.webp`;
    }
}