import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Component({
    selector: 'app-timer',
    imports: [MatTooltip, CommonModule],
    templateUrl: './timer.component.html',
    styleUrl: './timer.component.scss'
})
export class TimerComponent implements OnChanges {

    @Input() label = "Time Left"
    @Input() endDate = new Date();
    timeLeft: { days: string, hours: string, minutes: string, seconds: string } = { days: "00", hours: "00", minutes: "00", seconds: "00" };
    private timeIntervalId: any;

    constructor(private cdr: ChangeDetectorRef) {}

    ngOnChanges(changes: SimpleChanges) {
        if (changes['endDate']) {
            this.updateTimeLeft();
        }
    }

    ngOnInit() {
        this.updateTimeLeft();
        this.timeIntervalId = setInterval(() => {
            this.updateTimeLeft();
        }, 500);
    }

    ngOnDestroy() {
        if (this.timeIntervalId) {
            clearInterval(this.timeIntervalId);
        }
    }

    private updateTimeLeft() {
        const now = new Date();
        let diff = Math.max(0, this.endDate.getTime() - now.getTime());
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        diff -= days * (1000 * 60 * 60 * 24);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        diff -= hours * (1000 * 60 * 60);
        const minutes = Math.floor(diff / (1000 * 60));
        diff -= minutes * (1000 * 60);
        const seconds = Math.floor(diff / 1000);
        this.timeLeft = { days: "" + days, hours: this.padZero(hours), minutes: this.padZero(minutes), seconds: this.padZero(seconds) };
        this.cdr.markForCheck();
    }

    private padZero(num: number): string {
        return num.toString().padStart(2, '0');
    }
}
