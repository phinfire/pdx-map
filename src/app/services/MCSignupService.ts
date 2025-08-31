
import { Injectable } from "@angular/core";
import { DiscordAuthenticationService } from "./discord-auth.service";
import { BaseHttpService } from "./base-http.service";
import { Observable, throwError, from, of, EMPTY, BehaviorSubject, Subject, merge } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { DiscordUser } from "../util/DiscordUser";

@Injectable({
    providedIn: "root"
})
export class MCSignupService {
    private _userPicks$ = new BehaviorSubject<string[]>([]);
    public readonly userPicks$: Observable<string[]> = this._userPicks$.asObservable();

    private registrationUrl = DiscordAuthenticationService.API_URL + '/signup';
    private getRegistrationUrl = DiscordAuthenticationService.API_URL + "/getsignup";
    private getAggregatedRegistrationsUrl = DiscordAuthenticationService.API_URL + "/signups";
    private getAllRegisteredUserUrl = DiscordAuthenticationService.API_URL + "/signedupusernames";
    private getRegistrationsAsAdminUrl = DiscordAuthenticationService.API_URL + "/admin/signups";

    private refreshAggregated$ = new Subject<void>();

    constructor(private discordAuthService: DiscordAuthenticationService, private httpService: BaseHttpService) {
        this.discordAuthService.loggedInUser$.subscribe(user => {
            if (user) {
                this.fetchUserPicks();
            } else {
                this._userPicks$.next([]);
            }
        });
    }

    public setUserPicks(picks: string[]) {
        this._userPicks$.next(picks);
    }

    private makeAuthenticatedRequest$(url: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Observable<any> {
        if (!this.discordAuthService.isLoggedIn()) {
            return throwError(() => new Error("Unable to make request. User not logged in"));
        }
        const token = this.discordAuthService.getToken();
        return this.httpService.makeAuthenticatedRequest$(url, token!, method, body);
    }

    registerUserPicks$(picks: string[]): Observable<any> {
        return this.makeAuthenticatedRequest$(this.registrationUrl, 'POST', { picks }).pipe(
            switchMap(() => {
                this._userPicks$.next(picks);
                this.refreshAggregatedRegistrations$();
                return of(true);
            })
        );
    }

    clearUserPicks$(): Observable<any> {
        return this.makeAuthenticatedRequest$(this.registrationUrl, 'DELETE').pipe(
            switchMap(() => {
                this._userPicks$.next([]);
                this.refreshAggregatedRegistrations$();
                return of(true);
            })
        );
    }

    private fetchUserPicks() {
        this.makeAuthenticatedRequest$(this.getRegistrationUrl, 'GET').pipe(
            switchMap((result: any) => of(Array.isArray(result?.picks) ? result.picks : []))
        ).subscribe({
            next: picks => this._userPicks$.next(picks),
            error: () => this._userPicks$.next([])
        });
    }

    refreshAggregatedRegistrations$() {
        this.refreshAggregated$.next();
    }

    getAggregatedRegistrations$(): Observable<Map<string, number>> {
        return merge(
            of(null), // initial fetch
            this.refreshAggregated$
        ).pipe(
            switchMap(() =>
                this.httpService.makeRequest$(this.getAggregatedRegistrationsUrl, 'GET').pipe(
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
        return this.httpService.makeRequest$(this.getAllRegisteredUserUrl, 'GET').pipe(
            map((result: any) => {
                return Array.isArray(result?.users)
                    ? result.users.map((u: any) => DiscordUser.fromApiJson(u))
                    : [];
            }),
            catchError(() => of([]))
        );
    }
}
