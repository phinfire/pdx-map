import { inject } from "@angular/core";
import { of, switchMap } from "rxjs";
import { SaveSaverService } from "../save-saver.service";

export class MegaCampaign {

    constructor(private name: string, private regionDeadlineDate: Date, private startDeadlineDate: Date, private firstSessionDate: Date, private firstEu4Session: Date | null) {
        if (!(regionDeadlineDate < startDeadlineDate && startDeadlineDate < firstSessionDate)) {
            throw new Error('Dates are not in correct order\nregionDeadlineDate: ' + regionDeadlineDate + '\nstartDeadlineDate: ' + startDeadlineDate + '\nfirstSessionDate: ' + firstSessionDate);
        }
    }

    getName() {
        return this.name;
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
}