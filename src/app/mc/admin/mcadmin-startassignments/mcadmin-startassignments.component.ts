import { ChangeDetectorRef, Component, inject, ViewChild } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { BehaviorSubject, Observable, combineLatest, map, shareReplay } from 'rxjs';
import { DiscordUser } from '../../../../model/social/DiscordUser';
import { DiscordAuthenticationService } from '../../../../services/discord-auth.service';
import { DiscordService } from '../../../discord.service';
import { calculateAssignments } from '../../../../util/lobby';
import { AssignmentService } from '../../AssignmentService';
import { SignupAssetsService } from '../../SignupAssetsService';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MCSignupService } from '../../../../services/megacampaign/legacy-mc-signup-service.service';

@Component({
  selector: 'app-mcadmin-startassignments',
  imports: [AsyncPipe, MatTableModule, MatSortModule, MatButtonModule, MatCheckboxModule, MatTooltipModule, MatIconModule, MatSelectModule, MatFormFieldModule, FormsModule, MatExpansionModule],
  templateUrl: './mcadmin-startassignments.component.html',
  styleUrl: './mcadmin-startassignments.component.scss',
})
export class McadminStartassignmentsComponent {

    protected playerDisplayedColumns: string[] = [
        'select', 'index', 'name', 'pick1', 'pick2', 'pick3', 'pick4', 'pick5', 'warning',
        'regionServer', 'region', 'actions'
    ];

    protected regionDisplayedColumns: string[] = [
        'select', 'index', 'name', 'assignedPlayerServer', 'assignedPlayerLocal', 'warning', 'actions'
    ];

    protected swapUser1: string = '';
    protected swapUser2: string = '';
    protected singleAssignmentUserId: string = '';
    protected singleAssignmentRegion: string = '';
    protected newUserToAdd: DiscordUser | null = null;



    @ViewChild('playerSort') playerSort!: MatSort;
    @ViewChild('regionSort') regionSort!: MatSort;

    discordAuthService = inject(DiscordAuthenticationService);
    discordService = inject(DiscordService);
    mcSignupService = inject(MCSignupService);
    assetService = inject(SignupAssetsService);
    assignmentService = inject(AssignmentService);
    cdr = inject(ChangeDetectorRef);
    private _snackBar = inject(MatSnackBar);

    protected playerTableData = new MatTableDataSource<DiscordUser>([]);
    protected regionTableData = new MatTableDataSource<string>([]);

    protected loadedRegions: string[] = [];
    protected loadedUsers: DiscordUser[] = [];
    protected loadedUserId2Picks: Map<string, string[]> = new Map();

    protected loadedUsers$ = new BehaviorSubject<DiscordUser[]>([]);
    protected availableUsers$: Observable<DiscordUser[]> = combineLatest([
        this.loadedUsers$,
        this.discordService.getGuildUsersAsDiscordUsers('749686922959388752')
    ]).pipe(
        map(([loadedUsers, allUsers]: [DiscordUser[], DiscordUser[]]) => {
            const loadedUserIds = new Set(loadedUsers.map((u: DiscordUser) => u.id));
            return allUsers.filter((user: DiscordUser) => !loadedUserIds.has(user.id));
        }),
        shareReplay(1)
    );

    protected calculatedRegion2Player: Map<string, DiscordUser> = new Map();
    protected serverRegion2Player: Map<string, DiscordUser> = new Map();
    protected selectedUserToRemove: string = '';
    protected selectedRegions: string[] = [];
    protected selectedPlayers: DiscordUser[] = [];
    protected selectedUserIds: Set<string> = new Set();
    protected selectedRegionIds: Set<string> = new Set();

    getPick(user: DiscordUser, pickNumber: number): string {
        if (pickNumber < 0) {
            throw new Error('pickNumber must be >= 0');
        }
        const picks = this.loadedUserId2Picks.get(user.id);
        if (picks && picks.length > pickNumber) {
            return picks[pickNumber];
        }
        return "-";
    }

