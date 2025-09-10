import { Injectable } from '@angular/core';
import { DiscordUser } from '../model/social/DiscordUser';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, interval, Observable, of, EMPTY } from 'rxjs';
import { switchMap, catchError, startWith, tap, map } from 'rxjs/operators';

export interface ApiHealth {
    timestamp: string;
    uptime: number;
    dbIsUp: boolean;
}

interface AuthResponse {
    token: string;
    user: any;
}

interface UserResponse {
    user: any;
}

interface HealthResponse {
    timestamp: string;
    uptime: number;
    db_up: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class DiscordAuthenticationService {
    //public static readonly API_URL = "https://codingafterdark.de/mc-signup";
    //public static readonly API_URL = "http://localhost:3000/api";
    private static readonly CONFIG = {
        API_URL: "http://localhost:3000/api",
        CLIENT_ID: "1403891748371038462",
        JWT_STORAGE_KEY: "discordToken",
        HEALTH_CHECK_INTERVAL: 30000,
        DISCORD_OAUTH_URL: "https://discord.com/api/oauth2/authorize"
    };

    private readonly endpoints = {
        health: `${DiscordAuthenticationService.CONFIG.API_URL}/health`,
        auth: `${DiscordAuthenticationService.CONFIG.API_URL}/auth`,
        user: `${DiscordAuthenticationService.CONFIG.API_URL}/user`
    };

    private jwt: string | null = null;
    private loggedInUser: DiscordUser | null = null;
    
    private readonly _loggedInUser$ = new BehaviorSubject<DiscordUser | null>(null);
    public readonly loggedInUser$ = this._loggedInUser$.asObservable();

    private readonly _isOnline$ = new BehaviorSubject<boolean>(false);
    public readonly isOnline$ = this._isOnline$.asObservable();

    constructor(private http: HttpClient) {
        this.initializeAuth();
        this.startHealthCheck();
    }

    private initializeAuth(): void {
        this.jwt = localStorage.getItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY);
        const redirectUrl = this.getRedirectUrl();
        
        const auth$ = this.jwt 
            ? this.getUserViaJWT(redirectUrl)
            : this.exchangeCodeForJWT(redirectUrl);
            
        auth$.pipe(
            catchError(error => {
                console.error('Auth initialization failed:', error);
                this.updateUserState(null);
                return of(null);
            })
        ).subscribe(user => {
            this.updateUserState(user);
        });
    }

    private updateUserState(user: DiscordUser | null): void {
        this.loggedInUser = user;
        this._loggedInUser$.next(user);
    }

    private startHealthCheck(): void {
        interval(DiscordAuthenticationService.CONFIG.HEALTH_CHECK_INTERVAL)
            .pipe(
                startWith(0),
                switchMap(() => this.getHealth$()),
                catchError(() => of(null)),
                tap(health => {
                    const isOnline = health !== null;
                    this._isOnline$.next(isOnline);
                    
                    if (!isOnline && this.loggedInUser) {
                        this.updateUserState(null);
                    }
                })
            )
            .subscribe();
    }

    getAuthenticationHeader(): Record<string, string> {
        return this.jwt ? { Authorization: `Bearer ${this.jwt}` } : {};
    }

    private getHealth$(): Observable<ApiHealth | null> {
        return this.http.get<HealthResponse>(this.endpoints.health)
            .pipe(
                map(data => ({
                    timestamp: data.timestamp,
                    uptime: data.uptime,
                    dbIsUp: data.db_up
                })),
                catchError(() => of(null))
            );
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

    static getApiUrl(): string {
        return DiscordAuthenticationService.CONFIG.API_URL;
    }

    getRedirectUrl(): string {
        const address = window.location.href;
        if (address.indexOf("?") != -1) {
            return address.split("?")[0];
        }
        window.history.replaceState({}, document.title, address.split("?")[0]);
        return address;
    }

    logOut(): void {
        this.jwt = null;
        this.updateUserState(null);
        localStorage.removeItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY);
    }

    loginOnDiscord(redirectUri: string): void {
        if (this.jwt == null) {
            console.log("Not logged in, redirecting to Discord OAuth2");
            const discordAuthUrl = `${DiscordAuthenticationService.CONFIG.DISCORD_OAUTH_URL}?client_id=${DiscordAuthenticationService.CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
            window.location.href = discordAuthUrl;
        } else {
            console.log("Already logged in, fetching user info");
            this.getUserViaJWT(redirectUri).subscribe(user => {
                this.updateUserState(user);
            });
        }
    }

    exchangeCodeForJWT(redirectUri: string): Observable<DiscordUser | null> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (code) {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState({}, document.title, url.toString());
        }
        if (!code) return of(null);

        const headers = new HttpHeaders({
            'Content-Type': 'application/json'
        });

        return this.http.post<AuthResponse>(this.endpoints.auth, { code, redirectUri }, { headers }).pipe(
            tap(data => {
                localStorage.setItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY, data.token);
                this.jwt = data.token;
            }),
            map(data => {
                const user = DiscordUser.fromApiJson(data.user);
                this.updateUserState(user);
                return user;
            }),
            catchError(() => {
                this.updateUserState(null);
                return of(null);
            })
        );
    }

    private getUserViaJWT(redirectUri: string): Observable<DiscordUser | null> {
        if (this.loggedInUser) {
            return of(this.loggedInUser);
        }
        
        if (!this.jwt) {
            throw new Error("JWT is null");
        }

        const authHeader = this.getAuthenticationHeader();
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });
        
        return this.http.get<UserResponse>(this.endpoints.user, { headers }).pipe(
            map(data => {
                const user = DiscordUser.fromApiJson(data.user);
                this.updateUserState(user);
                return user;
            }),
            catchError((error: any) => {
                if (error.status === 401) {
                    this.jwt = null;
                    localStorage.removeItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY);
                    this.updateUserState(null);
                    return of(null);
                }
                this.logOut();
                return of(null);
            })
        );
    }

    getHealth(): Observable<ApiHealth | null> {
        if (!this.jwt) {
            throw new Error("JWT is null");
        }

        const authHeader = this.getAuthenticationHeader();
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });

        return this.http.get<HealthResponse>(this.endpoints.health, { headers }).pipe(
            map(data => ({
                timestamp: data.timestamp,
                uptime: data.uptime,
                dbIsUp: data.db_up
            })),
            catchError(() => of(null))
        );
    }
}
