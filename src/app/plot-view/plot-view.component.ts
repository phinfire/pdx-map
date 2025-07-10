import { Component, OnInit, ElementRef } from '@angular/core';
import * as d3 from 'd3';

interface Slice {
    label: string;
    value: number;
    color: string;
}

@Component({
    selector: 'app-plot-view',
    imports: [],
    templateUrl: './plot-view.component.html',
    styleUrl: './plot-view.component.scss'
})
export class PlotViewComponent implements OnInit {

    constructor(private elementRef: ElementRef) { }

    ngOnInit() {
        this.copied([
            { label: "A", value: 30, color: "#e63946" },
            { label: "B", value: 20, color: "#457b9d" },
            { label: "C", value: 25, color: "#2a9d8f" },
            { label: "D", value: 15, color: "#f4a261" },
            { label: "E", value: 10, color: "#e9c46a" }
        ]);
    }

    copied(slices: Slice[]) {

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

        const pie = d3.pie<Slice>().value(d => d.value).padAngle(0.03);

        const arc = d3.arc<d3.PieArcDatum<Slice>>()
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
            .attr("transform", d => `translate(${arc.centroid(d)})`)
            .attr("text-anchor", "middle")
            .attr("class", "slice-label")
            .text(d => d.data.label);

        const styleElement = hostElement.append("style");
        styleElement.text(`
            .slice {
                transition: opacity 0.2s ease-in-out;
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
