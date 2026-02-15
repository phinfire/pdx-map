import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from "@angular/core";
import { BehaviorSubject, Observable, Subject, Subscription, catchError, map, of } from "rxjs";
import { DiscordUser } from '../../model/social/DiscordUser';
import { DiscordAuthenticationService } from "../../services/discord-auth.service";
import { StartAssignment } from "./StartAssignment";
import { MCSignupService } from '../../services/megacampaign/legacy-mc-signup-service.service';

@Injectable({
    providedIn: 'root'
})
export class AssignmentService implements OnDestroy {
    mcSignupService = inject(MCSignupService);
    discordAuthService = inject(DiscordAuthenticationService);
    http = inject(HttpClient);

    private readonly endpoints = {
        setMyStartingPosition: `${DiscordAuthenticationService.getApiUrl()}/user/startingPosition`,
        getAllRegionAssignments: `${DiscordAuthenticationService.getApiUrl()}/assignments`,
        setAssignments: `${DiscordAuthenticationService.getApiUrl()}/moderator/assignments`
    };

    private refreshAssignments$ = new Subject<void>();
    private _allAssignments$ = new BehaviorSubject<StartAssignment[]>([]);
    public readonly allAssignments$: Observable<StartAssignment[]> = this._allAssignments$.asObservable();
    
    private loadedUsers: DiscordUser[] = [];
    
    private authSubscription?: Subscription;

    constructor() {
        this.mcSignupService.getAllRegisteredUser$().subscribe(users => {
            this.loadedUsers = users;
            this.fetchAllAssignments();
        });
    }

    ngOnDestroy() {
        this.authSubscription?.unsubscribe();
        this.refreshAssignments$.complete();
        this._allAssignments$.complete();
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

    updateMyAssignment$(assignment: StartAssignment): Observable<boolean> {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            return of(false);
        }

        return this.http.post<any>(this.endpoints.setMyStartingPosition, assignment, { headers }).pipe(
            map(() => {
                this.refreshAssignments$.next();
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
        this.fetchAllAssignments();
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

    private fetchAllAssignments(): void {
        this.http.get<any>(this.endpoints.getAllRegionAssignments).pipe(
            map((result: any) => {
                if (Array.isArray(result?.assignments)) {
                    return result.assignments.map((a: any) => {
                        const user = this.loadedUsers.find(u => u.id === a.discord_id);
                        if (user) {
                            return {
                                user,
                                region_key: a.region_key,
                                start_key: a.start_key ?? null,
                                start_data: a.start_data ?? null
                            } as StartAssignment;
                        }
                        return null;
                    }).filter(Boolean) as StartAssignment[];
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

    setAllPlayerRegionAssignments$(user2RegionKey: Map<DiscordUser, string>): Observable<boolean> {
        const headers = this.getAuthenticatedHeaders();
        if (!headers) {
            return of(false);
        }

        if (user2RegionKey.size === 0) {
            console.warn('AssignmentService: Attempted to set empty assignments');
            return of(false);
        }

        const assignments = Array.from(user2RegionKey.entries()).map(([user, region_key]) => {
            if (!user || !region_key) {
                console.warn('AssignmentService: Invalid assignment data:', { user, region_key });
            }
            return {
                discord_id: user.id,
                region_key,
                start_key: null,
                start_data: null
            };
        });

        return this.http.post<any>(this.endpoints.setAssignments, { assignments }, { headers }).pipe(
            map((response: any) => {
                if (response.message === 'Assignments updated successfully') {
                    this.refreshAssignments$.next();
                    this.fetchAllAssignments();
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