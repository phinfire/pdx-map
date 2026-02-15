
export class MegaCampaign {

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

    getVic3SaveIdentifiersInChronologicalOrder() {
        return ["7084c6ef-8165-4b1b-8be0-c69b0557b825", // 36
            "0b1d6c77-37fb-4308-861a-7929fc98e776", //  76
            "cdd91f98-b124-4d50-831c-472a5df6b54f", // 88
            "cceb9db2-7f3c-4d59-8775-4aaa6bacafd9"]
            ;
    }

    canBeEdited(): boolean {
        return this.id !== undefined;
    }
}