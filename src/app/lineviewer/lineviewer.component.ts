import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, inject, Input, OnDestroy, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LinePlotterService } from './LinePlotterService';
import { DataSeries } from './model/DataSeries';
import { LineableEntity } from './model/LineableEntity';
import { LineAccessor } from './model/LineAccessor';
import { LineViewerData } from './model/LineViewerData';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { Scaling } from './Scaling';

interface SeriesWithEntity extends DataSeries<Date> {
    entity: LineableEntity;
}

@Component({
    selector: 'app-lineviewer',
    imports: [MatCheckboxModule, MatToolbarModule, MatSelectModule, MatFormFieldModule, MatProgressSpinnerModule, FormsModule, MatButtonToggleModule, MatTooltipModule, MatSliderModule],
    templateUrl: './lineviewer.component.html',
    styleUrl: './lineviewer.component.scss',
})
export class LineviewerComponent implements AfterViewInit, OnDestroy {

    @Input() data: LineViewerData<Date> | null = null;

    private elementRef = inject(ElementRef);
    private plotterService = inject(LinePlotterService);
    private cdr = inject(ChangeDetectorRef);

    private svgElement: SVGSVGElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: number | null = null;
    private selectedOption: LineAccessor<Date> | null = null;
    private destroy$ = new Subject<void>();
    private hasInitialized = false;

    series: SeriesWithEntity[] = [];
    isLoading = false;
    selectedMetric: string = '';
    optionsList: Array<[string, LineAccessor<Date>]> = [];
    showDataPointMarkers = false;
    scaling: Scaling = Scaling.LINEAR;
    readonly Scaling = Scaling;

    rangeMin: number = 0;
    rangeMax: number = 100;
    private allDataMinDate: Date | null = null;
    private allDataMaxDate: Date | null = null;

    get allSeriesVisible(): boolean {
        return this.series.length > 0 && this.series.every(s => s.entity?.isVisible?.() ?? false);
    }

    get someSeriesVisible(): boolean {
        return this.series.some(s => s.entity?.isVisible?.() ?? false);
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['data'] && this.data) {
            this.optionsList = Array.from(this.data.getOptions().entries());
            if (!this.hasInitialized && this.optionsList.length > 0) {
                this.hasInitialized = true;
                this.selectedMetric = this.optionsList[0][0];
                this.onOptionSelected(this.selectedMetric);
            }
        }
    }

    onOptionSelected(optionKey: string) {
        this.isLoading = true;
        const option = this.optionsList.find(([key]) => key === optionKey);
        this.selectedOption = option ? option[1] : null;
        if (this.selectedOption) {
            this.selectedOption().pipe(
                takeUntil(this.destroy$)
            ).subscribe(seriesMap => {
                this.setSeriesFromMap(seriesMap);
                this.redrawChart();
                this.isLoading = false;
                this.cdr.markForCheck();
            });
        }
    }

    ngAfterViewInit() {
        const chartContainer = this.elementRef.nativeElement.querySelector('.chart-container');
        this.resizeObserver = new ResizeObserver(() => {
            if (this.resizeTimeout !== null) {
                clearTimeout(this.resizeTimeout);
            }
            this.resizeTimeout = window.setTimeout(() => {
                this.redrawChart();
                this.resizeTimeout = null;
            }, 150);
        });

        this.resizeObserver.observe(chartContainer);
    }

    ngOnDestroy() {
        if (this.resizeTimeout !== null) {
            clearTimeout(this.resizeTimeout);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.svgElement) {
            this.svgElement.remove();
        }
        this.destroy$.next();
        this.destroy$.complete();
    }

    protected onSeriesToggle() {
        this.redrawChart();
    }

    toggleDataPointMarkers() {
        this.redrawChart();
    }

    onScalingChange(newScaling: Scaling) {
        this.scaling = newScaling;
        this.redrawChart();
    }

    onRangeChange() {
        this.redrawChart();
    }

    formatDateLabel(value: number): string {
        if (!this.allDataMinDate || !this.allDataMaxDate) {
            return '';
        }

        const minMs = this.allDataMinDate.getTime();
        const maxMs = this.allDataMaxDate.getTime();
        const rangeMs = maxMs - minMs;
        const date = new Date(minMs + (rangeMs * value / 100));

        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    }

    getVisibility(series: SeriesWithEntity): boolean {
        return series.entity?.isVisible?.() ?? false;
    }

    setVisibility(series: SeriesWithEntity, visible: boolean): void {
        series.entity?.setVisible?.(visible);
        this.onSeriesToggle();
    }

    toggleAllSeries(visible: boolean): void {
        this.series.forEach(s => s.entity?.setVisible?.(visible));
        this.onSeriesToggle();
    }

    private setSeriesFromMap(seriesMap: Map<LineableEntity, DataSeries<Date>>) {
        const previousVisibility = new Map(this.series.map(s => [s.entity, s.entity?.isVisible?.() ?? false]));
        this.series = Array.from(seriesMap.entries()).map(([entity, ds]) => ({
            ...ds,
            entity
        }));
        this.series.forEach(s => {
            const previousState = previousVisibility.get(s.entity);
            s.entity?.setVisible?.(previousState ?? true);
        });
        this.updateDateRange();
        this.sortSeriesByLastValue();
        this.cdr.markForCheck();
    }

    private updateDateRange() {
        let minDate: Date | null = null;
        let maxDate: Date | null = null;

        this.series.forEach(s => {
            s.values.forEach(point => {
                if (!minDate || point.x < minDate) minDate = point.x;
                if (!maxDate || point.x > maxDate) maxDate = point.x;
            });
        });

        this.allDataMinDate = minDate;
        this.allDataMaxDate = maxDate;
        this.rangeMin = 0;
        this.rangeMax = 100;
    }

    private getFilteredSeries(): SeriesWithEntity[] {
        if (!this.allDataMinDate || !this.allDataMaxDate) {
            return this.series;
        }

        const minMs = this.allDataMinDate.getTime();
        const maxMs = this.allDataMaxDate.getTime();
        const rangeMs = maxMs - minMs;

        const filterMinDate = new Date(minMs + (rangeMs * this.rangeMin / 100));
        const filterMaxDate = new Date(minMs + (rangeMs * this.rangeMax / 100));

        return this.series.map(s => ({
            ...s,
            values: s.values.filter(point => point.x >= filterMinDate && point.x <= filterMaxDate)
        }));
    }

    private getLastValue(series: SeriesWithEntity): number | null {
        if (!series.values || series.values.length === 0) {
            return null;
        }
        const lastPoint = series.values[series.values.length - 1];
        return lastPoint?.y ?? null;
    }

    private sortSeriesByLastValue(): void {
        this.series.sort((a, b) => {
            const lastValueA = this.getLastValue(a);
            const lastValueB = this.getLastValue(b);
            if (lastValueA === null && lastValueB === null) return 0;
            if (lastValueA === null) return 1;
            if (lastValueB === null) return -1;
            return lastValueB - lastValueA;
        });
    }

    private redrawChart() {
        if (this.svgElement) {
            this.svgElement.remove();
        }
        const filteredSeries = this.getFilteredSeries();
        const visibleSeries = filteredSeries.filter(s => s.entity?.isVisible?.() ?? false);
        const chartContainer = this.elementRef.nativeElement.querySelector('.chart-container');
        this.svgElement = this.plotterService.redrawChart(visibleSeries, chartContainer, this.showDataPointMarkers, this.scaling);
        if (chartContainer && this.svgElement) {
            chartContainer.appendChild(this.svgElement);
        } else {
            throw new Error('Chart container or SVG element is null');
        }
    }
}

