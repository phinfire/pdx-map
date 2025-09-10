import { inject, Injectable, OnDestroy } from "@angular/core";
import { MCSignupService } from "./MCSignupService";
import { Observable, map, catchError, of, switchMap, Subject, startWith, throwError, BehaviorSubject, Subscription } from "rxjs";
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { StartAssignment } from "../app/mc/StartAssignment";
import { DiscordAuthenticationService } from "./discord-auth.service";

@Injectable({
    providedIn: 'root'
})
export class AssignmentService implements OnDestroy {
    mcSignupService = inject(MCSignupService);
    discordAuthService = inject(DiscordAuthenticationService);
    http = inject(HttpClient);

    private readonly endpoints = {
        getMyAssignment: `${DiscordAuthenticationService.getApiUrl()}/user/getMyAssignment`,
        setMyStartingPosition: `${DiscordAuthenticationService.getApiUrl()}/user/setMyStartingPosition`,
        getAllRegionAssignments: `${DiscordAuthenticationService.getApiUrl()}/user/getAllRegionAssignments`,
        setAssignments: `${DiscordAuthenticationService.getApiUrl()}/moderator/updateAssignments`
    };

    private refreshAssignments$ = new Subject<void>();
    private _allAssignments$ = new BehaviorSubject<StartAssignment[]>([]);
    public readonly allAssignments$: Observable<StartAssignment[]> = this._allAssignments$.asObservable();
    
    private _myAssignment$ = new BehaviorSubject<StartAssignment | null>(null);
    public readonly myAssignment$: Observable<StartAssignment | null> = this._myAssignment$.asObservable();
    
    private authSubscription?: Subscription;

    constructor() {
        // Automatically fetch assignments when user logs in/out
        this.authSubscription = this.discordAuthService.loggedInUser$.subscribe(user => {
            if (user) {
                this.fetchAllAssignments();
                this.fetchMyAssignment();
            } else {
                this._allAssignments$.next([]);
                this._myAssignment$.next(null);
            }
        });
    }

    ngOnDestroy() {
        this.authSubscription?.unsubscribe();
        this.refreshAssignments$.complete();
        this._allAssignments$.complete();
        this._myAssignment$.complete();
    }

    private getAuthenticatedHeaders(): HttpHeaders | null {
        if (!this.discordAuthService.isLoggedIn()) {
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

    /**
     * @deprecated Use myAssignment$ observable instead. This method creates a new HTTP request each time.
     * The myAssignment$ observable automatically updates when authentication state changes.
     */
    getMyAssignment$(): Observable<StartAssignment | null> {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            return of(null);
        }

        return this.http.get<any>(this.endpoints.getMyAssignment, { headers }).pipe(
            map((result: any) => {
                console.log('AssignmentService: Fetched user assignment (deprecated method):', result);
                return result?.assignment ? result.assignment as StartAssignment : null;
            }),
            catchError((error) => {
                console.error('AssignmentService: Error fetching user assignment:', error);
                return of(null);
            })
        );
    }

    updateMyAssignment$(assignment: StartAssignment): Observable<boolean> {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            return of(false);
        }

        return this.http.post<any>(this.endpoints.setMyStartingPosition, assignment, { headers }).pipe(
            map(() => {
                this.refreshAssignments$.next();
                this.fetchMyAssignment(); // Refresh the cached assignment
                return true;
            }),
            catchError((error) => {
                console.error('AssignmentService: Error updating user assignment:', error);
                return of(false);
            })
        );
    }

    refreshAssignments(): void {
        this.refreshAssignments$.next();
        this.fetchAllAssignments(); // Also refresh the cached assignments
        this.fetchMyAssignment(); // Also refresh the cached user assignment
    }

    /**
     * @deprecated Use refreshAssignments() instead for consistency with other services
     */
    refetchAssignments(): void {
        this.refreshAssignments();
    }

    public refetchAllAssignments(): void {
        this.fetchAllAssignments();
    }

    public refetchMyAssignment(): void {
        this.fetchMyAssignment();
    }

