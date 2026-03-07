import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, DestroyRef, inject } from '@angular/core';
import { BehaviorSubject, interval, Observable, of, Subject } from 'rxjs';
import { catchError, map, startWith, switchMap, tap, shareReplay, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DiscordUser } from '../model/social/DiscordUser';
import { DiscordService } from '../app/discord.service';

export interface ApiHealth {
    timestamp: string;
    uptime: number;
    dbIsUp: boolean;
    role: string | null;
}

interface AuthResponse {
    token: string;
    user: any;
}

interface HealthResponse {
    timestamp: string;
    uptime: number;
    db_up: boolean;
    user_role: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class DiscordAuthenticationService {
    private static readonly CONFIG = {
        API_URL: "https://codingafterdark.de/mc-signup",
        AUTH_SERVICE_URL: "https://codingafterdark.de/authentication",
        CLIENT_ID: "1403891748371038462",
        JWT_STORAGE_KEY: "discordToken",
        HEALTH_CHECK_INTERVAL: 3000,
        DISCORD_OAUTH_URL: "https://discord.com/api/oauth2/authorize"
    };

    private readonly endpoints = {
        health: `${DiscordAuthenticationService.CONFIG.AUTH_SERVICE_URL}/health`,
        auth: `${DiscordAuthenticationService.CONFIG.AUTH_SERVICE_URL}/`,
        user: `${DiscordAuthenticationService.CONFIG.AUTH_SERVICE_URL}/user`
    };

    private readonly destroyRef = inject(DestroyRef);
    private readonly _logout$ = new Subject<void>();
    private readonly _jwt$ = new BehaviorSubject<string | null>(
        localStorage.getItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY)
    );
    private readonly discordService = inject(DiscordService);

    public readonly loggedInUser$: Observable<DiscordUser | null> = this._jwt$.pipe(
        switchMap(jwt => jwt ? this.getUserFromJWT() : of(null)),
        distinctUntilChanged(),
        shareReplay(1)
    );

    public readonly isOnline$: Observable<boolean> = interval(DiscordAuthenticationService.CONFIG.HEALTH_CHECK_INTERVAL).pipe(
        startWith(0),
        switchMap(() => this.getHealth$()),
        map(health => health !== null),
        distinctUntilChanged(),
        shareReplay(1)
    );

    constructor(private http: HttpClient) {
        this.initializeAuth();
        this.setupLogout();
    }

