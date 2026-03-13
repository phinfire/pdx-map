import { AsyncPipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, map, Observable, Subscription } from 'rxjs';
import { PlayerAndOrRegion } from '../../../../model/megacampaign/PlayerAndOrRegion';
import { DiscordUser } from '../../../../model/social/DiscordUser';
import { DiscordAuthenticationService } from '../../../../services/discord-auth.service';
import { AdminUserTableService } from '../../../../services/megacampaign/admin-user-table.service';
import { McSignupService } from '../../../../services/megacampaign/mc-signup.service';
import { MegaBrowserSessionService } from '../../../../services/megacampaign/mega-browser-session.service';
import { DiscordService } from '../../../discord.service';
import { AssignmentService } from '../../AssignmentService';
import { MegaCampaign } from '../../MegaCampaign';

interface TableAction {
    label: string;
    icon?: string;
    color: 'primary' | 'accent' | 'warn';
    tooltip: string;
    predicate: () => boolean;
    action: () => void;
    useHidden?: boolean;
}

@Component({
    selector: 'app-mcadmin-startassignments',
    imports: [AsyncPipe, MatTableModule, MatSortModule, MatButtonModule, MatCheckboxModule, MatTooltipModule, MatIconModule, MatSelectModule, MatFormFieldModule, FormsModule, MatExpansionModule],
    templateUrl: './mcadmin-startassignments.component.html',
    styleUrl: './mcadmin-startassignments.component.scss',
})
export class McadminStartassignmentsComponent implements OnDestroy {

    protected displayedColumns: string[] = [
        'select', 'index', 'name', 'pick1', 'pick2', 'pick3', 'pick4', 'pick5', 'warning',
        'regionServer', 'region', 'actions'
    ];

    protected newUserToAdd: DiscordUser | null = null;

    @ViewChild('tableSort') tableSort!: MatSort;

    discordAuthService = inject(DiscordAuthenticationService);
    discordService = inject(DiscordService);
    mcSignupService = inject(McSignupService);
    assignmentService = inject(AssignmentService);
    cdr = inject(ChangeDetectorRef);
    private _snackBar = inject(MatSnackBar);
    private megaBrowserSession = inject(MegaBrowserSessionService);
    protected adminUserTableService = inject(AdminUserTableService);

    constructor() {
        this.rows$ = this.adminUserTableService.rows$;
        this.selectedRowIndices$ = this.adminUserTableService.selectedRowIndices$;
        this.hasAnyAssignments$ = this.rows$.pipe(
            map(rows => rows.some(pr => pr.regionClient !== null))
        );
    }

    protected tableData = new MatTableDataSource<PlayerAndOrRegion>([]);

    protected rows$: Observable<PlayerAndOrRegion[]>;
    protected selectedRowIndices$: Observable<Set<number>>;

    private usersSub?: Subscription;
    private rowsSub?: Subscription;
    private sortChangeSub?: Subscription;

    // Derived observables
    protected hasAnyAssignments$: Observable<boolean>;

    protected tableActions: TableAction[] = [
        {
            label: 'Pull',
            color: 'primary',
            tooltip: 'Pull assignments from the server',
            predicate: () => true,
            action: () => this.pullServerToLocal()
        },
        {
            label: 'Auto-Assign',
            icon: 'auto_awesome',
            color: 'accent',
            tooltip: 'Automatically assign players to regions using Hungarian algorithm based on preferences',
            predicate: () => true,
            action: () => this.autoAssignPlayerRegions()
        },
        {
            label: 'Assign',
            icon: 'assignment',
            color: 'accent',
            tooltip: 'Assign selected player to selected region',
            predicate: () => this.adminUserTableService.canTriggerAssign(),
            action: () => this.assignSelectedRowToRegion()
        },
        {
            label: 'Swap',
            icon: 'swap_horiz',
            color: 'accent',
            tooltip: 'Swap assignments between selected players',
            predicate: () => this.adminUserTableService.canSwapRows(),
            action: () => this.swapSelected()
        },
        {
            label: 'Confirm & Publish',
            color: 'primary',
            tooltip: 'Confirm the current assignments and publish them',
            predicate: () => this.canConfirmAssignments(),
            action: () => this.confirmAssignments()
        }
    ];

