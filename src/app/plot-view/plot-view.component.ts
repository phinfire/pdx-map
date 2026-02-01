import * as d3 from 'd3';
import { Component, OnInit, ElementRef, Inject, inject, Input, Optional, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Plotable } from './Plotable';
import { PlottingService } from './PlottingService';
import { PlotExportService } from './PlotExportService';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
    selector: 'app-plot-view',
    imports: [MatButtonModule, MatIcon, MatMenuModule, MatTooltipModule],
    templateUrl: './plot-view.component.html',
    styleUrl: './plot-view.component.scss'
})
export class PlotViewComponent implements OnInit, OnChanges, AfterViewInit {

    plottingService = inject(PlottingService);
    plotExportService = inject(PlotExportService);

    plotables: Plotable[] = [];
    plotType: string | null = null;
    title: string | null = null;
    previousPlot: SVGSVGElement | null = null;
    private isFromDialog = false;

    @Input() plotablesInput: Plotable[] = [];
    @Input() titleInput: string | null = null;

    downloadPlotAsSVG() {
        if (!this.previousPlot) return;
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(this.previousPlot);
        const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (this.title || 'plot') + '.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    downloadPlotAsPNG() {
        if (!this.previousPlot) return;
        const previousPlot = this.previousPlot;
        const width = previousPlot.width.baseVal.value || 800;
        const height = previousPlot.height.baseVal.value || 500;
        const hostElement = this.elementRef.nativeElement as HTMLElement;
        this.plotExportService.exportPlotAsPNG(previousPlot, width, height, hostElement, this.title).catch(err => {
            console.error('Error exporting plot as PNG:', err);
        });
    }

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) private data: { plotables: Plotable[], plotType: string, title: string } | null,
        private elementRef: ElementRef
    ) {
        if (data) {
            this.plotables = data.plotables.sort((a, b) => b.value - a.value);
            this.plotType = data.plotType;
            this.title = data.title;
            this.isFromDialog = true;
        } else {
            this.plotables = [];
            this.isFromDialog = false;
        }
    }

    ngOnInit() {
        if (!this.isFromDialog && this.plotablesInput && this.plotablesInput.length > 0) {
            this.plotables = this.plotablesInput;
            this.redrawPlot();
        }
    }

    ngAfterViewInit() {
        if (this.plotables && this.plotables.length > 0) {
            this.redrawPlot();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['plotablesInput']) {
            if (this.plotablesInput && this.plotablesInput.length > 0) {
                this.plotables = this.plotablesInput;
                this.plotType = null;
                setTimeout(() => this.redrawPlot(), 0);
            }
        }
        if (changes['titleInput'] && this.titleInput) {
            this.title = this.titleInput;
        }
    }

    private redrawPlot() {
        if (this.previousPlot) {
            this.previousPlot.remove();
        }
        if (this.elementRef && this.elementRef.nativeElement) {
            const plotContainer = this.elementRef.nativeElement.querySelector('.plot-container');
            if (plotContainer && this.plotables && this.plotables.length > 0) {
                if (this.plotType === 'bar') {
                    this.previousPlot = this.plottingService.drawBarPlot(this.plotables, plotContainer, false, true);
                } else if (this.plotType === 'pie') {
                    this.previousPlot = this.plottingService.pieChart(this.plotables, plotContainer);
                } else {
                    this.previousPlot = this.plottingService.drawBarPlot(this.plotables, plotContainer, false, true);
                }
            }
        } else {
            console.warn("No elementRef or nativeElement in PlotViewComponent");
        }
    }
}
