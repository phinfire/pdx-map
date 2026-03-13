import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { some } from 'd3';
import { PlayerAndOrRegion } from '../../model/megacampaign/PlayerAndOrRegion';
import { DiscordUser } from '../../model/social/DiscordUser';
import { calculateAssignments } from '../../util/lobby';

@Injectable({
    providedIn: 'root',
})
export class AdminUserTableService {

    readonly rowsSubject = new BehaviorSubject<PlayerAndOrRegion[]>([]);
    readonly selectedRowIndicesSubject = new BehaviorSubject<Set<number>>(new Set());
    private hasPulledAssignments = false;

    public readonly rows$: Observable<PlayerAndOrRegion[]> = this.rowsSubject.asObservable();
    public readonly selectedRowIndices$: Observable<Set<number>> = this.selectedRowIndicesSubject.asObservable();

    public readonly selectedRows$: Observable<PlayerAndOrRegion[]> = this.selectedRowIndices$.pipe(
        map(indices => {
            const rows = this.rowsSubject.value;
            if (indices.size === 0) {
                return rows;
            }
            return rows.filter((_, index) => indices.has(index));
        })
    );

    toggleUserSelection(index: number): void {
        const current = new Set(this.selectedRowIndicesSubject.value);
        if (current.has(index)) {
            current.delete(index);
        } else {
            current.add(index);
        }
        this.selectedRowIndicesSubject.next(current);
    }

    isUserSelected(index: number): boolean {
        return this.selectedRowIndicesSubject.value.has(index);
    }

    toggleAllPlayers(): void {
        const current = this.selectedRowIndicesSubject.value;
        const rows = this.rowsSubject.value;

        if (current.size === rows.length) {
            this.selectedRowIndicesSubject.next(new Set());
        } else {
            const newSelection = new Set<number>();
            rows.forEach((_, index) => newSelection.add(index));
            this.selectedRowIndicesSubject.next(newSelection);
        }
    }

    clearSelection(): void {
        this.selectedRowIndicesSubject.next(new Set());
    }

    isAllPlayersSelected(): boolean {
        const current = this.selectedRowIndicesSubject.value;
        const rows = this.rowsSubject.value;
        return rows.length > 0 && current.size === rows.length;
    }

    isPlayersIndeterminate(): boolean {
        const current = this.selectedRowIndicesSubject.value;
        return current.size > 0 && current.size < this.rowsSubject.value.length;
    }

    hasSelection(): boolean {
        return this.selectedRowIndicesSubject.value.size > 0;
    }

    setRows(rows: PlayerAndOrRegion[]): void {
        this.rowsSubject.next(rows);
    }

    rebuildRowsFromServer(signupsMap: Map<string, string[]>, assignmentsMap: Map<string, string>, regions: string[], guildUsers: DiscordUser[]): void {
        const userIdToDiscordUser = new Map(guildUsers.map(user => [user.id, user]));
        const newPlayerRegions: PlayerAndOrRegion[] = [];
        const handledRegions = new Set<string>();
        for (const userId of new Set([...signupsMap.keys(), ...assignmentsMap.keys()])) {
            const user = userIdToDiscordUser.get(userId);
            if (user) {
                const assignedRegion = assignmentsMap.get(userId) || null;
                newPlayerRegions.push(new PlayerAndOrRegion(
                    user,
                    assignedRegion,
                    null,
                    signupsMap.get(userId) || []
                ));
                if (assignedRegion) {
                    handledRegions.add(assignedRegion);
                }
            }
        }
        regions.forEach(region => {
            if (!handledRegions.has(region)) {
                newPlayerRegions.push(new PlayerAndOrRegion(null, region, null, []));
            }
        });

        this.setRows(newPlayerRegions);
        this.hasPulledAssignments = false;
    }

    getRows(): PlayerAndOrRegion[] {
        return this.rowsSubject.value;
    }

    addRow(row: PlayerAndOrRegion): void {
        const current = this.rowsSubject.value;
        this.rowsSubject.next([row, ...current]);
    }

    removeRow(playerRegion: PlayerAndOrRegion): void {
        const current = this.rowsSubject.value;
        const filtered = current.filter(pr => pr.getId() !== playerRegion.getId());
        this.rowsSubject.next(filtered);
        this.selectedRowIndicesSubject.next(new Set());
    }

    updateRowRegion(rowIndex: number, regionClient: string | null): void {
        const current = [...this.rowsSubject.value];
        if (current[rowIndex]) {
            current[rowIndex].regionClient = regionClient;
            this.rowsSubject.next(current);
        }
    }

    swapRowRegions(index1: number, index2: number): void {
        const current = [...this.rowsSubject.value];
        if (current[index1] && current[index2]) {
            const temp = current[index1].regionClient;
            current[index1].regionClient = current[index2].regionClient;
            current[index2].regionClient = temp;
            this.rowsSubject.next(current);
        }
    }

