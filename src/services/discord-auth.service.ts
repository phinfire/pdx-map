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
            this.exchangeCodeForJWT(redirectUrl)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe();
        }
    }

    private setupLogout(): void {
        this._logout$.pipe(
            tap(() => {
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

    private getRedirectUrl(): string {
        return window.location.href.indexOf("localhost") != -1 ? "http://localhost:4200/pdx" : "https://codingafterdark.de/pdx";
    }

    logOut(): void {
        this._logout$.next();
    }

    loginOnDiscord(): void {
        if (!this._jwt$.value) {
            const discordAuthUrl = `${DiscordAuthenticationService.CONFIG.DISCORD_OAUTH_URL}?client_id=${DiscordAuthenticationService.CONFIG.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.getRedirectUrl())}&response_type=code&scope=identify`;
            window.location.href = discordAuthUrl;
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
                localStorage.setItem(DiscordAuthenticationService.CONFIG.JWT_STORAGE_KEY, data.token);
                this._jwt$.next(data.token);
            }),
            switchMap(data => {
                if (!data?.user?.id) {
                    return of(null);
                }
                const userId = data.user.id;
                return this.discordService.getUsersByIds([userId]).pipe(
                    map(response => {
                        if (!response?.users?.[userId]) {
                            return null;
                        }
                        return DiscordUser.fromApiJson(response.users[userId]);
                    })
                );
            }),
            catchError((error: any) => {
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
            switchMap(data => {
                if (!data?.user?.id) {
                    return of(null);
                }
                const userId = data.user.id;
                return this.discordService.getUsersByIds([userId]).pipe(
                    map(response => {
                        if (!response?.users?.[userId]) {
                            return null;
                        }
                        return DiscordUser.fromApiJson(response.users[userId]);
                    })
                );
            }),
            catchError((error: any) => {
                if (error.status === 401) {
                    this.logOut();
                }
                return of(null);
            })
        );
    }
}
