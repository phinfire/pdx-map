import { AfterViewInit, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

@Component({
    selector: 'app-gauge',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './gauge.component.html',
    styleUrl: './gauge.component.scss',
})
export class GaugeComponent implements AfterViewInit, OnChanges, OnDestroy {
    @ViewChild('gaugeContainer', { static: true }) gaugeContainer!: ElementRef<HTMLDivElement>;

    @Input() value = 0;
    @Input() threshold = 100_000_000;
    @Input() max?: number;

    private gaugeSvg: any;
    private gaugeBg: any;
    private fillRect: any;
    private markerLine: any;
    private gaugeBorder: any;
    private gaugeWidth = 0;
    private gaugeHeight = 48;
    private padding = 2;
    private cornerRadius = this.gaugeHeight / 2;
    private resizeObserver?: ResizeObserver;

    private primaryColor: string = 'rgb(0, 180, 0)';
    private borderColorStr: string = '#ccc';

    ngAfterViewInit(): void {
        this.renderGauge();
        try {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const newWidth = Math.round(entry.contentRect.width || this.getContainerWidth());
                    if (newWidth > 0 && newWidth !== this.gaugeWidth) {
                        this.gaugeWidth = newWidth;
                        this.updateGauge();
                    }
                }
            });
            this.resizeObserver.observe(this.gaugeContainer.nativeElement);
        } catch (e) {
            setTimeout(() => this.updateGauge(), 50);
        }
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (this.gaugeSvg) {
            this.updateGauge();
        }
    }

    ngOnDestroy(): void {
        if (this.resizeObserver) {
            try { this.resizeObserver.disconnect(); } catch (e) {}
            this.resizeObserver = undefined;
        }
        if (this.gaugeSvg) {
            d3.select(this.gaugeContainer.nativeElement).selectAll('*').remove();
            this.gaugeSvg = null;
        }
    }

    private getBarMax(): number {
        return this.max ?? Math.round(this.threshold * 1.2);
    }

    private renderGauge(): void {
        const container = d3.select(this.gaugeContainer.nativeElement);
        container.selectAll('*').remove();
        // Measure the container reliably (try several fallbacks) so we don't default to a large fixed width.
        this.gaugeWidth = this.getContainerWidth();
        console.log('Rendering gauge in container width:', this.gaugeWidth);
        const rootStyle = getComputedStyle(document.documentElement);
        this.primaryColor = (rootStyle.getPropertyValue('--mat-sys-primary') || '').trim() || '#ff9800';
        this.borderColorStr = (rootStyle.getPropertyValue('--border-color') || '').trim() || '#ccc';


        this.gaugeSvg = container.append('svg')
            .attr('width', '100%')
            .attr('height', this.gaugeHeight)
            .attr('viewBox', `0 0 ${this.gaugeWidth + this.padding * 2} ${this.gaugeHeight + this.padding * 2}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');


        this.gaugeBg = this.gaugeSvg.append('rect')
            .attr('x', this.padding)
            .attr('y', this.padding)
            .attr('width', this.gaugeWidth)
            .attr('height', this.gaugeHeight)
            .attr('rx', this.cornerRadius)
            .attr('ry', this.cornerRadius)
            .style('fill', 'rgba(0,0,0,0.2)')
            .style('stroke', this.borderColorStr);


        this.fillRect = this.gaugeSvg.append('rect')
            .attr('class', 'fill')
            .attr('x', this.padding)
            .attr('y', this.padding)
            .attr('height', this.gaugeHeight)
            .attr('rx', this.cornerRadius)
            .attr('ry', this.cornerRadius)
            .style('fill', this.primaryColor)
            .attr('width', 0);


        this.markerLine = this.gaugeSvg.append('line')
            .attr('y1', this.padding)
            .attr('y2', this.gaugeHeight + this.padding)
            .style('stroke', '#ffffff')
            .style('stroke-dasharray', '4 4')
            .style('stroke-width', 2)
            .style('pointer-events', 'none');

        this.gaugeBorder = this.gaugeSvg.append('rect')
            .attr('x', this.padding)
            .attr('y', this.padding)
            .attr('width', this.gaugeWidth)
            .attr('height', this.gaugeHeight)
            .attr('rx', this.cornerRadius)
            .attr('ry', this.cornerRadius)
            .style('fill', 'none')
            .style('stroke', this.borderColorStr)
            .style('stroke-width', 2)
            .style('pointer-events', 'none');
    }

    private updateGauge(): void {
        if (!this.gaugeSvg) return;
        if (!this.gaugeWidth || isNaN(this.gaugeWidth) || this.gaugeWidth <= 0) {
            return;
        }
        this.gaugeSvg.attr('viewBox', `0 0 ${this.gaugeWidth + this.padding * 2} ${this.gaugeHeight + this.padding * 2}`);

        let barMax = this.getBarMax();
        if (!barMax || isNaN(barMax) || barMax <= 0) {
            barMax = 1;
        }
        const threshold = typeof this.threshold === 'number' && !isNaN(this.threshold) ? this.threshold : 0;
        const value = typeof this.value === 'number' && !isNaN(this.value) ? this.value : 0;

        const markerX = (threshold / barMax) * this.gaugeWidth + this.padding;
        const fillValue = Math.min(value, barMax);
        const fillWidth = (fillValue / barMax) * this.gaugeWidth;

        if (this.gaugeBg) this.gaugeBg.attr('width', this.gaugeWidth).attr('height', this.gaugeHeight).attr('x', this.padding).attr('y', this.padding);
        if (this.gaugeBorder) this.gaugeBorder.attr('width', this.gaugeWidth).attr('height', this.gaugeHeight).attr('x', this.padding).attr('y', this.padding);

        if (this.fillRect) {
            this.fillRect
                .attr('x', this.padding)
                .attr('y', this.padding)
                .transition()
                .duration(500)
                .attr('width', isNaN(fillWidth) ? 0 : fillWidth)
                .on('end', () => {
                    this.fillRect.style('fill', value > threshold ? '#e53935' : this.primaryColor);
                });
        }


        if (this.markerLine) {
            this.markerLine
                .attr('y1', this.padding)
                .attr('y2', this.gaugeHeight + this.padding)
                .transition()
                .duration(500)
                .attr('x1', isNaN(markerX) ? 0 : markerX)
                .attr('x2', isNaN(markerX) ? 0 : markerX);
            this.markerLine.raise();
        }

        if (this.gaugeBorder) this.gaugeBorder.raise();
    }

    @HostListener('window:resize')
    onResize(): void {
        // Recompute the available width and update the gauge.
        this.gaugeWidth = this.getContainerWidth();
        setTimeout(() => this.updateGauge(), 50);
    }

    private getContainerWidth(): number {
        const el = this.gaugeContainer && this.gaugeContainer.nativeElement;
        if (!el) return 0;
        let w = Math.round(el.clientWidth || 0);
        if (!w) {
            const rect = el.getBoundingClientRect();
            w = Math.round(rect.width || 0);
        }
        if (!w && el.parentElement) {
            w = Math.round(el.parentElement.clientWidth || el.parentElement.getBoundingClientRect().width || 0);
        }
        if (!w) {
            w = Math.round(window.innerWidth * 0.5);
        }
        return Math.max(1, w);
    }
}

