import { ChangeDetectorRef, Component, inject, ViewChild } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { DiscordUser } from '../../../../model/social/DiscordUser';
import { DiscordAuthenticationService } from '../../../../services/discord-auth.service';
import { calculateAssignments } from '../../../../util/lobby';
import { SimpleTableColumn } from '../../../../util/table/SimpleTableColumn';
import { TableColumn } from '../../../../util/table/TableColumn';
import { AssignmentService } from '../../AssignmentService';
import { MCSignupService } from '../../MCSignupService';
import { SignupAssetsService } from '../../SignupAssetsService';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TableComponent } from '../../../vic3-country-table/vic3-country-table.component';
import { TableColumnBuilder } from '../../../../util/table/TableColumnBuilder';

@Component({
  selector: 'app-mcadmin-startassignments',
  imports: [MatTableModule, MatSortModule, TableComponent, MatButtonModule, MatTooltipModule, MatIconModule, MatSelectModule, MatFormFieldModule, FormsModule, MatExpansionModule],
  templateUrl: './mcadmin-startassignments.component.html',
  styleUrl: './mcadmin-startassignments.component.scss',
})
export class McadminStartassignmentsComponent {

    protected swapUser1: string = '';
    protected swapUser2: string = '';

    swapAssignments() {
        if (!this.swapUser1 || !this.swapUser2 || this.swapUser1 === this.swapUser2) {
            this.openSnackBar('Please select two different users to swap.', 'OK');
            return;
        }
        let region1: string | undefined = undefined;
        let region2: string | undefined = undefined;
        for (const [region, user] of this.calculatedRegion2Player.entries()) {
            if (user.id === this.swapUser1) region1 = region;
            if (user.id === this.swapUser2) region2 = region;
        }
        if (!region1 || !region2) {
            this.openSnackBar('Both users must have an assigned region to swap.', 'OK');
            return;
        }
        const user1 = this.loadedUsers.find(u => u.id === this.swapUser1);
        const user2 = this.loadedUsers.find(u => u.id === this.swapUser2);
        if (!user1 || !user2) {
            this.openSnackBar('User not found.', 'OK');
            return;
        }
        this.calculatedRegion2Player.set(region1, user2);
        this.calculatedRegion2Player.set(region2, user1);
        this.openSnackBar('Assignments swapped successfully!', 'OK');
        this.swapUser1 = '';
        this.swapUser2 = '';
        this.cdr.markForCheck();
    }

    redirectToAdmin() {
        const currentUrl = window.location.pathname;
        if (currentUrl.endsWith('/admin')) {
            window.location.href = currentUrl.slice(0, -6);
        } else {
            console.warn("Current route " + currentUrl + " does not end with /admin, cannot go back");
        }
    }

    @ViewChild(MatSort) sort!: MatSort;

    discordAuthService = inject(DiscordAuthenticationService);
    mcSignupService = inject(MCSignupService);
    assetService = inject(SignupAssetsService);
    assignmentService = inject(AssignmentService);
    cdr = inject(ChangeDetectorRef);
    private _snackBar = inject(MatSnackBar);

    protected tableData = new MatTableDataSource<DiscordUser>([]);

    protected loadedRegions: string[] = [];
    protected loadedUsers: DiscordUser[] = [];
    protected loadedUserId2Picks: Map<string, string[]> = new Map();
    protected calculatedRegion2Player: Map<string, DiscordUser> = new Map();
    protected serverRegion2Player: Map<string, DiscordUser> = new Map();
    protected selectedUserToRemove: string = '';
    protected selectedRegions: string[] = [];
    protected selectedPlayers: DiscordUser[] = [];

