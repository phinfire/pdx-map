
export class MegaCampaign {

    constructor(
        private name: string,
        private regionDeadlineDate: Date,
        private startDeadlineDate: Date,
        private firstSessionDate: Date,
        private firstEu4Session: Date | null,
        private id?: number,
        private ck3MapGeoJsonUrl: string = '',
        private nationsJsonUrl: string = '',
        private signupsOpen: boolean = false,
        private moderatorIds: number[] = [],
        private ck3LobbiesIdentifiers: string[] = [],
        private eu4LobbiesIdentifiers: string[] = [],
        private vic3LobbyIdentifiers: string[] = [],
        private possibleKeys: string[] = []
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

    getRegionDeadlineDate() {
        return this.regionDeadlineDate;
    }

    getStartDeadlineDate() {
        return this.startDeadlineDate;
    }

    getFirstSessionDate() {
        return this.firstSessionDate;
    }

    getId(): number | undefined {
        return this.id;
    }

    isInRegionSignupStage(): boolean {
        return new Date() <= this.getRegionDeadlineDate();
    }

    isInStartSelectionStage(): boolean {
        return new Date() > this.getRegionDeadlineDate() && new Date() <= this.getStartDeadlineDate();
    }

    isInWaitingForFirstSessionStage(): boolean {
        return new Date() > this.getStartDeadlineDate() && new Date() <= this.getFirstSessionDate();
    }

    isPlayingCk3(): boolean {
        return new Date() > this.getFirstSessionDate();
    }

    getVic3SaveIdentifiersInChronologicalOrder() {
        return ["7084c6ef-8165-4b1b-8be0-c69b0557b825", // 36
            "0b1d6c77-37fb-4308-861a-7929fc98e776", //  76
            "cdd91f98-b124-4d50-831c-472a5df6b54f", // 88
            "cceb9db2-7f3c-4d59-8775-4aaa6bacafd9"]
            ;
    }

    canBeEdited(): boolean {
        return this.getId() !== undefined;
    }
}