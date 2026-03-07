import { HttpClient, HttpHeaders } from "@angular/common/http";
import { inject, Injectable, OnDestroy } from "@angular/core";
import { Observable, Subject, of, switchMap, map, catchError, merge, combineLatest, startWith, shareReplay, distinctUntilChanged, filter, tap } from "rxjs";
import { DiscordAuthenticationService } from "../discord-auth.service";
import { MegaBrowserSessionService } from "../../app/mc/mega-browser-session.service";
import { MegaService } from "../../app/mc/MegaService";

export interface Signup {
    userId: string;
    picks: string[];
}

@Injectable({
    providedIn: 'root',
})
export class McSignupService implements OnDestroy {

    private sessionService = inject(MegaBrowserSessionService);
    private megaService = inject(MegaService);
    private authService = inject(DiscordAuthenticationService);
    private http = inject(HttpClient);

    private destroy$ = new Subject<void>();
    private refetchUserPicks$ = new Subject<void>();
    private refetchAllSignups$ = new Subject<void>();
    private refetchAggregated$ = new Subject<void>();

    private campaignId$ = this.sessionService.selectedMegaCampaign$.pipe(
        map(c => c?.getId() ?? null),
        distinctUntilChanged(),
        shareReplay(1)
    );

    private isAuthenticated$ = this.authService.loggedInUser$.pipe(
        map(user => !!user),
        distinctUntilChanged(),
        shareReplay(1)
    );

    private meId$ = this.authService.loggedInUser$.pipe(
        map(user => user?.id || null),
        distinctUntilChanged(),
        shareReplay(1)
    );

    public readonly userPicks$: Observable<string[]> = merge(
        this.campaignId$,
        this.isAuthenticated$,
        this.refetchUserPicks$
    ).pipe(
        switchMap(() => combineLatest([this.campaignId$, this.isAuthenticated$])),
        filter(([id, isAuth]) => isAuth && id !== null),
        switchMap(([campaignId]) => this.fetchUserPicksInternal(campaignId)),
        startWith([]),
        shareReplay(1)
    );

    public readonly allSignups$: Observable<Signup[]> = merge(
        this.campaignId$,
        this.isAuthenticated$,
        this.refetchAllSignups$
    ).pipe(
        switchMap(() => combineLatest([this.campaignId$, this.isAuthenticated$])),
        filter(([id, isAuth]) => isAuth && id !== null),
        switchMap(([campaignId]) => this.fetchAllSignupsInternal(campaignId)),
        startWith([]),
        shareReplay(1)
    );

    public readonly aggregatedRegistrations$: Observable<Map<string, number>> = merge(
        this.campaignId$.pipe(distinctUntilChanged((a, b) => a === b)),
        this.refetchAggregated$
    ).pipe(
        switchMap(() => this.campaignId$),
        filter(id => id !== null),
        switchMap(campaignId => this.fetchAggregatedInternal(campaignId)),
        startWith(new Map<string, number>()),
        shareReplay(1)
    );

    public readonly aggregatedSignupsCount$: Observable<number> = merge(
        this.campaignId$.pipe(distinctUntilChanged((a, b) => a === b)),
        this.refetchAggregated$
    ).pipe(
        switchMap(() => this.campaignId$),
        filter(id => id !== null),
        switchMap(campaignId => this.fetchSignupCount(campaignId)),
        startWith(0),
        shareReplay(1)
    );

    constructor(private discordAuthService: DiscordAuthenticationService) { }

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    public refetchUserPicks() {
        this.refetchUserPicks$.next();
    }

    public refetchAllSignups() {
        this.refetchAllSignups$.next();
    }

    public refetchAggregatedRegistrations() {
        this.refetchAggregated$.next();
    }

    registerUserPicks$(userId: string, preferenceKeys: string[]): Observable<boolean> {
        return this.campaignId$.pipe(
            switchMap(campaignId => {
                if (!campaignId) {
                    return of(false);
                }
                const headers = this.authService.getAuthenticationHeader();
                const url = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/signups/${userId}`;
                return this.http.post<any>(url, { preferenceKeys }, { headers }).pipe(
                    tap(() => {
                        this.refetchUserPicks$.next();
                        this.refetchAllSignups$.next();
                        this.refetchAggregated$.next();
                    }),
                    map(() => true),
                    catchError((error) => {
                        console.error('McSignupService: Error registering user picks:', error);
                        return of(false);
                    })
                );
            })
        );
    }

    removeUserSignup$(discordId: string): Observable<boolean> {
        return this.campaignId$.pipe(
            switchMap(campaignId => {
                if (!campaignId) {
                    return of(false);
                }

                const authHeader = this.discordAuthService.getAuthenticationHeader();
                const headers = new HttpHeaders({
                    'Content-Type': 'application/json',
                    ...authHeader
                });

                const adminUrl = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/signup/${discordId}`;
                return this.http.delete<any>(adminUrl, { headers }).pipe(
                    tap(() => {
                        this.refetchAllSignups$.next();
                        this.refetchAggregated$.next();
                    }),
                    map(() => true),
                    catchError((error) => {
                        console.error('McSignupService: Error removing user signup:', error);
                        return of(false);
                    })
                );
            })
        );
    }

