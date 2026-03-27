import { inject, Injectable } from "@angular/core";
import { BehaviorSubject, Observable, tap, map } from "rxjs";
import { MegaCampaign } from "../../app/mc/MegaCampaign";
import { MegaService } from "./MegaService";

@Injectable({
    providedIn: 'root',
})
export class MegaBrowserSessionService {

    private megaService = inject(MegaService);

    private selectedMegaCampaignSubject = new BehaviorSubject<MegaCampaign | null>(null);
    public selectedMegaCampaign$ = this.selectedMegaCampaignSubject.asObservable();

    constructor() {
        this.megaService.getAvailableCampaigns$()
            .subscribe(campaigns => {
                if (!this.selectedMegaCampaignSubject.value && campaigns.length > 0) {
                    this.selectedMegaCampaignSubject.next(campaigns[0]);
                }
            });
    }

    hasNextCampaign(campaign: MegaCampaign): Observable<boolean> {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => {
                const index = campaigns.findIndex(c => c.getId() === campaign.getId());
                return index >= 0 && index < campaigns.length - 1;
            })
        );
    }

    canNavigate(campaign: MegaCampaign, navigation: number) {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => {
                const index = campaigns.findIndex(c => c.getId() === campaign.getId());
                const targetIndex = index + navigation;
                return targetIndex >= 0 && targetIndex < campaigns.length;
            })
        );
    }

    navigateFromTo(campaign: MegaCampaign, navigation: number): Observable<MegaCampaign | null> {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => {
                const index = campaigns.findIndex(c => c.getId() === campaign.getId());
                const targetIndex = index + navigation;
                if (targetIndex < 0 || targetIndex >= campaigns.length) {
                    console.error(`Cannot navigate from campaign ${campaign.getId()} with navigation ${navigation}. Target index ${targetIndex} is out of bounds.`);
                    return null;
                }
                const result = campaigns[targetIndex];
                this.selectedMegaCampaignSubject.next(result);
                return result;
            })
        );
    }

    selectCampaignById(campaignId: string | number | null): Observable<MegaCampaign | null> {
        if (!campaignId) {
            return this.selectedMegaCampaignSubject.asObservable();
        }
        if (campaignId == "latest") {
            return this.selectLatestCampaign();
        }
        const campaignIdNum = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId;
        return this.megaService.getAvailableCampaigns$().pipe(
            tap(campaigns => {
                const found = campaigns.find(c => c.getId() === campaignIdNum);
                if (found && found.getId() !== this.selectedMegaCampaignSubject.value?.getId()) {
                    this.selectedMegaCampaignSubject.next(found);
                }
            }),
            map(campaigns => campaigns.find(c => c.getId() === campaignIdNum) || this.selectedMegaCampaignSubject.value)
        );
    }

    selectPreviousCampaign(): Observable<MegaCampaign | null> {
        const current = this.selectedMegaCampaignSubject.value;
        if (!current) {
            return this.selectedMegaCampaignSubject.asObservable();
        }
        return this.navigateFromTo(current, -1);
    }

    selectNextCampaign(): Observable<MegaCampaign | null> {
        const current = this.selectedMegaCampaignSubject.value;
        if (!current) {
            return this.selectedMegaCampaignSubject.asObservable();
        }
        return this.navigateFromTo(current, 1);
    }

    selectLatestCampaign(): Observable<MegaCampaign | null> {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => campaigns.length > 0 ? campaigns[campaigns.length - 1] : null),
            tap(latest => {
                if (latest && latest.getId() !== this.selectedMegaCampaignSubject.value?.getId()) {
                    this.selectedMegaCampaignSubject.next(latest);
                }
            })
        );
    }
}