    clearAllRows(): void {
        this.rowsSubject.next([]);
        this.selectedRowIndicesSubject.next(new Set());
    }

    canConfirmAssignments(): boolean {
        return this.hasPulledAssignments;
    }

    canTriggerAssign(): boolean {
        const selectedIndices = this.selectedRowIndicesSubject.value;
        if (selectedIndices.size !== 2) return false;

        const rows = this.rowsSubject.value;
        const selectedRows = Array.from(selectedIndices).map(i => rows[i]);
        const playersWithoutRegion = selectedRows.filter(r => r.user && !r.regionClient);
        const regionsWithoutPlayer = selectedRows.filter(r => !r.user && r.regionServer);
        return playersWithoutRegion.length === 1 && regionsWithoutPlayer.length === 1;
    }

    canSwapRows(): boolean {
        const selectedIndices = this.selectedRowIndicesSubject.value;
        if (selectedIndices.size !== 2) return false;

        const rows = this.rowsSubject.value;
        const selectedRows = Array.from(selectedIndices).map(i => rows[i]);
        const playersWithRegion = selectedRows.filter(r => r.user && r.regionClient);

        return playersWithRegion.length === 2;
    }

    pullServerToLocal(): void {
        const rows = this.rowsSubject.value;
        rows.forEach(playerRegion => {
            if (playerRegion.user) {
                playerRegion.regionClient = playerRegion.regionServer || playerRegion.regionClient;
            }
        });
        this.rowsSubject.next([...rows]);
        this.hasPulledAssignments = true;
    }

    assignSelectedRowToRegion(): boolean {
        const selectedIndices = this.selectedRowIndicesSubject.value;
        const rows = this.rowsSubject.value;
        const selectedRows = Array.from(selectedIndices).map(i => rows[i]);
        const playerRow = selectedRows.find(r => r.user && !r.regionClient);
        const regionRow = selectedRows.find(r => !r.user && r.regionServer);

        if (!playerRow || !regionRow) {
            return false;
        }

        playerRow.regionClient = regionRow.regionServer!;
        this.rowsSubject.next([...rows]);
        this.clearSelection();
        return true;
    }

    swapSelectedRegions(): boolean {
        const selectedIndices = this.selectedRowIndicesSubject.value;
        const rows = this.rowsSubject.value;
        const selectedIndicesArray = Array.from(selectedIndices);
        const row1 = rows[selectedIndicesArray[0]];
        const row2 = rows[selectedIndicesArray[1]];

        if (!row1?.user || !row2?.user || !row1.regionClient || !row2.regionClient) {
            return false;
        }

        const temp = row1.regionClient;
        row1.regionClient = row2.regionClient;
        row2.regionClient = temp;

        this.rowsSubject.next([...rows]);
        this.clearSelection();
        return true;
    }

    autoAssignPlayerRegions(): { success: boolean; error?: string } {
        let players: PlayerAndOrRegion[];
        let regions: string[];
        const rows = this.rowsSubject.value;
        const selectedIndices = this.selectedRowIndicesSubject.value;

        if (selectedIndices.size > 0) {
            const selectedRows = rows.filter((_, index) => selectedIndices.has(index));
            players = selectedRows.filter(pr => pr.user);
            const regionRows = selectedRows.filter(pr => !pr.user && pr.regionServer);
            regions = regionRows.map(pr => pr.regionServer!);
            if (players.length > regions.length) {
                return { success: false, error: `Selected ${players.length} players but only ${regions.length} regions. Please select more regions.` };
            }
        } else {
            players = rows.filter((pr: PlayerAndOrRegion) => pr.user);
            regions = rows
                .filter((pr: PlayerAndOrRegion) => !pr.user && pr.regionServer)
                .map((pr: PlayerAndOrRegion) => pr.regionServer!);
        }

        if (players.length === 0) {
            return { success: false, error: 'No players to assign.' };
        }

        if (regions.length === 0) {
            return { success: false, error: 'No available regions to assign.' };
        }

        try {
            const assignments = calculateAssignments<DiscordUser, string>(
                regions,
                players.map(p => ({
                    user: p.user!,
                    picks: p.preferences || []
                }))
            );
            for (const [region, user] of assignments.entries()) {
                const playerRegion = rows.find((pr: PlayerAndOrRegion) => pr.user?.id === user.id);
                if (playerRegion) {
                    playerRegion.regionClient = region;
                }
            }
            this.rowsSubject.next([...rows]);
            this.clearSelection();
            return { success: true };
        } catch (error) {
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    getAssignmentsToPublish(): Map<DiscordUser, string> {
        const player2region: Map<DiscordUser, string> = new Map();
        this.rowsSubject.value.forEach((playerRegion: PlayerAndOrRegion) => {
            if (playerRegion.user && playerRegion.regionClient) {
                player2region.set(playerRegion.user, playerRegion.regionClient);
            }
        });
        return player2region;
    }

}
