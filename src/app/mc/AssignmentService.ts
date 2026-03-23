import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from "@angular/core";
import { Observable, Subject, catchError, combineLatest, distinctUntilChanged, filter, map, merge, of, shareReplay, startWith, switchMap, take } from "rxjs";
import { DiscordUser } from "../../model/social/DiscordUser";
import { DiscordAuthenticationService } from "../../services/discord-auth.service";
import { MegaService } from '../../services/megacampaign/MegaService';
import { MegaBrowserSessionService } from '../../services/megacampaign/mega-browser-session.service';
import { DiscordService } from "../discord.service";
import { Assignment, MegaStartPosition, StartAssignment } from "./StartAssignment";
import { BackendConfigService } from '../../services/megacampaign/backend-config.service';

@Injectable({
    providedIn: 'root'
})
export class AssignmentService implements OnDestroy {

    private sessionService = inject(MegaBrowserSessionService);
    private discordAuthService = inject(DiscordAuthenticationService);
    private discordService = inject(DiscordService);
    private http = inject(HttpClient);
    private configService = inject(BackendConfigService);

    private destroy$ = new Subject<void>();
    private refreshAssignments$ = new Subject<void>();

    private campaignId$ = this.sessionService.selectedMegaCampaign$.pipe(
        map(c => c?.getId() ?? null),
        distinctUntilChanged()
    );

    private isAuthenticated$ = this.discordAuthService.loggedInUser$.pipe(
        map(user => !!user),
        distinctUntilChanged()
    );

    private meId$ = this.discordAuthService.loggedInUser$.pipe(
        map(user => user?.id || null),
        distinctUntilChanged()
    );

    public readonly allAssignments$: Observable<StartAssignment[]> = merge(
        this.campaignId$,
        this.isAuthenticated$,
        this.refreshAssignments$
    ).pipe(
        switchMap(() => combineLatest([this.campaignId$, this.isAuthenticated$])),
        filter(([id, isAuth]) => isAuth && id !== null),
        switchMap(([campaignId]) => this.fetchAssignmentsInternal(campaignId)),
        startWith([])
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

        return combineLatest([
            this.http.get<Assignment[]>(`${this.configService.getMegaCampaignApiUrl()}/campaigns/${campaignId}/assignments`),
            this.http.get<MegaStartPosition[]>(`${this.configService.getMegaCampaignApiUrl()}/campaigns/${campaignId}/start-positions`).pipe(catchError(() => of([])))
        ]).pipe(
            switchMap(([assignments, startPositions]) => {
                console.log('Fetched assignments:', assignments);
                console.log('Fetched start positions:', startPositions);
                if (!assignments || assignments.length === 0) {
                    return of([]);
                }
                const userIds = assignments.map(a => a.userId);
                const positionsMap = new Map<string, MegaStartPosition>();
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

                        const result =  assignments
                            .map((assignment: Assignment) => {
                                const user = usersMap.get(assignment.userId);
                                if (!user) {
                                    console.warn('AssignmentService: User data not found for assignment:', assignment);
                                    return null;
                                }
                                const position = positionsMap.get(assignment.userId);
                                return {
                                    user,
                                    regionKey: assignment.regionKey,
                                    startKey: position?.startKey || null,
                                    startData: position?.startData || null
                                };
                            })
                            .filter(Boolean) as StartAssignment[];
                        console.log('Processed assignments:', result);
                        return result;
                    })
                );
            }),
            catchError((error) => {
                console.error('AssignmentService: Error fetching assignments:', error);
                return of([]);
            })
        );
    }

    setMyStartPosition$(startKey: string, startData: string): Observable<boolean> {
        return combineLatest([this.campaignId$, this.meId$]).pipe(
            take(1),
            switchMap(([campaignId, userId]) => {
                if (!campaignId || !userId) {
                    return of(false);
                }

                const headers = this.getAuthenticatedHeaders();
                const url = `${this.configService.getMegaCampaignApiUrl()}/campaigns/${campaignId}/start-positions/${userId}`;
                const request = {
                    startKey,
                    startData
                };

                return this.http.post<MegaStartPosition>(url, request, { headers }).pipe(
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

    getAllStartPositions$(): Observable<Map<string, MegaStartPosition>> {
        return this.campaignId$.pipe(
            take(1),
            switchMap(campaignId => {
                if (!campaignId) {
                    return of(new Map());
                }

                const url = `${this.configService.getMegaCampaignApiUrl()}/campaigns/${campaignId}/start-positions`;
                return this.http.get<MegaStartPosition[]>(url).pipe(
                    map((positions: MegaStartPosition[]) => {
                        console.log('Fetched all start positions:', positions);
                        const positionsMap = new Map<string, MegaStartPosition>();
                        positions.forEach(p => positionsMap.set(p.userId, p));
                        return positionsMap;
                    }),
                    catchError((error) => {
                        console.error('AssignmentService: Error fetching all start positions:', error);
                        return of(new Map());
                    })
                );
            })
        );
    }

    getMyStartPosition$(): Observable<MegaStartPosition | null> {
        return combineLatest([this.campaignId$, this.meId$]).pipe(
            take(1),
            switchMap(([campaignId, userId]) => {
                if (!campaignId || !userId) {
                    return of(null);
                }
                const url = `${this.configService.getMegaCampaignApiUrl()}/campaigns/${campaignId}/start-positions/${userId}`;
                return this.http.get<MegaStartPosition>(url).pipe(
                    map((position: MegaStartPosition) => position),
                    catchError((error) => {
                        if (error.status === 404) {
                            return of(null);
                        }
                        console.error('AssignmentService: Error fetching start position:', error);
                        return of(null);
                    })
                );
            })
        );
    }

    setAllPlayerRegionAssignments$(user2RegionKey: Map<DiscordUser, string>): Observable<boolean> {
        return this.campaignId$.pipe(
            take(1),
            switchMap(campaignId => {
                if (!campaignId) {
                    return of(false);
                }

                const headers = this.getAuthenticatedHeaders();
                const url = `${this.configService.getMegaCampaignApiUrl()}/campaigns/${campaignId}/assignments`;
                const assignments = Array.from(user2RegionKey.entries()).map(([user, regionKey]) => {
                    if (!user || !user.id || !regionKey) {
                        console.warn('AssignmentService: Invalid assignment data:', { user, regionKey });
                    }
                    return {
                        userId: user.id,
                        regionKey
                    };
                });
                console.log(
                    "for campaignId:", campaignId,
                    'AssignmentService: Sending assignments to server:', assignments);

                return this.http.put<Assignment[]>(url, { assignments }, { headers }).pipe(
                    map((response: Assignment[]) => {
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

    deletePlayerAssignment$(userId: string): Observable<boolean> {
        return this.campaignId$.pipe(
            take(1),
            switchMap(campaignId => {
                if (!campaignId) {
                    return of(false);
                }

                const headers = this.getAuthenticatedHeaders();
                const url = `${this.configService.getMegaCampaignApiUrl()}/campaigns/${campaignId}/assignments/${userId}`;

                return this.http.delete<void>(url, { headers }).pipe(
                    map(() => {
                        this.refreshAssignments$.next();
                        return true;
                    }),
                    catchError((error) => {
                        console.error('AssignmentService: Error deleting assignment for userId:', userId, error);
                        return of(false);
                    })
                );
            })
        );
    }
}