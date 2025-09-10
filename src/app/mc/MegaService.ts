import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { MegaCampaign } from './MegaCampaign';

@Injectable({
    providedIn: 'root'
})
export class MegaService {

    getAvailableCampaigns$() {
        return of([
            new MegaCampaign("Dummy Campaign", new Date('2025-09-05T00:00:00'),new Date('2025-09-19T23:59:59'),new Date('2025-09-21T18:30:00'), null),
            //new MegaCampaign("2nd", new Date('2025-09-13T00:00:00'), new Date('2025-09-19T23:59:59'), new Date('2025-09-21T18:30:00'), null)
        ]);
    }
}