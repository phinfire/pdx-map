
import { Observable, of, map } from 'rxjs';
import { RegionConfig } from '../../model/megacampaign/RegionConfig';

export class MegaCampaign {
    regionConfig$?: Observable<RegionConfig>;

    constructor(
        private name: string,
        private signupDeadlineDate: Date,
        private pickDeadline: Date,
        private firstSessionDate: Date,
        private firstEu4SessionDate: Date | null,
        private id: number | undefined,
        private signupsOpen: boolean,
        private ck3MapGeoJsonUrl: string,
        private ck3RegionsConfigUrl: string,
        private nationsJsonUrl: string,
        private moderatorIds: number[],
        private ck3LobbiesIdentifiers: string[],
        private eu4LobbiesIdentifiers: string[],
        private vic3LobbyIdentifiers: string[],
        private possibleKeys: string[]
    ) {

    }

    getName() {
        return this.name;
    }

    getCk3MapGeoJsonUrl(): string {
        return this.ck3MapGeoJsonUrl;
    }

    getNationsJsonUrl(): string {
        return this.nationsJsonUrl;
    }

    isSignupsOpen(): boolean {
        return this.signupsOpen;
    }

    getModeratorIds(): number[] {
        return this.moderatorIds;
    }

    getCk3LobbiesIdentifiers(): string[] {
        return this.ck3LobbiesIdentifiers;
    }

    getEu4LobbiesIdentifiers(): string[] {
        return this.eu4LobbiesIdentifiers;
    }

    getVic3LobbyIdentifiers(): string[] {
        return this.vic3LobbyIdentifiers;
    }

    getPossibleKeys(): string[] {
        return this.possibleKeys;
    }

    getCk3RegionsConfigUrl(): string {
        return this.ck3RegionsConfigUrl;
    }

    getRegionDeadlineDate() {
        return this.signupDeadlineDate;
    }

    getStartDeadlineDate() {
        return this.pickDeadline;
    }

    getFirstSessionDate() {
        return this.firstSessionDate;
    }

    getFirstEu4SessionDate(): Date | null {
        return this.firstEu4SessionDate;
    }

    getId(): number | undefined {
        return this.id;
    }

    isInRegionSignupStage(): boolean {
        return new Date() <= this.signupDeadlineDate;
    }

    isInStartSelectionStage(): boolean {
        return new Date() > this.signupDeadlineDate && new Date() <= this.pickDeadline;
    }

    isInWaitingForFirstSessionStage(): boolean {
        return new Date() > this.pickDeadline && new Date() <= this.firstSessionDate;
    }

    isPlayingCk3(): boolean {
        return new Date() > this.firstSessionDate;
    }

    canBeEdited(): boolean {
        return this.id !== undefined;
    }

    getRegionNameList$(): Observable<string[]> {
        if (!this.regionConfig$) {
            return of([]);
        }
        return this.regionConfig$.pipe(
            map(config => config.regions.map(region => region.name))
        );
    }
}