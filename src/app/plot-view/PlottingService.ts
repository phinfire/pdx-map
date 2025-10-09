import { Injectable } from "@angular/core";
import * as d3 from 'd3';
import { Plotable } from "./plot/Plotable";

// Minimal default style for tooltip
class DefaultPlotStyle {
    getTextColor() { return { toString: () => '#fff' }; }
    getBorderColor() { return { toString: () => '#222' }; }
    getBorderWidth() { return 2; }
}

@Injectable({
    providedIn: 'root'
})
export class PlottingService {

    private static readonly OTHER_LABEL = 'Other';

    drawBarPlot(plotables: Plotable[], nativeElement: HTMLElement, showLabelsWithImages: boolean, showXAxisTickLabels: boolean) {
        const bars = plotables;
        const width = nativeElement.clientWidth || 800;
        const height = nativeElement.clientHeight || 500;
        const IMAGE_SIZE_PERCENT = 0.9;
        const tempX = d3.scaleBand()
            .domain(bars.map(d => d.label))
            .range([0, width - 80 - 30])
            .padding(0.15);
        const maxImageSize = Math.max(...bars.map(d => tempX.bandwidth() * IMAGE_SIZE_PERCENT));
        const margin = {
            top: Math.max(40, Math.ceil(maxImageSize) + 8),
            right: 30,
            bottom: 130 + (showXAxisTickLabels ? 100 : 0),
            left: 80
        };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        const color = d3.scaleOrdinal(bars.map(bar => bar.color));
        const hostElement = d3.select(nativeElement);
        hostElement.selectAll("svg").remove();
        const svgRoot = hostElement.append("svg")
            .attr("width", width)
            .attr("height", height);
        this.addDropShadowFilter(svgRoot);
        const svg = svgRoot.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        const x = d3.scaleBand()
            .domain(bars.map(d => d.label))
            .range([0, chartWidth])
            .padding(0.15);
        const y = d3.scaleLinear()
            .domain([0, d3.max(bars, d => d.value) || 1])
            .nice()
            .range([chartHeight, 0]);
        this.renderXAxis(svg, x, chartHeight, showXAxisTickLabels);
        this.renderYAxis(svg, y, bars, false);
        this.renderBars(svg, bars, x, y, color, chartHeight);
        this.renderBarImagesAndLabels(svg, bars, x, y, showLabelsWithImages, nativeElement);
        this.injectBarPlotStyles(hostElement);
    }

    private addDropShadowFilter(svgRoot: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
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
    }

    private renderXAxis(svg: d3.Selection<SVGGElement, unknown, null, undefined>, x: d3.ScaleBand<string>, chartHeight: number, showXAxisTickLabels: boolean) {
        const xAxisG = svg.append("g")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(d3.axisBottom(x));
        if (showXAxisTickLabels) {
            xAxisG.selectAll("text")
                .attr("transform", "translate(0,20) rotate(45)")
                .attr("font-size", "1.4em")
                .style("text-anchor", "start");
        } else {
            xAxisG.selectAll("text").remove();
        }
    }

    private renderYAxis(svg: d3.Selection<SVGGElement, unknown, null, undefined>, y: d3.ScaleLinear<number, number>, bars: Plotable[], doThatIntegerTrick: boolean) {
        const allIntegers = bars.every(d => Number.isInteger(d.value));
        if (allIntegers && doThatIntegerTrick) {
            const yDomain = y.domain();
            const min = Math.ceil(yDomain[0]);
            const max = Math.floor(yDomain[1]);
            const integerTicks = [];
            for (let i = min; i <= max; i++) {
                integerTicks.push(i);
            }
            svg.append("g")
                .call(d3.axisLeft(y)
                    .tickValues(integerTicks)
                    .tickFormat(d => Number.isInteger(d) ? d.toString() : "")
                );
        } else {
            svg.append("g")
                .call(d3.axisLeft(y));
        }
    }

