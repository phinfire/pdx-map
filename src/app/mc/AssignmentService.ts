import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from "@angular/core";
import { Observable, Subject, catchError, combineLatest, distinctUntilChanged, filter, map, merge, of, shareReplay, startWith, switchMap } from "rxjs";
import { DiscordUser } from "../../model/social/DiscordUser";
import { DiscordAuthenticationService } from "../../services/discord-auth.service";
import { MegaService } from '../../services/megacampaign/MegaService';
import { MegaBrowserSessionService } from '../../services/megacampaign/mega-browser-session.service';
import { DiscordService } from "../discord.service";
import { StartAssignment } from "./StartAssignment";

@Injectable({
    providedIn: 'root'
})
export class AssignmentService implements OnDestroy {

    private sessionService = inject(MegaBrowserSessionService);
    private megaService = inject(MegaService);
    private discordAuthService = inject(DiscordAuthenticationService);
    private discordService = inject(DiscordService);
    private http = inject(HttpClient);

    private destroy$ = new Subject<void>();
    private refreshAssignments$ = new Subject<void>();

    private campaignId$ = this.sessionService.selectedMegaCampaign$.pipe(
        map(c => c?.getId() ?? null),
        distinctUntilChanged(),
        shareReplay(1)
    );

    private isAuthenticated$ = this.discordAuthService.loggedInUser$.pipe(
        map(user => !!user),
        distinctUntilChanged(),
        shareReplay(1)
    );

    private meId$ = this.discordAuthService.loggedInUser$.pipe(
        map(user => user?.id || null),
        distinctUntilChanged(),
        shareReplay(1)
    );

    public readonly allAssignments$: Observable<StartAssignment[]> = merge(
        this.campaignId$,
        this.isAuthenticated$,
        this.refreshAssignments$
    ).pipe(
        switchMap(() => combineLatest([this.campaignId$, this.isAuthenticated$])),
        filter(([id, isAuth]) => isAuth && id !== null),
        switchMap(([campaignId]) => this.fetchAssignmentsInternal(campaignId)),
        startWith([]),
        shareReplay(1)
    );

    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
        this.refreshAssignments$.complete();
    }

    private getAuthenticatedHeaders(): HttpHeaders {
        const authHeader = this.discordAuthService.getAuthenticationHeader();
        return new HttpHeaders({
            'Content-Type': 'application/json',
            ...authHeader
        });
    }

    refreshAssignments(): void {
        this.refreshAssignments$.next();
    }

    private fetchAssignmentsInternal(campaignId: number | null): Observable<StartAssignment[]> {
        if (!campaignId) {
            return of([]);
        }

        const assignmentUrl = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/assignments`;
        const startPositionUrl = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/start-positions`;

        return combineLatest([
            this.http.get<any[]>(assignmentUrl),
            this.http.get<any[]>(startPositionUrl).pipe(catchError(() => of([])))
        ]).pipe(
            switchMap(([assignments, startPositions]) => {
                if (!assignments || assignments.length === 0) {
                    return of([]);
                }

                const userIds = assignments.map(a => a.userId);
                const positionsMap = new Map<string, any>();
                startPositions.forEach(p => positionsMap.set(p.userId, p));

                return this.discordService.getUsersByIds(userIds).pipe(
                    map((usersResponse: any) => {
                        const usersMap = new Map<string, DiscordUser>();
                        Object.entries(usersResponse.users).forEach(([userId, userData]: [string, any]) => {
                            try {
                                const user = DiscordUser.fromApiJson(userData);
                                usersMap.set(userId, user);
                            } catch (error) {
                                console.error('AssignmentService: Error converting user data for userId:', userId, error);
                            }
                        });

                        return assignments
                            .map(a => {
                                const user = usersMap.get(a.userId);
                                if (!user) {
                                    console.warn('AssignmentService: User data not found for assignment:', a);
                                    return null;
                                }
                                const position = positionsMap.get(a.userId);
                                return {
                                    user,
                                    region_key: a.regionKey,
                                    start_key: position?.startKey || null,
                                    start_data: position?.startData || null
                                } as StartAssignment;
                            })
                            .filter(Boolean) as StartAssignment[];
                    })
                );
            }),
            catchError((error) => {
                console.error('AssignmentService: Error fetching assignments:', error);
                return of([]);
            })
        );
    }

    setMyStartPosition$(startKey: string, startData: any): Observable<boolean> {
        return combineLatest([this.campaignId$, this.meId$]).pipe(
            switchMap(([campaignId, userId]) => {
                if (!campaignId || !userId) {
                    return of(false);
                }

                const headers = this.getAuthenticatedHeaders();
                const url = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/start-positions/${userId}`;

                return this.http.post<any>(url, { startKey, startData }, { headers }).pipe(
                    map(() => {
                        this.refreshAssignments$.next();
                        return true;
                    }),
                    catchError((error) => {
                        console.error('AssignmentService: Error setting start position:', error);
                        return of(false);
                    })
                );
            })
        );
    }

    getAllStartPositions$(): Observable<Map<string, any>> {
        return this.campaignId$.pipe(
            switchMap(campaignId => {
                if (!campaignId) {
                    return of(new Map());
                }

                const url = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/start-positions`;
                return this.http.get<any[]>(url).pipe(
                    map((positions: any[]) => {
                        const positionsMap = new Map<string, any>();
                        positions.forEach(p => positionsMap.set(p.userId, p));
                        return positionsMap;
                    }),
                    catchError(() => of(new Map()))
                );
            })
        );
    }

    getMyStartPosition$(): Observable<any> {
        return combineLatest([this.campaignId$, this.meId$]).pipe(
            switchMap(([campaignId, userId]) => {
                if (!campaignId || !userId) {
                    return of(null);
                }

                const url = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/start-positions/${userId}`;
                return this.http.get<any>(url).pipe(
                    catchError(() => of(null))
                );
            })
        );
    }

    setAllPlayerRegionAssignments$(user2RegionKey: Map<DiscordUser, string>): Observable<boolean> {
        return this.campaignId$.pipe(
            switchMap(campaignId => {
                if (!campaignId) {
                    return of(false);
                }

                const headers = this.getAuthenticatedHeaders();
                const url = `${this.megaService.getServiceURL()}/campaigns/${campaignId}/assignments`;
                if (user2RegionKey.size === 0) {
                    console.warn('AssignmentService: Attempted to set empty assignments');
                    return of(false);
                }
                const assignments = Array.from(user2RegionKey.entries()).map(([user, regionKey]) => {
                    if (!user || !user.id || !regionKey) {
                        console.warn('AssignmentService: Invalid assignment data:', { user, regionKey });
                    }
                    return {
                        userId: user.id,
                        regionKey
                    };
                });

                return this.http.put<any[]>(url, { assignments }, { headers }).pipe(
                    map((response: any[]) => {
                        if (Array.isArray(response)) {
                            this.refreshAssignments$.next();
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
            })
        );
    }
}