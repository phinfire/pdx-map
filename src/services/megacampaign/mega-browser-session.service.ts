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
                console.log('Looking for campaign ID in fetched campaigns:', campaignIdNum, campaigns);
                const found = campaigns.find(c => c.getId() === campaignIdNum);
                console.log('Found campaign:', found);
                if (found && found.getId() !== this.selectedMegaCampaignSubject.value?.getId()) {
                    this.selectedMegaCampaignSubject.next(found);
                }
            }),
            map(campaigns => campaigns.find(c => c.getId() === campaignIdNum) || this.selectedMegaCampaignSubject.value)
        );
    }

    selectPreviousCampaign(): Observable<MegaCampaign | null> {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => {
                const currentId = this.selectedMegaCampaignSubject.value?.getId();
                const index = campaigns.findIndex(c => c.getId() === currentId);
                return index > 0 ? campaigns[index - 1] : null;
            }),
            tap(prev => prev && this.selectedMegaCampaignSubject.next(prev))
        );
    }

    selectNextCampaign(): Observable<MegaCampaign | null> {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => {
                const currentId = this.selectedMegaCampaignSubject.value?.getId();
                const index = campaigns.findIndex(c => c.getId() === currentId);
                return index >= 0 && index < campaigns.length - 1 ? campaigns[index + 1] : null;
            }),
            tap(next => next && this.selectedMegaCampaignSubject.next(next))
        );
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