    private renderBars(
        svg: d3.Selection<SVGGElement, unknown, null, undefined>,
        bars: Plotable[],
        x: d3.ScaleBand<string>,
        y: d3.ScaleLinear<number, number>,
        color: d3.ScaleOrdinal<string, string, never>,
        chartHeight: number
    ) {
        let tooltipText: d3.Selection<SVGTextElement, unknown, null, undefined> | null = null;
        const [showCursorText, hideCursorText] = getConfiguredShowCursorText(
            svg.node()?.ownerSVGElement?.parentElement || document.body,
            svg,
            20,
            new DefaultPlotStyle(),
            10
        );
        svg.selectAll(".bar")
            .data(bars)
            .enter()
            .append("rect")
            .attr("class", "bar")
            .attr("x", d => x(d.label) || 0)
            .attr("y", d => y(d.value))
            .attr("width", x.bandwidth())
            .attr("height", d => chartHeight - y(d.value))
            .attr("fill", (d, i) => color(String(i)))
            .attr("filter", "url(#drop-shadow)")
            .on('mousemove', function (event, d) {
                tooltipText = showCursorText(event, tooltipText, d.label, d3.select(this));
            })
            .on('mouseout', function (event, d) {
                hideCursorText(tooltipText, d3.select(this));
                tooltipText = null;
            });
    }

    private renderBarImagesAndLabels(svg: d3.Selection<SVGGElement, unknown, null, undefined>, bars: Plotable[], x: d3.ScaleBand<string>, y: d3.ScaleLinear<number, number>, showLabelsWithImages: boolean, nativeElement: HTMLElement) {
        const IMAGE_SIZE_PERCENT = 0.9;
        const IMAGE_SIZE_HOVER_PERCENT = 1.0;
        const imageYOffset = 8;
        const barImageGroups = svg.selectAll(".bar-image-above-group")
            .data(bars)
            .enter()
            .append("g")
            .attr("class", "bar-image-above-group")
            .attr("transform", d => {
                const xPos = (x(d.label) || 0) + x.bandwidth() / 2;
                const imageHeight = x.bandwidth() * IMAGE_SIZE_PERCENT;
                const yPos = y(d.value) - imageYOffset - (d.getImageUrl() ? imageHeight : 0);
                return `translate(${xPos},${yPos})`;
            });

        let tooltipText: d3.Selection<SVGTextElement, unknown, null, undefined> | null = null;
        const [showCursorText, hideCursorText] = getConfiguredShowCursorText(
            nativeElement,
            svg,
            20,
            new DefaultPlotStyle(),
            -10
        );

        barImageGroups.each(function (d) {
            const group = d3.select(this);
            const imgUrl = d.getImageUrl();
            const barWidth = x.bandwidth();
            const imageSize = barWidth * IMAGE_SIZE_PERCENT;
            const imageSizeHover = barWidth * IMAGE_SIZE_HOVER_PERCENT;
            if (imgUrl) {
                group.append("image")
                    .attr("class", "bar-image-above")
                    .attr("x", -imageSize / 2)
                    .attr("y", 0)
                    .attr("width", imageSize)
                    .attr("height", imageSize)
                    .attr("xlink:href", imgUrl)
                    .attr("href", imgUrl)
                    .on('mousemove', function (event) {
                        d3.select(this)
                            .attr("width", imageSizeHover)
                            .attr("height", imageSizeHover)
                            .attr("x", -imageSizeHover / 2)
                            .attr("y", 0);
                        tooltipText = showCursorText(event, tooltipText, d.label, d3.select(this));
                    })
                    .on('mouseout', function (event) {
                        d3.select(this)
                            .attr("width", imageSize)
                            .attr("height", imageSize)
                            .attr("x", -imageSize / 2)
                            .attr("y", 0);
                        hideCursorText(tooltipText, d3.select(this));
                        tooltipText = null;
                    });
            } else {
                /*
                group.append("text")
                    .attr("class", "bar-label-above")
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("text-anchor", "middle")
                    .style("font-size", "1rem")
                    .style("font-weight", "bold")
                    .style("dominant-baseline", "auto")
                    .text(d.value)
                    .on('mousemove', function (event) {
                        tooltipText = showCursorText(event, tooltipText, d.label, d3.select(this));
                    })
                    .on('mouseout', function (event) {
                        hideCursorText(tooltipText, d3.select(this));
                        tooltipText = null;
                    });
                    */
            }
        });
    }

