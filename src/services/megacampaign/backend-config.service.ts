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
            //return "https://codingafterdark.de/mapclaim"
            return `http://localhost:8085/megacampaign`;
        }

        getDiscordApiUrl(): string {
            return "https://codingafterdark.de/discord-api";
        }
    }