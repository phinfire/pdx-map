import { ChangeDetectorRef, Component, inject, ViewChild } from '@angular/core';
import { DiscordFieldComponent } from '../../discord-field/discord-field.component';
import { DiscordLoginComponent } from '../../discord-login/discord-login.component';
import { MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { DiscordAuthenticationService } from '../../../services/discord-auth.service';
import { MCSignupService } from '../../../services/MCSignupService';
import { DiscordUser } from '../../../model/social/DiscordUser';
import { SimpleTableColumn } from '../../../util/table/SimpleTableColumn';
import { TableColumn } from '../../../util/table/TableColumn';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { calculateAssignments } from '../../../util/lobby';
import { SignupAssetsService } from '../SignupAssetsService';
import { StartAssignment } from '../StartAssignment';
import { AssignmentService } from '../../../services/AssignmentService';
import { combineLatest } from 'rxjs';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-mcadmin',
    imports: [DiscordLoginComponent, DiscordFieldComponent, MatTableModule, MatSortModule, TableComponent, MatButtonModule, MatTooltipModule, MatIconModule, MatSelectModule, MatFormFieldModule, FormsModule],
    templateUrl: './mcadmin.component.html',
    styleUrl: './mcadmin.component.scss'
})
export class MCAdminComponent {

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

    protected columns: TableColumn<DiscordUser>[] = [
        TableColumn.getIndexColumn<DiscordUser>(),
        new SimpleTableColumn<DiscordUser>('img', '', user => user.getAvatarImageUrl(), null, true),
        new SimpleTableColumn<DiscordUser>('name', 'Name', user => user.global_name || user.username),
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
            if (this.sort) {
                this.tableData.sort = this.sort;
            }
        });
        this.mcSignupService.allSignups$.subscribe(signups => {
            this.loadedUserId2Picks.clear();
            signups.forEach(signup => {
                this.loadedUserId2Picks.set(signup.discord_id, signup.picks);
            });
        });
        this.assetService.getRegionNameList$().subscribe(regions => {
            this.loadedRegions = regions.sort((a, b) => a.localeCompare(b));
            this.loadedRegions = [...this.loadedRegions];
            this.selectedRegions = [...regions];
        });
        combineLatest([
            this.mcSignupService.getAllRegisteredUser$(),
            this.assignmentService.allAssignments$
        ]).subscribe(([users, assignments]) => {
            this.serverRegion2Player.clear();
            assignments.forEach(assignment => {
                const user = users.find(u => u.id === assignment.discord_id);
                if (user) {
                    this.serverRegion2Player.set(assignment.region_key, user);
                }
            });
        });
    }

    ngAfterViewInit() {
        this.tableData.sort = this.sort;
    }

    getUsers(): DiscordUser[] {
        return this.loadedUsers;
    }

    getAvailableRegionKeys(): string[] {
        return this.selectedRegions;
    }

    getSelectedRegionCount(): string {
        return `${this.selectedRegions.length} of ${this.loadedRegions.length} regions selected`;
    }

    onRegionSelectionChange(): void {
        this.calculatedRegion2Player.clear();
    }

    resetSelectedRegions(): void {
        this.selectedRegions = [...this.loadedRegions];
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
        if (this.selectedRegions.length < this.loadedUsers.length) {
            this.openSnackBar("Not enough regions selected for the number of users!", "OK");
            return;
        }
        const calced = calculateAssignments(
            this.selectedRegions,
            this.loadedUsers.map(user => {
                return { user: user, picks: this.loadedUserId2Picks.get(user.id)! };
            })
        );
        this.calculatedRegion2Player = calced;
    }

    canConfirmAssignments(): boolean {
        return this.calculatedRegion2Player.size === this.loadedUsers.length;
    }

    confirmAssignments() {
        const player2region: Map<string, string> = new Map();
        this.calculatedRegion2Player.forEach((user, region) => {
            player2region.set(user.id, region);
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
}