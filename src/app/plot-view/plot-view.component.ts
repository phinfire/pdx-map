import { Component, OnInit, ElementRef, Inject } from '@angular/core';
import * as d3 from 'd3';
import { TableColumn } from '../util/table/TableColumn';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Plotable } from './plot/Plotable';

@Component({
    selector: 'app-plot-view',
    imports: [],
    templateUrl: './plot-view.component.html',
    styleUrl: './plot-view.component.scss'
})
export class PlotViewComponent implements OnInit {

    private static readonly OTHER_LABEL = 'Other';

    plotables: Plotable[] = [];

    constructor(
        @Inject(MAT_DIALOG_DATA) private data: { plotables: Plotable[] }, private elementRef: ElementRef
    ) {
        this.plotables = data.plotables;
    }

    ngOnInit() {
        console.log(this.plotables);
        this.copied(this.plotables);
    }

    copied(plotables: Plotable[]) {
        const offtoOtherYouGoThreshold = 0.025;
        const totalValue = plotables.reduce((sum, p) => sum + p.value, 0);
        const tooSmallSlices = plotables.filter(p => p.value / totalValue < offtoOtherYouGoThreshold);
        const okSlices = plotables.filter(p => p.value / totalValue >= offtoOtherYouGoThreshold);
        const slices = okSlices.concat(
            tooSmallSlices.length > 0 ? [new Plotable(PlotViewComponent.OTHER_LABEL, tooSmallSlices.reduce((sum, p) => sum + p.value, 0), tooSmallSlices[0].color)] : []
        );
        const width = 500;
        const height = 500;
        const radius = Math.min(width, height) / 2;

        const color = d3.scaleOrdinal(slices.map(slice => slice.color))

        const hostElement = d3.select(this.elementRef.nativeElement);

        const svgRoot = hostElement.append("svg")
            .attr("width", width)
            .attr("height", height);

        const defs = svgRoot.append("defs");
        defs.append("filter")
            .attr("id", "drop-shadow")
            .attr("x", "-20%")
            .attr("y", "-20%")
            .attr("width", "140%")
            .attr("height", "140%")
            .append("feDropShadow")
            .attr("dx", "4")
            .attr("dy", "4")
            .attr("stdDeviation", "6")
            .attr("flood-color", "#000")
            .attr("flood-opacity", "0.7");

        const svg = svgRoot.append("g")
            .attr("transform", `translate(${width / 2}, ${height / 2})`);

        const pie = d3.pie<Plotable>().value(d => d.value).padAngle(0.03);

        const arc = d3.arc<d3.PieArcDatum<Plotable>>()
            .innerRadius(16)
            .outerRadius(radius)
            .cornerRadius(4);

        const arcs = svg.selectAll("arc")
            .data(pie(slices))
            .enter()
            .append("g")
            .attr("class", "arc");

        arcs.append("path")
            .attr("d", arc)
            .attr("fill", (d, i) => color(String(i)))
            .attr("class", "slice")
            .attr("filter", "url(#drop-shadow)");

        arcs.append("text")
            .attr("transform", d => {
                const [x, y] = arc.centroid(d);
                const angle = (d.startAngle + d.endAngle) / 2;
                let rotation = (angle * 180 / Math.PI) - 90;
                if (rotation > 90) rotation -= 180;
                return `translate(${x}, ${y}) rotate(${rotation})`;
            })
            .attr("text-anchor", "central")
            .attr("class", "slice-label")
            .text(d => d.data.label);
        /*
    arcs.append("text")
        .attr("transform", d => {
            const [x, y] = arc.centroid(d);
            const angle = (d.startAngle + d.endAngle) / 2;
            let rotation = (angle * 180 / Math.PI) - 90;
            if (rotation > 90) rotation -= 180;
            return `translate(${x}, ${y}) rotate(${rotation})`;
        })
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("class", "slice-label")
        .text(d => d.data.label);
        */

        const styleElement = hostElement.append("style");
        styleElement.text(`
            .slice {
                transition: opacity 0.1s ease-in-out;
            }
            .slice:hover {
                opacity: 0.7;
            }
            text.slice-label {
                fill: var(--text-color);
                font-weight: bold;
                font-size: 1rem;
                text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9);
                user-select: none;
                -webkit-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
            }
        `);
    }
}
