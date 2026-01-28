
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy } from "@angular/core";
import { BehaviorSubject, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { DiscordUser } from "../../model/social/DiscordUser";
import { DiscordAuthenticationService } from "../../services/discord-auth.service";

export interface Signup {
    user: DiscordUser,
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
        getSignup: DiscordAuthenticationService.getApiUrl() + "/signup",
        aggregatedSignups: DiscordAuthenticationService.getApiUrl() + "/signup/counts",
        registeredUsers: DiscordAuthenticationService.getApiUrl() + "/signup/users",
        moderatorSignups: DiscordAuthenticationService.getApiUrl() + "/moderator/signups"
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

    registerUserPicks$(picks: string[]): Observable<any> {
        if (!this.discordAuthService.isLoggedIn()) {
            return of(false);
        }
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...this.discordAuthService.getAuthenticationHeader()
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
        this.getAllRegisteredUser$().subscribe(users => {
            this.http.get<any>(this.endpoints.moderatorSignups, { headers }).pipe(
                map((result: any) => {
                    return Array.isArray(result?.signups)
                        ? result.signups.map((s: any) => {
                            const user = users.find(u => u.id === s.discord_id);
                            return {
                                user,
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

    removeUserSignup$(discordId: string): Observable<boolean> {
        if (!this.discordAuthService.isLoggedIn()) {
            return of(false);
        }

        const authHeader = this.discordAuthService.getAuthenticationHeader();
        const headers = new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });

        const adminUrl = `${DiscordAuthenticationService.getApiUrl()}/admin/signups/${discordId}`;
        return this.http.delete<any>(adminUrl, { headers }).pipe(
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