    getPickNumber(user: DiscordUser): string {
        const userPicks = this.loadedUserId2Picks.get(user.id);
        if (!userPicks) {
            return '';
        }   
        let assignedRegion = '';
        for (const [region, assignedUser] of this.calculatedRegion2Player) {
            if (assignedUser.id === user.id) {
                assignedRegion = region;
                break;
            }
        }
        if (!assignedRegion) {
            return '';
        }
        return userPicks.indexOf(assignedRegion) != -1 ? (userPicks.indexOf(assignedRegion) + 1).toString() : '';
    }

    isUserHappy(user: DiscordUser): boolean {
        const userPicks = this.loadedUserId2Picks.get(user.id);
        if (!userPicks) {
            return false;
        }
        let assignedRegion = '';
        for (const [region, assignedUser] of this.calculatedRegion2Player) {
            if (assignedUser.id === user.id) {
                assignedRegion = region;
                break;
            }
        }
        if (!assignedRegion) {
            return false;
        }
        return userPicks.indexOf(assignedRegion) !== -1;
    }

    getServerAssignedRegion(user: DiscordUser): string {
        for (const [region, assignedUser] of this.serverRegion2Player) {
            if (assignedUser.id === user.id) {
                return region;
            }
        }
        return '';
    }

    getLocalAssignedRegion(user: DiscordUser): string {
        for (const [region, assignedUser] of this.calculatedRegion2Player) {
            if (assignedUser.id === user.id) {
                return region;
            }
        }
        return '';
    }

    ngOnInit() {
        this.playerTableData.sortingDataAccessor = (item: DiscordUser, property: string): string | number => {
            switch (property) {
                case 'name':
                    return item.global_name || item.username;
                case 'global_name':
                    return item.global_name;
                case 'username':
                    return item.username;
                case 'pick1':
                    return this.getPick(item, 0);
                case 'pick2':
                    return this.getPick(item, 1);
                case 'pick3':
                    return this.getPick(item, 2);
                case 'pick4':
                    return this.getPick(item, 3);
                case 'pick5':
                    return this.getPick(item, 4);
                case 'regionServer':
                    return this.getServerAssignedRegion(item);
                case 'region':
                    return this.getLocalAssignedRegion(item);
                case 'id':
                    return item.id;
                case 'discriminator':
                    return item.discriminator;
                default:
                    return '';
            }
        };
        this.regionTableData.sortingDataAccessor = (item: string, property: string): string | number => {
            switch (property) {
                case 'name':
                    return item;
                case 'assignedPlayerServer':
                    return this.getServerAssignedPlayerForRegion(item)?.global_name || 
                           this.getServerAssignedPlayerForRegion(item)?.username || '';
                case 'assignedPlayerLocal':
                    return this.getAssignedPlayerForRegion(item)?.global_name || 
                           this.getAssignedPlayerForRegion(item)?.username || '';
                default:
                    return '';
            }
        };
        this.mcSignupService.getAllRegisteredUser$().subscribe(users => {
            this.loadedUsers = users;
            this.playerTableData.data = users;
            this.selectedPlayers = [...users];
            if (this.playerSort) {
                this.playerTableData.sort = this.playerSort;
            }
        });
        this.mcSignupService.allSignups$.subscribe(signups => {
            this.loadedUserId2Picks.clear();
            signups.forEach(signup => {
                if (signup.user) {
                    this.loadedUserId2Picks.set(signup.user.id, signup.picks);
                }
            });
        });
        this.assetService.getRegionNameList$().subscribe(regions => {
            this.loadedRegions = regions.sort((a, b) => a.localeCompare(b));
            this.loadedRegions = [...this.loadedRegions];
            this.selectedRegions = [...regions];
            this.regionTableData.data = [...regions];
        });
        this.assignmentService.allAssignments$.subscribe((assignments) => {
            this.serverRegion2Player.clear();
            assignments.forEach(assignment => {
                if (assignment.user) {
                    this.serverRegion2Player.set(assignment.region_key, assignment.user);
                }
            });
        });
    }

    ngAfterViewInit() {
        this.playerTableData.sort = this.playerSort;
        this.regionTableData.sort = this.regionSort;
    }

    getUsers(): DiscordUser[] {
        if (this.selectedPlayers && this.selectedPlayers.length > 0 && this.selectedPlayers.length !== this.loadedUsers.length) {
            return this.selectedPlayers;
        }
        return this.loadedUsers;
    }

