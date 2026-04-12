import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class BackendConfigService {

    getMegaCampaignApiUrl(): string {
        return "https://codingafterdark.de/megacampaign"
        //return `http://localhost:8085/megacampaign`;
    }

    getMapClaimApiUrl(): string {
        return "https://codingafterdark.de/megacampaign/mapclaims"
        //return `http://localhost:8085/megacampaign/mapclaims`;
    }

    getDiscordApiUrl(): string {
        return "https://codingafterdark.de/discord-api";
    }
}