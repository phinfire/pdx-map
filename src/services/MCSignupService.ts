
import { Injectable, OnDestroy } from "@angular/core";
import { DiscordAuthenticationService } from "./discord-auth.service";
import { Observable, throwError, from, of, EMPTY, BehaviorSubject, Subject, merge, Subscription } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DiscordUser } from "../model/social/DiscordUser";
import { StartAssignment } from "../app/mc/StartAssignment";

export interface Signup {
    discord_id: string,
    picks: string[];
}

@Injectable({
    providedIn: "root"
})
export class MCSignupService implements OnDestroy {
    private _userPicks$ = new BehaviorSubject<string[]>([]);
    public readonly userPicks$: Observable<string[]> = this._userPicks$.asObservable();

    private _allSignups$ = new BehaviorSubject<Signup[]>([]);
    public readonly allSignups$: Observable<Signup[]> = this._allSignups$.asObservable();

    private readonly endpoints = {
        signup: DiscordAuthenticationService.getApiUrl() + '/signup',
        getSignup: DiscordAuthenticationService.getApiUrl() + "/getsignup",
        aggregatedSignups: DiscordAuthenticationService.getApiUrl() + "/signups",
        registeredUsers: DiscordAuthenticationService.getApiUrl() + "/signedupusernames",
        moderatorSignups: DiscordAuthenticationService.getApiUrl() + "/moderator/getSignups"
    };

    private refreshAggregated$ = new Subject<void>();
    private authSubscription?: Subscription;

    constructor(private discordAuthService: DiscordAuthenticationService, private http: HttpClient) {
        this.authSubscription = this.discordAuthService.loggedInUser$.subscribe(user => {
            if (user) {
                this.fetchUserPicks();
                this.fetchAllSignups();
            } else {
                this._userPicks$.next([]);
                this._allSignups$.next([]);
            }
        });
    }

    ngOnDestroy() {
        this.authSubscription?.unsubscribe();
        this._userPicks$.complete();
        this._allSignups$.complete();
        this.refreshAggregated$.complete();
    }

    public setUserPicks(picks: string[]) {
        this._userPicks$.next(picks);
    }

    public refetchUserPicks() {
        this.fetchUserPicks();
    }

    public refetchAllSignups() {
        this.fetchAllSignups();
    }

    public refetchAggregatedRegistrations() {
        this.refreshAggregated$.next();
    }

    /**
     * @deprecated Use refetchAggregatedRegistrations() instead for consistency with other refetch methods
     */
    refreshAggregatedRegistrations$() {
        this.refetchAggregatedRegistrations();
    }

    registerUserPicks$(picks: string[]): Observable<any> {
        if (!this.discordAuthService.isLoggedIn()) {
            return of(false);
        }
        const authHeader = this.discordAuthService.getAuthenticationHeader();
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });

        return this.http.post<any>(this.endpoints.signup, { picks }, { headers }).pipe(
            switchMap(() => {
                this.fetchUserPicks();
                this.fetchAllSignups();
                this.refetchAggregatedRegistrations();
                return of(true);
            })
        );
    }

    private getAuthenticatedHeaders(): HttpHeaders | null {
        if (!this.discordAuthService.isLoggedIn() || !this.discordAuthService.getToken()) {
            return null;
        }

        const authHeader = this.discordAuthService.getAuthenticationHeader();
        if (!authHeader['Authorization']) {
            return null;
        }

        return new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });
    }

    private fetchUserPicks() {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            this._userPicks$.next([]);
            return;
        }

        this.http.get<any>(this.endpoints.getSignup, { headers }).pipe(
            switchMap((result: any) => of(Array.isArray(result?.picks) ? result.picks : []))
        ).subscribe({
            next: (picks: any) => {
                this._userPicks$.next(picks);
            },
            error: (error) => {
                console.error('MCSignupService: Error fetching user picks:', error);
                this._userPicks$.next([]);
            }
        });
    }

    private fetchAllSignups() {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            this._allSignups$.next([]);
            return;
        }

        this.http.get<any>(this.endpoints.moderatorSignups, { headers }).pipe(
            map((result: any) => {
                return Array.isArray(result?.signups)
                    ? result.signups.map((s: any) => {
                        return {
                            discord_id: s.discord_id,
                            picks: s.picks
                        };
                    })
                    : [];
            }),
            catchError(() => of([]))
        ).subscribe({
            next: (signups: Signup[]) => {
                this._allSignups$.next(signups);
            },
            error: (error) => {
                console.error('MCSignupService: Error fetching all signups:', error);
                this._allSignups$.next([]);
            }
        });
    }

    getAggregatedRegistrations$(): Observable<Map<string, number>> {
        return merge(
            of(null),
            this.refreshAggregated$
        ).pipe(
            switchMap(() =>
                this.http.get<any>(this.endpoints.aggregatedSignups).pipe(
                    switchMap((result: any) => {
                        const countsArr = Array.isArray(result?.counts) ? result.counts : [];
                        const aggregatedMap = new Map<string, number>();
                        for (const entry of countsArr) {
                            aggregatedMap.set(entry.pick, entry.count);
                        }
                        return of(aggregatedMap);
                    }),
                    catchError(() => of(new Map<string, number>()))
                )
            )
        );
    }

    getAllRegisteredUser$(): Observable<DiscordUser[]> {
        return this.http.get<any>(this.endpoints.registeredUsers).pipe(
            map((result: any) => {
                return Array.isArray(result?.users)
                    ? result.users.map((u: any) => DiscordUser.fromApiJson(u))
                    : [];
            }),
            catchError(() => of([]))
        );
    }

    /**
     * @deprecated Use allSignups$ observable instead. This method will make a fresh HTTP request each time.
     * The allSignups$ observable automatically updates when authentication state changes.
     */
    getAllSignups$(): Observable<Signup[]> {
        if (!this.discordAuthService.isLoggedIn()) {
            console.warn('MCSignupService: getAllSignups$ called but user is not logged in.');
            return of([]);
        }

        const authHeader = this.discordAuthService.getAuthenticationHeader();
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });

        return this.http.get<any>(this.endpoints.moderatorSignups, { headers }).pipe(
            map((result: any) => {
                return Array.isArray(result?.signups)
                    ? result.signups.map((s: any) => {
                        return {
                            discord_id: s.discord_id,
                            picks: s.picks
                        };
                    })
                    : [];
            }),
            catchError(() => of([]))
        );
    }

    removeUserSignup$(discordId: string): Observable<boolean> {
        if (!this.discordAuthService.isLoggedIn()) {
            return of(false);
        }

        const authHeader = this.discordAuthService.getAuthenticationHeader();
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });

        return this.http.delete<any>(this.endpoints.signup, { headers, body: { discordId } }).pipe(
            map((result: any) => {
                if (result?.success === true) {
                    this.fetchAllSignups(); // Refresh the signups data
                    this.refetchAggregatedRegistrations();
                }
                return result?.success === true;
            }),
            catchError(() => of(false))
        );
    }
}