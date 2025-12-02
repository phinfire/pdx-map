import { Component, ElementRef, inject, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LinePlotterService, DataSeries } from './LinePlotterService';
import { Eu4SaveSeriesData } from './model/Eu4SaveSeriesData';
import { LineViewerData } from './model/LineViewerData';
import { LineAccessor } from './model/LineAccessor';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LineableEntity } from './model/LineableEntity';

interface SeriesWithEntity extends DataSeries {
    entity: LineableEntity;
}

@Component({
    selector: 'app-lineviewer',
    imports: [MatCheckboxModule, MatToolbarModule, MatSelectModule, MatFormFieldModule, MatProgressSpinnerModule, CommonModule, FormsModule],
    templateUrl: './lineviewer.component.html',
    styleUrl: './lineviewer.component.scss',
})
export class LineviewerComponent implements AfterViewInit, OnDestroy {
    private elementRef = inject(ElementRef);
    private plotterService = inject(LinePlotterService);
    private cdr = inject(ChangeDetectorRef);

    private data: LineViewerData = new Eu4SaveSeriesData();
    
    private svgElement: SVGSVGElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: number | null = null;
    private selectedOption: LineAccessor | null = null;
    private destroy$ = new Subject<void>();

    series: SeriesWithEntity[] = [];
    isLoading = false;
    selectedMetric: string = '';
    optionsList: Array<[string, LineAccessor]> = [];

    get allSeriesVisible(): boolean {
        return this.series.length > 0 && this.series.every(s => s.entity?.isVisible?.() ?? false);
    }

    get someSeriesVisible(): boolean {
        return this.series.some(s => s.entity?.isVisible?.() ?? false);
    }

    constructor() {
        this.optionsList = Array.from(this.data.getOptions().entries());
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

    private setSeriesFromMap(seriesMap: Map<LineableEntity, DataSeries>) {
        this.series = Array.from(seriesMap.entries()).map(([entity, ds]) => ({
            ...ds,
            entity
        }));
        this.series.forEach(s => s.entity?.setVisible?.(true));
        this.cdr.markForCheck();
    }

    private redrawChart() {
        if (this.svgElement) {
            this.svgElement.remove();
        }
        const visibleSeries = this.series.filter(s => s.entity?.isVisible?.() ?? false);
        const chartContainer = this.elementRef.nativeElement.querySelector('.chart-container');
        this.svgElement = this.plotterService.redrawChart(visibleSeries, chartContainer);
        if (chartContainer && this.svgElement) {
            chartContainer.appendChild(this.svgElement);
        }
    }
}