    getAvailableRegionKeys(): string[] {
        return this.selectedRegions;
    }

    getSelectedRegionCount(): string {
        return `${this.selectedRegions.length} of ${this.loadedRegions.length} regions selected`;
    }

    getSelectedPlayerCount(): string {
        return `${this.selectedPlayers.length || this.loadedUsers.length} of ${this.loadedUsers.length} players selected`;
    }

    onRegionSelectionChange(): void {
        this.cdr.markForCheck();
    }

    onPlayerSelectionChange(): void {
        this.cdr.markForCheck();
    }

    resetSelectedRegions(): void {
        this.selectedRegions = [...this.loadedRegions];
        this.cdr.markForCheck();
    }

    resetSelectedPlayers(): void {
        this.selectedPlayers = [...this.loadedUsers];
        this.cdr.markForCheck();
    }



    canConfirmAssignments(): boolean {
        return this.calculatedRegion2Player.size === this.getUsers().length;
    }

    confirmAssignments() {
        const player2region: Map<DiscordUser, string> = new Map();
        this.calculatedRegion2Player.forEach((user, region) => {
            player2region.set(user, region);
        });
        this.assignmentService.setAllPlayerRegionAssignments$(player2region).subscribe({
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
            duration: 3000,
        });
    }

    removeUserSignup() {
        if (!this.selectedUserToRemove) {
            this.openSnackBar("Please select a user to remove", "OK");
            return;
        }
        const userToRemove = this.loadedUsers.find(user => user.id === this.selectedUserToRemove);
        const userName = userToRemove ? (userToRemove.global_name || userToRemove.username) : this.selectedUserToRemove;
        this.mcSignupService.removeUserSignup$(this.selectedUserToRemove).subscribe({
            next: (success) => {
                if (success) {
                    this.openSnackBar(`Successfully removed signup for ${userName}`, "OK");
                    this.selectedUserToRemove = '';
                    this.mcSignupService.refetchAggregatedRegistrations();
                    this.mcSignupService.refetchAllSignups();
                } else {
                    this.openSnackBar(`Failed to remove signup for ${userName}`, "OK");
                }
            },
            error: (err) => {
                this.openSnackBar(`Error removing signup: ${err?.message || "Unknown error"}`, "OK");
                console.error('Remove signup error:', err);
            }
        });
    }

    compareUsers(u1: DiscordUser, u2: DiscordUser): boolean {
        return u1 && u2 && u1.id === u2.id;
    }
    
    pullServerToLocal() {
        this.calculatedRegion2Player = new Map(this.serverRegion2Player);
        this.openSnackBar('Server assignments loaded into local assignments.', 'OK');
        this.cdr.markForCheck();
    }

    getCurrentAssignmentForUser(userId: string): string | undefined {
        for (const [region, user] of this.calculatedRegion2Player) {
            if (user.id === userId) {
                return region;
            }
        }
        return undefined;
    }

    toggleUserSelection(userId: string): void {
        if (this.selectedUserIds.has(userId)) {
            this.selectedUserIds.delete(userId);
        } else {
            this.selectedUserIds.add(userId);
        }
    }

    isUserSelected(userId: string): boolean {
        return this.selectedUserIds.has(userId);
    }

    toggleAllPlayers(): void {
        if (this.isAllPlayersSelected()) {
            this.selectedUserIds.clear();
        } else {
            this.selectedUserIds.clear();
            this.loadedUsers.forEach(user => this.selectedUserIds.add(user.id));
        }
    }

    isAllPlayersSelected(): boolean {
        return this.loadedUsers.length > 0 && this.selectedUserIds.size === this.loadedUsers.length;
    }

    isPlayersIndeterminate(): boolean {
        return this.selectedUserIds.size > 0 && this.selectedUserIds.size < this.loadedUsers.length;
    }

    toggleAllRegions(): void {
        if (this.isAllRegionsSelected()) {
            this.selectedRegionIds.clear();
        } else {
            this.selectedRegionIds.clear();
            this.loadedRegions.forEach(region => this.selectedRegionIds.add(region));
        }
    }