    protected availableUsers$: Observable<DiscordUser[]> = this.discordService.getGuildUsersAsDiscordUsers('749686922959388752');

    getPick(playerRegion: PlayerAndOrRegion, pickNumber: number): string {
        return playerRegion.getPick(pickNumber);
    }

    getPickNumber(playerRegion: PlayerAndOrRegion): string {
        return playerRegion.getPickNumber();
    }

    isPlayerHappy(playerRegion: PlayerAndOrRegion): boolean {
        return playerRegion.isHappy();
    }

    getServerAssignedRegion(playerRegion: PlayerAndOrRegion): string {
        return playerRegion.regionServer || '';
    }

    getLocalAssignedRegion(playerRegion: PlayerAndOrRegion): string {
        return playerRegion.regionClient || '';
    }

    getPlayerDisplayName(playerRegion: PlayerAndOrRegion): string {
        return playerRegion.user ? playerRegion.getDisplayName() : '-';
    }

    ngOnInit() {
        this.tableData.sortingDataAccessor = (item: PlayerAndOrRegion, property: string): string | number => {
            switch (property) {
                case 'name':
                    return item.getDisplayName();
                case 'pick1':
                    return item.getPick(0);
                case 'pick2':
                    return item.getPick(1);
                case 'pick3':
                    return item.getPick(2);
                case 'pick4':
                    return item.getPick(3);
                case 'pick5':
                    return item.getPick(4);
                case 'regionServer':
                    return item.regionServer || '';
                case 'region':
                    return item.regionClient || '';
                case 'id':
                    return item.getId();
                default:
                    return '';
            }
        };

        // Subscribe to rows changes and update table data
        this.rowsSub = this.rows$.subscribe(rows => {
            this.tableData.data = [...rows];
            this.cdr.markForCheck();
        });

        this.megaBrowserSession.selectedMegaCampaign$.subscribe((campaign: MegaCampaign | null) => {
            this.usersSub?.unsubscribe();
            if (campaign) {
                this.usersSub = combineLatest([
                    this.mcSignupService.allSignups$,
                    this.assignmentService.allAssignments$,
                    campaign.getRegionNameList$(),
                    this.discordService.getGuildUsersAsDiscordUsers('749686922959388752')
                ]).pipe(
                    map(([signups, assignments, regions, guildUsers]) => {
                        const signupsMap = new Map<string, string[]>();
                        signups.forEach(signup => {
                            signupsMap.set(signup.userId, signup.picks);
                        });
                        const userId2AssignedRegion = new Map<string, string>();
                        assignments.forEach(assignment => {
                            if (assignment.user?.id) {
                                userId2AssignedRegion.set(assignment.user.id, assignment.region_key);
                            }
                        });
                        return { signupsMap, assignmentsMap: userId2AssignedRegion, regions, guildUsers };
                    })
                ).subscribe(({ signupsMap, assignmentsMap, regions, guildUsers }) => {
                    this.adminUserTableService.rebuildRowsFromServer(signupsMap, assignmentsMap, regions, guildUsers);
                });
            } else {
                this.adminUserTableService.clearAllRows();
            }
        });
    }

    ngAfterViewInit() {
        this.tableData.sort = this.tableSort;
        this.sortChangeSub = this.tableSort.sortChange.subscribe(() => {
            this.adminUserTableService.clearSelection();
            this.cdr.markForCheck();
        });
    }

    ngOnDestroy() {
        this.usersSub?.unsubscribe();
        this.rowsSub?.unsubscribe();
        this.sortChangeSub?.unsubscribe();
    }

    canConfirmAssignments(): boolean {
        return this.adminUserTableService.canConfirmAssignments();
    }

    confirmAssignments() {
        this.assignmentService.setAllPlayerRegionAssignments$(this.adminUserTableService.getAssignmentsToPublish()).subscribe({
            next: (success) => {
                if (success) {
                    this.openSnackBar("Assignments confirmed successfully!", "OK");
                } else {
                    this.openSnackBar("Failed to confirm assignments", "OK");
                }
            },
            error: (err) => {
                this.openSnackBar("Assignment failed: " + (err?.message || "Unknown error"), "OK");
                console.error('Assignment error:', err);
            }
        });
    }