    /**
     * Gets the current user's own signup (user endpoint)
     */
    private fetchUserSignup(campaignId: number | null): Observable<string[]> {
        if (!campaignId) {
            return of([]);
        }
        const headers = this.authService.getAuthenticationHeader();
        if (!headers) {
            return of([]);
        }
        return this.meId$.pipe(
            switchMap(meId => {
                if (!meId) {
                    return of([]);
                }
                const url = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/signups/${meId}`;
                return this.http.get<any>(url, { headers }).pipe(
                    map((response: any) => {
                        const picks: any[] = response?.preferenceKeys || response?.picks || [];
                        return Array.isArray(picks) ? picks : [];
                    }),
                    catchError((error) => {
                        // 404 is expected for new users who haven't signed up yet - silently return empty
                        if (error.status === 404) {
                            return of([]);
                        }
                        // For other errors, also return empty to gracefully degrade
                        console.warn('MCSignupService: Warning fetching user picks:', error?.message || error);
                        return of([]);
                    })
                );
            })
        );
    }

    private fetchUserPicksInternal(campaignId: number | null): Observable<string[]> {
        return this.fetchUserSignup(campaignId);
    }

    /**
     * Gets all signups for a campaign (admin endpoint)
     */
    private fetchAllSignupsFromAdmin(campaignId: number | null): Observable<any[]> {
        if (!campaignId) {
            return of([]);
        }

        const headers = this.authService.getAuthenticationHeader();
        if (!headers) {
            return of([]);
        }

        return this.http.get<any>(`${this.megaService.getServiceURL()}/campaigns/${campaignId}/signups`, { headers }).pipe(
            map((result: any) => {
                return Array.isArray(result) ? result : result?.signups || [];
            }),
            catchError((error) => {
                console.error('McSignupService: Error fetching all signups from admin endpoint:', error);
                return of([]);
            })
        );
    }

    private fetchAllSignupsInternal(campaignId: number | null): Observable<Signup[]> {
        return this.fetchAllSignupsFromAdmin(campaignId).pipe(
            map((signups: any[]) => {
                return signups.map(s => {
                    const picks: string[] = s.preferenceKeys || s.picks || [];
                    console.log(s);
                    return { userId: s.userId + "", picks } as Signup;
                });
            })
        );
    }

    private fetchAggregatedInternal(campaignId: number | null): Observable<Map<string, number>> {
        return this.fetchAllSignupsFromAdmin(campaignId).pipe(
            map((list: any[]) => {
                const aggregatedMap = new Map<string, number>();
                for (const entry of list) {
                    const picks: any[] = entry.preferenceKeys || entry.picks || [];
                    if (Array.isArray(picks)) {
                        picks.forEach(pick => {
                            const count = aggregatedMap.get(pick) || 0;
                            aggregatedMap.set(pick, count + 1);
                        });
                    }
                }
                return aggregatedMap;
            }),
            catchError((error) => {
                console.error('McSignupService: Error fetching aggregated registrations:', error);
                return of(new Map<string, number>());
            })
        );
    }

    /**
     * Gets the total count of signups for a campaign (admin endpoint)
     */
    private fetchSignupCount(campaignId: number | null): Observable<number> {
        if (!campaignId) {
            return of(0);
        }

        const headers = this.authService.getAuthenticationHeader();
        if (!headers) {
            return of(0);
        }

        return this.http.get<any>(`${this.megaService.getServiceURL()}/campaigns/${campaignId}/signups/count`, { headers }).pipe(
            map((result: any) => {
                return typeof result === 'number' ? result : result?.count || 0;
            }),
            catchError((error) => {
                console.warn('McSignupService: Warning fetching signup count:', error?.message || error);
                return of(0);
            })
        );
    }
}
