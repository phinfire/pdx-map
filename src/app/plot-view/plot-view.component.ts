import * as d3 from 'd3';
import { Component, OnInit, ElementRef, Inject, inject, Input, Optional } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Plotable } from './plot/Plotable';
import { PlottingService } from './PlottingService';

@Component({
    selector: 'app-plot-view',
    imports: [],
    templateUrl: './plot-view.component.html',
    styleUrl: './plot-view.component.scss'
})
export class PlotViewComponent {

    plottingService = inject(PlottingService);

    plotables: Plotable[] = [];
    plotType: string | null = null;

    @Input() plotablesInput: Plotable[] = [];

    constructor(
        @Optional() @Inject(MAT_DIALOG_DATA) private data: { plotables: Plotable[], plotType: string } | null,
        private elementRef: ElementRef
    ) {
        if (data && data.plotables) {
            this.plotables = data.plotables.sort((a, b) => b.value - a.value);
            this.plotType = data.plotType;
        } else {
            this.plotables = this.plotablesInput;
        }
    }

    ngAfterViewInit() {
        if (this.plotables && this.plotables.length > 0) {
            this.elementRef.nativeElement.innerHTML = '';
            if (this.plotType === 'bar' || (!this.plotType && this.plotablesInput && this.plotablesInput.length > 0)) {
                this.plottingService.drawBarPlot(this.plotables, this.elementRef.nativeElement, false, true);
            } else if (this.plotType === 'pie') {
                this.plottingService.pieChart(this.plotables, this.elementRef.nativeElement);
            }
        }
    }   

    ngOnChanges() {
        if (this.plotablesInput) {
            this.plotables = this.plotablesInput;
            this.plotType = null;
            if (this.elementRef && this.elementRef.nativeElement) {
                this.elementRef.nativeElement.innerHTML = '';
                this.plottingService.drawBarPlot(this.plotables, this.elementRef.nativeElement, false, false);
            }
        }
    }
}
