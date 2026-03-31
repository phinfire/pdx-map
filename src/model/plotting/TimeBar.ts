import { LabeledAndIconed } from "../../ui/LabeledAndIconed";

export interface TimeBar {
    label: string;
    startDate: Date;
    endDate: Date;
    rowName: string;
    color: string;
    lowConfidence: boolean;
    milestones: LabeledAndIconed<Date>[];
}