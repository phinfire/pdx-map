import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, inject, Input, OnDestroy, SimpleChanges } from '@angular/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';

import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { LinePlotterService } from './LinePlotterService';
import { LineableEntity } from './model/LineableEntity';
import { LineAccessor } from './model/LineAccessor';
import { LineViewerData } from './model/LineViewerData';
import { DataSeries } from './model/DataSeries';

interface SeriesWithEntity extends DataSeries {
    entity: LineableEntity;
}

@Component({
    selector: 'app-lineviewer',
    imports: [MatCheckboxModule, MatToolbarModule, MatSelectModule, MatFormFieldModule, MatProgressSpinnerModule, FormsModule],
    templateUrl: './lineviewer.component.html',
    styleUrl: './lineviewer.component.scss',
})
export class LineviewerComponent implements AfterViewInit, OnDestroy {

    @Input() data: LineViewerData | null = null;

    private elementRef = inject(ElementRef);
    private plotterService = inject(LinePlotterService);
    private cdr = inject(ChangeDetectorRef);

    private svgElement: SVGSVGElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private resizeTimeout: number | null = null;
    private selectedOption: LineAccessor | null = null;
    private destroy$ = new Subject<void>();

    series: SeriesWithEntity[] = [];
    isLoading = false;
    selectedMetric: string = '';
    optionsList: Array<[string, LineAccessor]> = [];
    showDataPointMarkers = false;
    protected useLogScale = false;

    get allSeriesVisible(): boolean {
        return this.series.length > 0 && this.series.every(s => s.entity?.isVisible?.() ?? false);
    }

    get someSeriesVisible(): boolean {
        return this.series.some(s => s.entity?.isVisible?.() ?? false);
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['data'] && this.data) {
            this.optionsList = Array.from(this.data.getOptions().entries());
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
        if (this.optionsList.length > 0) {
            this.selectedMetric = this.optionsList[0][0];
            this.onOptionSelected(this.selectedMetric);
        }
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

    toggleLogScale() {
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
        const previousVisibility = new Map(this.series.map(s => [s.entity, s.entity?.isVisible?.() ?? false]));
        this.series = Array.from(seriesMap.entries()).map(([entity, ds]) => ({
            ...ds,
            entity
        }));
        this.series.forEach(s => {
            const previousState = previousVisibility.get(s.entity);
            s.entity?.setVisible?.(previousState ?? true);
        });

        this.cdr.markForCheck();
    }

    private redrawChart() {
        if (this.svgElement) {
            this.svgElement.remove();
        }
        let visibleSeries = this.series.filter(s => s.entity?.isVisible?.() ?? false);
        
        if (this.useLogScale) {
            visibleSeries = visibleSeries.map(series => ({
                ...series,
                values: series.values.map(point => ({
                    x: point.x,
                    y: point.y > 0 ? parseFloat(Math.log10(point.y).toFixed(2)) : 0
                }))
            }));
        }
        
        const chartContainer = this.elementRef.nativeElement.querySelector('.chart-container');
        this.svgElement = this.plotterService.redrawChart(visibleSeries, chartContainer, this.showDataPointMarkers);
        if (chartContainer && this.svgElement) {
            chartContainer.appendChild(this.svgElement);
        } else {
            throw new Error('Chart container or SVG element is null');
        }
    }
}

