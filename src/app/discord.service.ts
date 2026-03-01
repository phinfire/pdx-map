import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { DiscordUser } from '../model/social/DiscordUser';

/**
 * Health check response
 */
export interface HealthCheckResponse {
    status: string;
    discord_client_ready: boolean;
    discord_bot_name: string;
}

/**
 * Error response from API
 */
export interface ErrorResponse {
    detail: string;
}

/**
 * Service to interact with the Discord Gateway API
 * Provides access to Discord guild and user information
 */
@Injectable({
    providedIn: 'root',
})
export class DiscordService {
    private readonly apiBaseUrl = "https://codingafterdark.de/discord-api";

    constructor(private http: HttpClient) {
    }

    /**
     * Retrieve all users in a Discord guild as DiscordUser objects, sorted by name
     * @param guildId The Discord guild (="server") ID
     * @returns Observable of array of DiscordUser objects sorted by display name/username
     */
    getGuildUsersAsDiscordUsers(guildId: string): Observable<DiscordUser[]> {
        return this.http.get<any>(`${this.apiBaseUrl}/guild/${guildId}/users`).pipe(
            map(response => {
                const users = Object.values(response.users).map((user: any) => DiscordUser.fromApiJson(user));
                return users.sort((a: DiscordUser, b: DiscordUser) => 
                    a.getName().localeCompare(b.getName())
                );
            })
        );
    }
}
