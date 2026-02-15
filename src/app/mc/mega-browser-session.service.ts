import { inject, Injectable } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { MegaService } from './MegaService';
import { MegaCampaign } from './MegaCampaign';

@Injectable({
    providedIn: 'root',
})
export class MegaBrowserSessionService {

    private megaService = inject(MegaService);

    private selectedMegaCampaignSubject = new BehaviorSubject<MegaCampaign | null>(null);
    public selectedMegaCampaign$ = this.selectedMegaCampaignSubject.asObservable();

    constructor() {
        this.megaService.getAvailableCampaigns$()
            .pipe(takeUntilDestroyed())
            .subscribe(campaigns => {
                console.log('Fetched campaigns for browser session:', campaigns);
                this.selectedMegaCampaignSubject.next(campaigns.length > 0 ? campaigns[0] : null);
            });
    }

    selectCampaignById(campaignId: string | number | null): Observable<MegaCampaign | null> {
        if (!campaignId) {
            return this.selectedMegaCampaignSubject.asObservable();
        }
        const campaignIdNum = typeof campaignId === 'string' ? parseInt(campaignId, 10) : campaignId;
        return this.megaService.getAvailableCampaigns$().pipe(
            tap(campaigns => {
                const found = campaigns.find(c => c.getId() === campaignIdNum);
                if (found && found.getId() !== this.selectedMegaCampaignSubject.value?.getId()) {
                    this.selectedMegaCampaignSubject.next(found);
                }
            }),
            map(campaigns => campaigns.find(c => c.getId() === campaignIdNum) || this.selectedMegaCampaignSubject.value),
            takeUntilDestroyed()
        );
    }

    selectPreviousCampaign(): Observable<MegaCampaign | null> {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => {
                const currentId = this.selectedMegaCampaignSubject.value?.getId();
                const index = campaigns.findIndex(c => c.getId() === currentId);
                return index > 0 ? campaigns[index - 1] : null;
            }),
            tap(prev => prev && this.selectedMegaCampaignSubject.next(prev)),
            takeUntilDestroyed()
        );
    }

    selectNextCampaign(): Observable<MegaCampaign | null> {
        return this.megaService.getAvailableCampaigns$().pipe(
            map(campaigns => {
                const currentId = this.selectedMegaCampaignSubject.value?.getId();
                const index = campaigns.findIndex(c => c.getId() === currentId);
                return index >= 0 && index < campaigns.length - 1 ? campaigns[index + 1] : null;
            }),
            tap(next => next && this.selectedMegaCampaignSubject.next(next)),
            takeUntilDestroyed()
        );
    }
}