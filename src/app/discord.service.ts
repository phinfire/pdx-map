import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, forkJoin, of } from 'rxjs';
import { DiscordUser } from '../model/social/DiscordUser';

export interface HealthCheckResponse {
    status: string;
    discord_client_ready: boolean;
    discord_bot_name: string;
}

export interface ErrorResponse {
    detail: string;
}

export interface UsersResponse {
    users: { [userId: string]: any };
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
                const users = Object.values(response.users).map((user: any) => {
                    return DiscordUser.fromApiJson(user)
                });
                return users.sort((a: DiscordUser, b: DiscordUser) =>
                    a.getName().localeCompare(b.getName())
                );
            })
        );
    }

    /**
     * Get user information for a list of user IDs (batched to avoid URL length limits)
     * @param userIds Array of Discord user IDs to retrieve
     * @returns Observable of UsersResponse containing user information
     */
    getUsersByIds(userIds: string[]): Observable<UsersResponse> {
        if (userIds.length === 0) {
            return of({ users: {} });
        }
        const BATCH_SIZE = 50;
        const batches: string[][] = [];
        for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
            batches.push(userIds.slice(i, i + BATCH_SIZE));
        }
        if (batches.length === 1) {
            return this.fetchUserBatch(batches[0]);
        }
        return forkJoin(batches.map(batch => this.fetchUserBatch(batch))).pipe(
            map(responses => {
                const combinedUsers: { [userId: string]: any } = {};
                responses.forEach(response => {
                    Object.assign(combinedUsers, response.users);
                });
                return { users: combinedUsers };
            })
        );
    }

    private fetchUserBatch(userIds: string[]): Observable<UsersResponse> {
        let url = `${this.apiBaseUrl}/users`;
        if (userIds.length > 0) {
            const params = new URLSearchParams();
            userIds.forEach(id => params.append('user_ids', id));
            url += `?${params.toString()}`;
        }
        return this.http.get<UsersResponse>(url);
    }
}