    private injectBarPlotStyles(hostElement: d3.Selection<HTMLElement, unknown, null, undefined>) {
        hostElement.selectAll("style").remove();
        const styleElement = hostElement.append("style");
        styleElement.text(`
                .bar {
                    transition: opacity 0.1s ease-in-out;
                }
                .bar:hover {
                    opacity: 0.7;
                }
                text.bar-label {
                    fill: var(--text-color);
                    font-weight: bold;
                    font-size: 1rem;
                    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9);
                    user-select: none;
                    -webkit-user-select: none;
                    -moz-user-select: none;
                    -ms-user-select: none;
                }
                .bar-image-label {
                    pointer-events: none;
                }
                .bar-text-label {
                    fill: var(--text-color);
                    font-weight: bold;
                    text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
                    user-select: none;
                }
                image.bar-image-above {
                    rx: 4px;
                    ry: 4px;
                    object-fit: cover;
                    transition: width 0.2s ease, height 0.2s ease, transform 0.2s ease;
                    cursor: pointer;
                    transform-box: fill-box;
                    transform-origin: center;
                }
            `);
    }

    pieChart(plotables: Plotable[], nativeElement: HTMLElement) {
        const offtoOtherYouGoThreshold = 0.025;
        const totalValue = plotables.reduce((sum, p) => sum + p.value, 0);
        const tooSmallSlices = plotables.filter(p => p.value / totalValue < offtoOtherYouGoThreshold);
        const okSlices = plotables.filter(p => p.value / totalValue >= offtoOtherYouGoThreshold);
        const slices = okSlices.concat(
            tooSmallSlices.length > 0 ? [new Plotable(PlottingService.OTHER_LABEL, tooSmallSlices.reduce((sum, p) => sum + p.value, 0), tooSmallSlices[0].color)] : []
        );
        const width = 500;
        const height = 500;
        const radius = Math.min(width, height) / 2;
        const color = d3.scaleOrdinal(slices.map(slice => slice.color))
        const hostElement = d3.select(nativeElement);
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


function getConfiguredShowCursorText(viewport: HTMLElement, plot: any, fontSizeInPx: number, style: any, yOffset: number): [(event: MouseEvent, text: any, textContent: string, node: any) => d3.Selection<SVGTextElement, unknown, null, undefined>, (text: any, node: any) => void] {
    return [
        (event: MouseEvent, text: any, textContent: string, node: any) => {
            const cursorPos = [event.clientX, event.clientY];
            text?.remove();
            // Place tooltip closer to cursor (above and right)
            const offsetX = 12;
            const offsetY = -18;
            text = plot.append('text')
                .attr('x', cursorPos[0] - viewport.getBoundingClientRect().left + offsetX)
                .attr('y', cursorPos[1] - viewport.getBoundingClientRect().top + offsetY)
                .text(textContent)
                .attr('font-size', fontSizeInPx + 'px')
                .attr('fill', style.getTextColor().toString())
                .style('text-anchor', 'start')
                .style('text-shadow', '#000 0px 0px 1px,   #000 0px 0px 1px,   #000 0px 0px 1px,#000 0px 0px 1px,   #000 0px 0px 1px,   #000 0px 0px 1px');
            // Prevent overflow left/right
            const textNode = text.node();
            if (textNode) {
                const overlapLeft = textNode.getBoundingClientRect().left - viewport.getBoundingClientRect().left;
                if (overlapLeft < 0) {
                    text.attr('x', +text.attr('x') - overlapLeft + 2);
                }
                const overlapRight = textNode.getBoundingClientRect().right - viewport.getBoundingClientRect().right;
                if (overlapRight > 0) {
                    text.attr('x', +text.attr('x') - overlapRight - 2);
                }
            }
            return text;
        },
        (text: any, node: any) => {
            node
                .attr('stroke', style.getBorderColor().toString())
                .attr('stroke-width', style.getBorderWidth());
            text?.remove();
        }
    ];
}
