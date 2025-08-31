import { Injectable } from '@angular/core';
import { DiscordUser } from '../util/DiscordUser';
import { BaseHttpService } from './base-http.service';
import { BehaviorSubject, interval, Observable } from 'rxjs';
import { switchMap, catchError, startWith } from 'rxjs/operators';
import { of } from 'rxjs';

export interface ApiHealth {
    timestamp: string;
    uptime: number;
    dbIsUp: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class DiscordAuthenticationService {

    public static readonly API_URL = "https://codingafterdark.de/mc-signup";
    private readonly JWT_STORAGE_KEY = "discordToken";
    private clientId = "1403891748371038462";
    private backendHealthUrl = DiscordAuthenticationService.API_URL + "/health";
    private backendAuthUrl = DiscordAuthenticationService.API_URL + "/auth";
    private backendGetUserUrl = DiscordAuthenticationService.API_URL + "/user";
    private jwt: string | null;
    private loggedInUser: DiscordUser | null = null;
    private _loggedInUser$ = new BehaviorSubject<DiscordUser | null>(null);
    public readonly loggedInUser$: Observable<DiscordUser | null> = this._loggedInUser$.asObservable();
    
    private _isOnline$ = new BehaviorSubject<boolean>(false);
    public readonly isOnline$: Observable<boolean> = this._isOnline$.asObservable();

    constructor(private httpService: BaseHttpService) {
        this.jwt = localStorage.getItem(this.JWT_STORAGE_KEY);
        if (this.jwt) {
            (async () => {
                this.loggedInUser = await this.getUserViaJWT(this.getRedirectUrl());
                this._loggedInUser$.next(this.loggedInUser);
            })();
        } else {
            (async () => {
                this.loggedInUser = await this.exchangeCodeForJWT(this.getRedirectUrl());
                this._loggedInUser$.next(this.loggedInUser);
            })();
        }
        this.startPeriodicHealthCheck();
    }

    private async makeAuthenticatedRequest<T = any>(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<T> {
        if (!this.jwt) {
            throw new Error("JWT is null");
        }
        return await this.httpService.makeAuthenticatedRequest<T>(url, this.jwt, method, body);
    }

    getToken(): string | null {
        return this.jwt;
    }

    isLoggedIn(): boolean {
        return this.loggedInUser !== null;
    }

    getLoggedInUser(): DiscordUser | null {
        return this.loggedInUser;
    }

    getRedirectUrl(): string {
        const address = window.location.href;
        if (address.indexOf("?") != -1) {
            return address.split("?")[0];
        }
        window.history.replaceState({}, document.title, address.split("?")[0]);
        return address;
    }

    logOut() {
    this.jwt = null;
    this.loggedInUser = null;
    this._loggedInUser$.next(null);
    localStorage.removeItem(this.JWT_STORAGE_KEY);
    }

    async loginOnDiscord(redirectUri: string) {
        if (this.jwt == null) {
            console.log("Not logged in, redirecting to Discord OAuth2");
            const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
            window.location.href = discordAuthUrl;
        } else {
            console.log("Already logged in, fetching user info");
            this.loggedInUser = await this.getUserViaJWT(redirectUri);
            this._loggedInUser$.next(this.loggedInUser);
        }
    }

    async exchangeCodeForJWT(redirectUri: string): Promise<DiscordUser | null> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState({}, document.title, url.toString());
        }
        if (!code) return null;
        
        try {
            const data = await this.httpService.makeRequest(this.backendAuthUrl, 'POST', { code, redirectUri: redirectUri });
            localStorage.setItem(this.JWT_STORAGE_KEY, data.token);
            this.jwt = data.token;
            const user = DiscordUser.fromApiJson(data.user);
            this.loggedInUser = user;
            this._loggedInUser$.next(user);
            return user;
        } catch {
            this.loggedInUser = null;
            this._loggedInUser$.next(null);
            return null;
        }
    }

    private async getUserViaJWT(redirectUri: string): Promise<DiscordUser | null> {
        if (this.loggedInUser) {
            return this.loggedInUser;
        }
        try {
            const data = await this.makeAuthenticatedRequest(this.backendGetUserUrl, 'GET');
            const user = DiscordUser.fromApiJson(data.user);
            this.loggedInUser = user;
            this._loggedInUser$.next(user);
            return user;
        } catch (error: any) {
            if (error.status === 401) {
                this.jwt = null;
                localStorage.removeItem(this.JWT_STORAGE_KEY);
                this.loggedInUser = null;
                this._loggedInUser$.next(null);
                return null;
            }
            this.logOut();
            return null;
        }
    }

    private startPeriodicHealthCheck() {
        this.checkHealth();
        interval(30000).pipe(
            startWith(0),
            switchMap(() => this.getHealth()),
            catchError(() => of(null))
        ).subscribe(health => {
            const isOnline = health !== null;
            this._isOnline$.next(isOnline);
            if (!isOnline && this.loggedInUser !== null) {
                console.log("API is offline, clearing logged-in user state");
                this.loggedInUser = null;
                this._loggedInUser$.next(null);
            }
        });
    }

    private async checkHealth() {
        const health = await this.getHealth();
        const isOnline = health !== null;
        this._isOnline$.next(isOnline);
        
        if (!isOnline && this.loggedInUser !== null) {
            console.log("API is offline, clearing logged-in user state");
            this.loggedInUser = null;
            this._loggedInUser$.next(null);
        }
    }

    async getHealth() {
        try {
            const data = await this.httpService.makeRequest<any>(this.backendHealthUrl, 'GET');
            return {
                timestamp: data.timestamp,
                uptime: data.uptime,
                dbIsUp: data.db_up
            }
        } catch {
            return null;
        }
    }
}