    isAllRegionsSelected(): boolean {
        return this.loadedRegions.length > 0 && this.selectedRegionIds.size === this.loadedRegions.length;
    }

    isRegionsIndeterminate(): boolean {
        return this.selectedRegionIds.size > 0 && this.selectedRegionIds.size < this.loadedRegions.length;
    }

    removeUserRow(user: DiscordUser): void {
        const userName = user.global_name || user.username;
        this.selectedUserToRemove = user.id;
        this.mcSignupService.removeUserSignup$(user.id).subscribe({
            next: (success) => {
                if (success) {
                    this.openSnackBar(`Successfully removed signup for ${userName}`, 'OK');
                    this.selectedUserToRemove = '';
                    this.selectedUserIds.delete(user.id);
                    this.loadedUsers = this.loadedUsers.filter(u => u.id !== user.id);
                    this.loadedUsers$.next(this.loadedUsers);
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

    canSwapFromTable(): boolean {
        return this.selectedUserIds.size === 2 || this.selectedRegionIds.size === 2;
    }

    swapSelectedFromTables(): void {
        // Swap 2 players
        if (this.selectedUserIds.size === 2 && this.selectedRegionIds.size === 0) {
            this.swapSelectedPlayers();
            return;
        }
        // Swap 2 regions
        if (this.selectedRegionIds.size === 2 && this.selectedUserIds.size === 0) {
            this.swapSelectedRegions();
            return;
        }
        this.openSnackBar('Select exactly 2 players OR 2 regions to swap.', 'OK');
    }

    swapSelectedPlayers(): void {
        const selectedIds = Array.from(this.selectedUserIds);
        const swapUser1 = selectedIds[0];
        const swapUser2 = selectedIds[1];
        let region1: string | undefined = undefined;
        let region2: string | undefined = undefined;
        for (const [region, user] of this.calculatedRegion2Player.entries()) {
            if (user.id === swapUser1) region1 = region;
            if (user.id === swapUser2) region2 = region;
        }
        if (!region1 || !region2) {
            this.openSnackBar('Both players must have an assigned region to swap.', 'OK');
            return;
        }
        const user1 = this.loadedUsers.find(u => u.id === swapUser1);
        const user2 = this.loadedUsers.find(u => u.id === swapUser2);
        if (!user1 || !user2) {
            this.openSnackBar('User not found.', 'OK');
            return;
        }
        this.calculatedRegion2Player.set(region1, user2);
        this.calculatedRegion2Player.set(region2, user1);
        this.openSnackBar('Assignments swapped successfully!', 'OK');
        this.selectedUserIds.clear();
        this.cdr.markForCheck();
    }

    swapSelectedRegions(): void {
        const selectedRegions = Array.from(this.selectedRegionIds);
        const region1 = selectedRegions[0];
        const region2 = selectedRegions[1];

        const user1 = this.calculatedRegion2Player.get(region1);
        const user2 = this.calculatedRegion2Player.get(region2);

        if (!user1 || !user2) {
            this.openSnackBar('Both regions must have an assigned player to swap.', 'OK');
            return;
        }

        this.calculatedRegion2Player.set(region1, user2);
        this.calculatedRegion2Player.set(region2, user1);
        this.openSnackBar('Regions swapped successfully!', 'OK');
        this.selectedRegionIds.clear();
        this.cdr.markForCheck();
    }

    assignSelectedUsersAndRegions(): void {
        const userIds = Array.from(this.selectedUserIds);
        const regionIds = Array.from(this.selectedRegionIds);

        // Case 1: Exactly 1 user and 1 region
        if (userIds.length === 1 && regionIds.length === 1) {
            const user = this.loadedUsers.find(u => u.id === userIds[0]);
            const region = regionIds[0];
            if (!user) {
                this.openSnackBar('User not found.', 'OK');
                return;
            }
            this.assignUserToRegion(user, region);
            this.selectedUserIds.clear();
            this.selectedRegionIds.clear();
            this.cdr.markForCheck();
            return;
        }

        // Case 2: Multiple users and/or regions - use Hungarian algorithm
        if (userIds.length > 0 && regionIds.length > 0) {
            const users = this.loadedUsers.filter(u => userIds.includes(u.id));
            const regions = regionIds;
            if (users.length < regions.length) {
                this.openSnackBar('Not enough users for the selected regions.', 'OK');
                return;
            }
            const calced = calculateAssignments(
                regions,
                users.map(user => ({
                    user: user,
                    picks: this.loadedUserId2Picks.get(user.id)!
                }))
            );
            this.calculatedRegion2Player = calced;
            this.selectedUserIds.clear();
            this.selectedRegionIds.clear();
            this.cdr.markForCheck();
            return;
        }

        this.openSnackBar('Select at least 1 user and 1 region to assign.', 'OK');
    }

    canAssignFromTables(): boolean {
        const hasUsers = this.selectedUserIds.size > 0;
        const hasRegions = this.selectedRegionIds.size > 0;
        return hasUsers && hasRegions;
    }

    private assignUserToRegion(user: DiscordUser, region: string): void {
        // Remove the user from their current region if assigned
        const currentRegion = this.getCurrentAssignmentForUser(user.id);
        if (currentRegion) {
            this.calculatedRegion2Player.delete(currentRegion);
        }

        // Remove any user currently assigned to the target region
        this.calculatedRegion2Player.forEach((value, key) => {
            if (key === region) {
                this.calculatedRegion2Player.delete(key);
            }
        });

        this.calculatedRegion2Player.set(region, user);
        this.openSnackBar(`${user.global_name || user.username} assigned to ${region}`, 'OK');
    }

    toggleRegionSelection(region: string): void {
        if (this.selectedRegionIds.has(region)) {
            this.selectedRegionIds.delete(region);
        } else {
            this.selectedRegionIds.add(region);
        }
    }

    isRegionSelected(region: string): boolean {
        return this.selectedRegionIds.has(region);
    }

    getAssignedPlayerForRegion(region: string): DiscordUser | undefined {
        return this.calculatedRegion2Player.get(region);
    }

    getServerAssignedPlayerForRegion(region: string): DiscordUser | undefined {
        return this.serverRegion2Player.get(region);
    }

    isRegionAssigned(region: string): boolean {
        return this.calculatedRegion2Player.has(region);
    }

    removeRegionRow(region: string): void {
        // Remove any assignments for this region
        this.calculatedRegion2Player.delete(region);
        this.selectedRegionIds.delete(region);
        this.cdr.markForCheck();
        this.openSnackBar(`Region ${region} unassigned.`, 'OK');
    }

    updateSingleAssignment() {
        if (!this.singleAssignmentUserId || !this.singleAssignmentRegion) {
            this.openSnackBar('Please select both a user and a region.', 'OK');
            return;
        }

        const user = this.loadedUsers.find(u => u.id === this.singleAssignmentUserId);
        if (!user) {
            this.openSnackBar('User not found.', 'OK');
            return;
        }

        // Remove the user from their current region if assigned
        const currentRegion = this.getCurrentAssignmentForUser(this.singleAssignmentUserId);
        if (currentRegion) {
            this.calculatedRegion2Player.delete(currentRegion);
        }

        // Remove any user currently assigned to the target region
        this.calculatedRegion2Player.forEach((value, key) => {
            if (key === this.singleAssignmentRegion) {
                this.calculatedRegion2Player.delete(key);
            }
        });

        // Assign the user to the new region
        this.calculatedRegion2Player.set(this.singleAssignmentRegion, user);
        this.openSnackBar(`${user.global_name || user.username} assigned to ${this.singleAssignmentRegion}`, 'OK');
        this.cdr.markForCheck();
    }

    addNewUser(): void {
        if (!this.newUserToAdd) {
            this.openSnackBar('Please select a user to add.', 'OK');
            return;
        }

        // Add user to the loaded users
        this.loadedUsers.push(this.newUserToAdd);
        this.playerTableData.data = [...this.loadedUsers];
        this.loadedUsers$.next(this.loadedUsers);

        // Initialize picks for the new user (empty array)
        this.loadedUserId2Picks.set(this.newUserToAdd.id, []);

        this.openSnackBar(`${this.newUserToAdd.global_name || this.newUserToAdd.username} added to players list.`, 'OK');
        this.newUserToAdd = null;
        this.cdr.markForCheck();
    }
}