    protected columns: TableColumn<DiscordUser>[] = [
        TableColumnBuilder.getIndexColumn<DiscordUser>(),
        new SimpleTableColumn<DiscordUser>('img', '', user => user.getAvatarImageUrl(), null, true),
        new SimpleTableColumn<DiscordUser>('name', 'Name', user => user.getName()),
        new SimpleTableColumn<DiscordUser>('pick1', 'I', user => this.getPick(user, 0)),
        new SimpleTableColumn<DiscordUser>('pick2', 'II', user => this.getPick(user, 1)),
        new SimpleTableColumn<DiscordUser>('pick3', 'III', user => this.getPick(user, 2)),
        new SimpleTableColumn<DiscordUser>('pick4', 'IV', user => this.getPick(user, 3)),
        new SimpleTableColumn<DiscordUser>('pick5', 'V', user => this.getPick(user, 4)),
    ];

    protected getColumns() {
        return this.columns.concat(this.assignColumnsToDisplay);
    }

    protected assignColumnsToDisplay: TableColumn<DiscordUser>[] = [
        new SimpleTableColumn<DiscordUser>('regionServer', 'Assigned Region (Server)', user => {
            return Array.from(this.serverRegion2Player.entries()).find(([region, assignedUser]) => assignedUser.id === user.id)?.[0];
        }),
        new SimpleTableColumn<DiscordUser>('region', 'Assigned Region (Local)', user => {
            return Array.from(this.calculatedRegion2Player.entries()).find(([region, assignedUser]) => assignedUser.id === user.id)?.[0];
        }),
        new SimpleTableColumn<DiscordUser>('wasPickNumber', 'Pick #', user => {
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
            return userPicks.indexOf(assignedRegion) != -1 ? userPicks.indexOf(assignedRegion) + 1 : '';
        }),
        new SimpleTableColumn<DiscordUser>('happy', 'Happy', user => {
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
            return userPicks.indexOf(assignedRegion) !== -1 ? '✔️' : '❌';
        }),
    ];

    ngOnInit() {
        this.tableData.sortingDataAccessor = (item: DiscordUser, property: string): string | number => {
            switch (property) {
                case 'avatar':
                    return item.global_name || item.username;
                case 'name':
                    return item.global_name || item.username;
                case 'global_name':
                    return item.global_name;
                case 'username':
                    return item.username;
                case 'id':
                    return item.id;
                case 'discriminator':
                    return item.discriminator;
                default:
                    return '';
            }
        };
        this.mcSignupService.getAllRegisteredUser$().subscribe(users => {
            this.loadedUsers = users;
            this.tableData.data = users;
            this.selectedPlayers = [...users];
            this.swapUser1 = '';
            this.swapUser2 = '';
            if (this.sort) {
                this.tableData.sort = this.sort;
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
        this.tableData.sort = this.sort;
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
        this.calculatedRegion2Player.clear();
    }

    onPlayerSelectionChange(): void {
        this.calculatedRegion2Player.clear();
    }

    resetSelectedRegions(): void {
        this.selectedRegions = [...this.loadedRegions];
        this.calculatedRegion2Player.clear();
    }

    resetSelectedPlayers(): void {
    this.selectedPlayers = [...this.loadedUsers];
        this.calculatedRegion2Player.clear();
    }

    getPick(user: DiscordUser, pickNumber: number): string {
        if (pickNumber < 0) {
            throw new Error('pickNumber must be >= 0');
        }
        const picks = this.loadedUserId2Picks.get(user.id);
        if (picks && picks.length >= pickNumber) {
            return picks[pickNumber];
        }
        return "-";
    }

    getAssignButtonTooltip(): string {
        return "Assign users to the available regions using the hungarian algorithm";
    }

    assign() {
        const users = this.getUsers();
        if (this.selectedRegions.length < users.length) {
            this.openSnackBar("Not enough regions selected for the number of users!", "OK");
            return;
        }
        const calced = calculateAssignments(
            this.selectedRegions,
            users.map(user => {
                return { user: user, picks: this.loadedUserId2Picks.get(user.id)! };
            })
        );
        this.calculatedRegion2Player = calced;
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
}