    private initializeAuth(): void {
        const redirectUrl = this.getRedirectUrl();
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
            console.log('[DEBUG] initializeAuth: Found code in URL, exchanging for JWT and fetching user data');
            this.exchangeCodeForJWT(redirectUrl)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(user => {
                    if (user) {
                        console.log('[DEBUG] initializeAuth: Code exchange and user fetch complete for user:', user.id);
                    } else {
                        console.warn('[WARN] initializeAuth: Code exchange or user fetch returned null user');
                    }
                });
        } else {
            console.log('[DEBUG] initializeAuth: No code in URL. JWT will be restored from localStorage if available.');
            const jwt = localStorage.getItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY);
            if (jwt) {
                console.log('[DEBUG] initializeAuth: JWT restored from localStorage, user will be fetched from backend');
            }
        }
    }

    private setupLogout(): void {
        this._logout$.pipe(
            tap(() => {
                console.log('[DEBUG] setupLogout: Logging out user');
                localStorage.removeItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY);
                this._jwt$.next(null);
            }),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe();
    }

    getAuthenticationHeader(): Record<string, string> {
        const jwt = this._jwt$.value;
        return jwt ? { Authorization: `Bearer ${jwt}` } : {};
    }

    private getHealth$(): Observable<ApiHealth | null> {
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...this.getAuthenticationHeader()
        });

        return this.http.get<HealthResponse>(this.endpoints.health, { headers })
            .pipe(
                map(data => ({
                    timestamp: data.timestamp,
                    uptime: data.uptime,
                    dbIsUp: data.db_up,
                    role: data.user_role
                })),
                catchError(() => of(null))
            );
    }

    isLoggedIn$(): Observable<boolean> {
        return this.loggedInUser$.pipe(
            map(user => user !== null),
            distinctUntilChanged()
        );
    }

    static getApiUrl(): string {
        return DiscordAuthenticationService.CONFIG.API_URL;
    }

    private getRedirectUrl(): string {
        return window.location.href.indexOf("localhost") != -1 ? "http://localhost:4200/pdx" : "https://codingafterdark.de/pdx";
    }

    logOut(): void {
        console.log('[DEBUG] logOut: Triggering logout');
        this._logout$.next();
    }

    loginOnDiscord(): void {
        const jwt = this._jwt$.value;
        if (!jwt) {
            console.log('[DEBUG] loginOnDiscord: No JWT, redirecting to Discord');
            const discordAuthUrl = `${DiscordAuthenticationService.CONFIG.DISCORD_OAUTH_URL}?client_id=${DiscordAuthenticationService.CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.getRedirectUrl())}&response_type=code&scope=identify`;
            window.location.href = discordAuthUrl;
        } else {
            console.log('[DEBUG] loginOnDiscord: Already logged in');
        }
    }

    private exchangeCodeForJWT(redirectUri: string): Observable<DiscordUser | null> {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState({}, document.title, url.toString());
        }

        if (!code) {
            return of(null);
        }

        const headers = new HttpHeaders({
            'Content-Type': 'application/json'
        });

        return this.http.post<AuthResponse>(this.endpoints.auth, { code, redirectUri }, { headers }).pipe(
            tap(data => {
                console.log('[DEBUG] exchangeCodeForJWT response:', data);
                localStorage.setItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY, data.token);
                this._jwt$.next(data.token);
            }),
            switchMap(data => {
                if (!data?.user?.id) {
                    console.error('[ERROR] User ID is null/undefined in auth response.');
                    return of(null);
                }
                const userId = data.user.id;
                console.log('[DEBUG] JWT received and stored. Fetching full user data for userId:', userId);
                return this.fetchFullUserByUserId(userId);
            }),
            catchError((error: any) => {
                console.error('[ERROR] Error exchanging code for JWT:', error);
                console.error('[ERROR] Error status:', error?.status);
                console.error('[ERROR] Error response:', error?.error);
                this.logOut();
                return of(null);
            })
        );
    }

    private getUserFromJWT(): Observable<DiscordUser | null> {
        const authHeader = this.getAuthenticationHeader();
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });

        return this.http.get<{ user: any }>(this.endpoints.user, { headers }).pipe(
            tap(data => {
                console.log('[DEBUG] getUserFromJWT response:', data);
                if (!data?.user?.id) {
                    console.warn('[WARN] No user ID in response. Response:', JSON.stringify(data));
                }
            }),
            switchMap(data => {
                if (!data?.user?.id) {
                    console.error('[ERROR] User ID is null/undefined in response.');
                    return of(null);
                }
                const userId = data.user.id;
                console.log('[DEBUG] Got user ID from JWT endpoint:', userId, 'Fetching full user data...');
                return this.fetchFullUserByUserId(userId);
            }),
            catchError((error: any) => {
                if (error.status === 401) {
                    console.warn('[WARN] Unauthorized. JWT likely expired. Logging out.');
                    this.logOut();
                } else {
                    console.error('[ERROR] Error fetching user with JWT:', error);
                    console.error('[ERROR] Error status:', error?.status);
                    console.error('[ERROR] Error response:', error?.error);
                }
                return of(null);
            })
        );
    }

    private fetchFullUserByUserId(userId: string): Observable<DiscordUser | null> {
        return this.discordService.getUsersByIds([userId]).pipe(
            map(response => {
                if (!response?.users?.[userId]) {
                    console.error('[ERROR] Full user data not found for userId:', userId);
                    return null;
                }
                return DiscordUser.fromApiJson(response.users[userId]);
            })
        );
    }
}