    openSnackBar(message: string, action: string) {
        this._snackBar.open(message, action, {
            duration: 10000,
        });
    }

    pullServerToLocal() {
        this.adminUserTableService.pullServerToLocal();
        this.openSnackBar('Server assignments loaded into local assignments.', 'OK');
    }

    toggleUserSelection(index: number): void {
        this.adminUserTableService.toggleUserSelection(index);
    }

    isUserSelected(index: number): boolean {
        return this.adminUserTableService.isUserSelected(index);
    }

    toggleAllPlayers(): void {
        this.adminUserTableService.toggleAllPlayers();
    }

    isAllPlayersSelected(): boolean {
        return this.adminUserTableService.isAllPlayersSelected();
    }

    isPlayersIndeterminate(): boolean {
        return this.adminUserTableService.isPlayersIndeterminate();
    }


    removeUserRow(playerRegion: PlayerAndOrRegion): void {
        const userName = playerRegion.getDisplayName();
        const userId = playerRegion.getId();
        this.mcSignupService.removeUserSignup$(userId).subscribe({
            next: (success) => {
                if (success) {
                    this.openSnackBar(`Successfully removed signup for ${userName}`, 'OK');
                    this.adminUserTableService.removeRow(playerRegion);
                    this.mcSignupService.refetchAggregatedRegistrations();
                    this.mcSignupService.refetchAllSignups();
                } else {
                    this.openSnackBar(`Failed to remove signup for ${userName}`, 'OK');
                }
            },
            error: (err) => {
                this.openSnackBar(`Error removing signup: ${err?.message || 'Unknown error'}`, 'OK');
                console.error('Remove signup error:', err);
            }
        });
    }

    clearAssignment(playerRegion: PlayerAndOrRegion): void {
        playerRegion.regionClient = null;
        this.openSnackBar(`Assignment cleared for ${playerRegion.getDisplayName()}`, 'OK');
        this.cdr.markForCheck();
    }

    assignSelectedRowToRegion(): void {
        const rows = this.adminUserTableService.getRows();
        const selectedIndices = this.adminUserTableService.selectedRowIndicesSubject?.value || new Set();
        const selectedIndicesArray = Array.from(selectedIndices);
        const regionRow = rows[selectedIndicesArray.find(i => !rows[i].user)!];
        
        if (this.adminUserTableService.assignSelectedRowToRegion()) {
            this.openSnackBar(`Player assigned to ${regionRow.regionServer}!`, 'OK');
        } else {
            this.openSnackBar('Invalid selection for assignment.', 'OK');
        }
    }

    swapSelected(): void {
        if (this.adminUserTableService.swapSelectedRegions()) {
            this.openSnackBar('Assignments swapped successfully!', 'OK');
        } else {
            this.openSnackBar('Invalid swap selection.', 'OK');
        }
    }

    hasAnyAssignments(): boolean {
        return this.adminUserTableService.getRows().some(pr => pr.regionClient !== null);
    }

    addNewUser(): void {
        if (!this.newUserToAdd) {
            this.openSnackBar('Please select a user to add.', 'OK');
            return;
        }

        const newPlayerRegion = new PlayerAndOrRegion(
            this.newUserToAdd,
            null,
            null,
            []
        );
        this.adminUserTableService.addRow(newPlayerRegion);
        this.openSnackBar(`${this.newUserToAdd.getName()} added to players list.`, 'OK');
        this.newUserToAdd = null;
        this.cdr.markForCheck();
    }

    autoAssignPlayerRegions(): void {
        const result = this.adminUserTableService.autoAssignPlayerRegions();
        if (result.success) {
            this.openSnackBar('Assignments automatically optimized using Hungarian algorithm!', 'OK');
        } else {
            this.openSnackBar(`Error during auto-assignment: ${result.error}`, 'OK');
            if (result.error) console.error('Auto-assignment error:', result.error);
        }
    }
}