    private fetchMyAssignment(): void {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            this._myAssignment$.next(null);
            return;
        }

        this.http.get<any>(this.endpoints.getMyAssignment, { headers }).pipe(
            map((result: any) => {
                return result?.assignment ? result.assignment as StartAssignment : null;
            }),
            catchError((error) => {
                console.error('AssignmentService: Error fetching user assignment:', error);
                return of(null);
            })
        ).subscribe({
            next: (assignment: StartAssignment | null) => {
                this._myAssignment$.next(assignment);
            },
            error: (error) => {
                console.error('AssignmentService: Error in fetchMyAssignment subscription:', error);
                this._myAssignment$.next(null);
            }
        });
    }

    private fetchAllAssignments(): void {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            this._allAssignments$.next([]);
            return;
        }

        this.http.get<any>(this.endpoints.getAllRegionAssignments, { headers }).pipe(
            map((result: any) => {
                if (Array.isArray(result?.assignments)) {
                    return result.assignments.map((a: any) => ({
                        discord_id: a.discord_id,
                        region_key: a.region_key,
                        start_key: null,
                        start_data: null
                    })) as StartAssignment[];
                }
                console.warn('AssignmentService: Unexpected response format for assignments:', result);
                return [];
            }),
            catchError((error) => {
                console.error('AssignmentService: Error fetching assignments:', error);
                return of([]);
            })
        ).subscribe({
            next: (assignments: StartAssignment[]) => {
                this._allAssignments$.next(assignments);
            },
            error: (error) => {
                console.error('AssignmentService: Error in fetchAllAssignments subscription:', error);
                this._allAssignments$.next([]);
            }
        });
    }

    /**
     * @deprecated Use allAssignments$ observable instead. This method creates a new HTTP request each time.
     * The allAssignments$ observable automatically updates when authentication state changes.
     */
    getAllAssignmentsBlankedOut$(): Observable<StartAssignment[]> {
        return this.refreshAssignments$.pipe(
            startWith(void 0),
            switchMap(() => {
                const headers = this.getAuthenticatedHeaders();
                if (!headers) {
                    return of([]);
                }
                console.log('AssignmentService: Fetching all assignments (deprecated method)');
                return this.http.get<any>(this.endpoints.getAllRegionAssignments, { headers })
                    .pipe(
                        map((result: any) => {
                            if (Array.isArray(result?.assignments)) {
                                return result.assignments.map((a: any) => ({
                                    discord_id: a.discord_id,
                                    region_key: a.region_key,
                                    start_key: null,
                                    start_data: null
                                })) as StartAssignment[];
                            }
                            console.warn('AssignmentService: Unexpected response format for assignments:', result);
                            return [];
                        }),
                        catchError((error) => {
                            console.error('AssignmentService: Error fetching assignments:', error);
                            return of([]);
                        })
                    );
            })
        );
    }

    setAllPlayerRegionAssignments$(discordId2RegionKey: Map<string, string>): Observable<boolean> {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            return of(false);
        }

        if (discordId2RegionKey.size === 0) {
            console.warn('AssignmentService: Attempted to set empty assignments');
            return of(false);
        }

        const assignments = Array.from(discordId2RegionKey.entries()).map(([discord_id, region_key]) => {
            if (!discord_id || !region_key) {
                console.warn('AssignmentService: Invalid assignment data:', { discord_id, region_key });
            }
            return {
                discord_id,
                region_key,
                start_key: null,
                start_data: null
            };
        });

        return this.http.post<any>(this.endpoints.setAssignments, { assignments }, { headers }).pipe(
            map((response: any) => {
                if (response.message === 'Assignments updated successfully') {
                    this.refreshAssignments$.next(); // Refresh assignments after successful update
                    this.fetchAllAssignments(); // Also refresh the cached assignments
                    return true;
                }
                console.warn('AssignmentService: Unexpected response:', response);
                return false;
            }),
            catchError((error) => {
                console.error('AssignmentService: Error updating assignments:', error);
                return of(false);
            })
        );
    }
}