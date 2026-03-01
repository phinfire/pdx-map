import { Injectable } from "@angular/core";
import * as d3 from 'd3';
import { Plotable } from "./Plotable";

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

    drawTimeBars(plotables: {label: string, startDate: Date, endDate: Date, rowName: string, color?: string}[], nativeElement: HTMLElement) {
        const width = nativeElement.clientWidth || 1000;
        const height = nativeElement.clientHeight || 500;
        const margin = { top: 20, right: 30, bottom: 150, left: 150 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        const barGap = 8;
        const uniqueRowNames = Array.from(new Set(plotables.map(p => p.rowName))).sort();
        const xScale = d3.scaleTime()
            .domain([
                d3.min(plotables, d => new Date(d.startDate.getFullYear(), 0, 1)) || new Date(),
                d3.max(plotables, d => new Date(d.endDate.getFullYear() + 1, 0, 1)) || new Date()
            ])
            .range([0, chartWidth]);

        const yScale = d3.scaleBand<string>()
            .domain(uniqueRowNames)
            .range([0, chartHeight])
            .padding(0.2);
        const hostElement = d3.select(nativeElement);
        hostElement.selectAll("svg").remove();

        const svgRoot = hostElement.append("svg")
            .attr("width", width)
            .attr("height", height);

        const svg = svgRoot.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d3.timeFormat("%Y-%m-%d") as any);
        
        svg.append("g")
            .attr("transform", `translate(0,${chartHeight})`)
            .call(xAxis)
            .selectAll("text")
            .attr("transform", "rotate(-45)")
            .style("text-anchor", "end")

        svg.append("g")
            .call(d3.axisLeft(yScale))
            .selectAll("text")
            .style("font-size", "1.2em")

        svg.selectAll(".time-bar")
            .data(plotables)
            .enter()
            .append("rect")
            .attr("class", "time-bar")
            .attr("x", d => xScale(new Date(d.startDate)))
            .attr("y", d => (yScale(d.rowName) || 0) + yScale.bandwidth() * 0.25)
            .attr("width", d => Math.max(0, xScale(new Date(d.endDate)) - xScale(new Date(d.startDate)) - barGap))
            .attr("height", yScale.bandwidth() * 0.5)
            .attr("fill", (d: any) => d.color)
            .attr("filter", "url(#drop-shadow)")
            .style("cursor", "pointer");

        svg.selectAll(".time-bar-label")
            .data(plotables)
            .enter()
            .append("text")
            .attr("class", "time-bar-label")
            .attr("x", d => xScale(new Date(d.startDate)) + 4)
            .attr("y", d => (yScale(d.rowName) || 0) + yScale.bandwidth() * 0.25 + yScale.bandwidth() * 0.5 / 2)
            .attr("dominant-baseline", "middle")
            .style("font-size", `${Math.max(10, yScale.bandwidth() * 0.4)}px`)
            .style("font-weight", "bold")
            .style("fill", "#fff")
            .style("pointer-events", "none")
            .text(d => d.label)
            .each(function (d: any) {
                const barWidth = Math.max(0, xScale(new Date(d.endDate)) - xScale(new Date(d.startDate)) - barGap - 8);
                const textNode = this as SVGTextElement;
                const bbox = textNode.getBBox();
                if (bbox.width > barWidth) {
                    let label = d.label;
                    while (label.length > 0) {
                        label = label.slice(0, -1);
                        d3.select(textNode).text(label + "...");
                        const newBbox = textNode.getBBox();
                        if (newBbox.width <= barWidth) {
                            break;
                        }
                    }
                }
            });
        const defs = svgRoot.append("defs");
        defs.append("filter")
            .attr("id", "drop-shadow")
            .attr("x", "-20%")
            .attr("y", "-20%")
            .attr("width", "140%")
            .attr("height", "140%")
            .append("feDropShadow")
            .attr("dx", "2")
            .attr("dy", "2")
            .attr("stdDeviation", "3")
            .attr("flood-color", "#000")
            .attr("flood-opacity", "0.5");
        const styleElement = hostElement.append("style");
        styleElement.text(`
            .time-bar-label {
                font-family: var(--font-family), 'Titillium Web', 'Montserrat', sans-serif;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
        `);

        return svgRoot.node();
    }

    drawBarPlot(plotables: Plotable[], nativeElement: HTMLElement, showLabelsWithImages: boolean, showXAxisTickLabels: boolean) {
        const bars = plotables;
        const width = nativeElement.clientWidth || 800;
        const height = nativeElement.clientHeight || 500;
        console.log(`Drawing bar plot with width ${width} and height ${height} based on ${nativeElement.clientWidth}x${nativeElement.clientHeight} of host element.`);
        const IMAGE_SIZE_PERCENT = 0.9;
        const tempX = d3.scaleBand()
            .domain(bars.map(d => d.label))
            .range([0, width - 80 - 30])
            .padding(0.15);
        const maxImageSize = Math.max(...bars.map(d => tempX.bandwidth() * IMAGE_SIZE_PERCENT));
        const margin = {
            top: Math.max(40, Math.ceil(maxImageSize) + 8),
            right: 30,
            bottom: 50 + (showXAxisTickLabels ? 100 : 0),
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
        return svgRoot.node();
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
            // Reduce vertical shadow to avoid overlap with x-axis
            .attr("dx", "4")
            .attr("dy", "1")
            .attr("stdDeviation", "4")
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
            0
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
                tooltipText = showCursorText(event, tooltipText, d.label + " (" + d.value + ")", d3.select(this));
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
            0
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
        
        // Get the computed background color from the host element
        const computedBgColor = window.getComputedStyle(hostElement.node() || document.body).backgroundColor;
        
        const styleElement = hostElement.append("style");
        styleElement.text(`
                svg {
                    background-color: ${computedBgColor};
                }
                .bar {
                    transition: opacity 0.1s ease-in-out;
                    box-shadow: 0 4px 12px 0 rgba(0,0,0,0.25);
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
                    font-family: var(--header-font-family), 'Montserrat', 'Titillium Web', 'Inconsolata', monospace, sans-serif;
                }
                .bar-image-label {
                    pointer-events: none;
                }
                .bar-text-label {
                    fill: var(--text-color);
                    font-weight: bold;
                    text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
                    user-select: none;
                    font-family: var(--font-family), 'Titillium Web', 'Montserrat', 'Inconsolata', monospace, sans-serif;
                }
                image.bar-image-above {
                    rx: 4px;
                    ry: 4px;
                    object-fit: cover;
                    transition: width 0.2s ease, height 0.2s ease, transform 0.2s ease;
                    cursor: pointer;
                    transform-box: fill-box;
                    transform-origin: center;
                    box-shadow: 0 4px 12px 0 rgba(0,0,0,0.25);
                }
                .plot-tooltip {
                    font-family: 'Inconsolata', monospace, var(--font-family), 'Titillium Web', 'Montserrat', sans-serif;
                    font-size: 1.1em;
                    background: var(--lighter-background-color);
                    color: var(--text-color);
                    border-radius: 6px;
                    padding: 0.5em 1em;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
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
        // Drop shadow filter removed; use CSS box-shadow for slices

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
            .attr("class", "slice"); // Use CSS box-shadow instead
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
                    box-shadow: 0 4px 12px 0 rgba(0,0,0,0.25);
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
                    font-family: var(--header-font-family), 'Montserrat', 'Titillium Web', 'Inconsolata', monospace, sans-serif;
                }
                .plot-tooltip {
                    font-family: 'Inconsolata', monospace, var(--font-family), 'Titillium Web', 'Montserrat', sans-serif;
                    font-size: 1.1em;
                    background: var(--lighter-background-color);
                    color: var(--text-color);
                    border-radius: 6px;
                    padding: 0.5em 1em;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                }
            `);
        return svgRoot.node();
    }
}


function getConfiguredShowCursorText(viewport: HTMLElement, plot: any, fontSizeInPx: number, style: any, yOffset: number): [(event: MouseEvent, text: any, textContent: string, node: any) => d3.Selection<SVGTextElement, unknown, null, undefined>, (text: any, node: any) => void] {
    return [
        (event: MouseEvent, text: any, textContent: string, node: any) => {
            text?.remove();
            const svgElem = (node?.node()?.ownerSVGElement || node?.node()) as SVGSVGElement;
            let x = 0, y = 0;
            if (svgElem && svgElem.createSVGPoint) {
                const pt = svgElem.createSVGPoint();
                pt.x = event.clientX;
                pt.y = event.clientY;
                const ctm = svgElem.getScreenCTM();
                if (ctm) {
                    const svgPt = pt.matrixTransform(ctm.inverse());
                    x = svgPt.x;
                    y = svgPt.y;
                }
            }
            text = plot.append('text')
                .attr('x', x)
                .attr('y', y)
                .text(textContent)
                .attr('font-size', fontSizeInPx + 'px')
                .attr('fill', style.getTextColor().toString())
                .style('text-anchor', 'start')
                .style('text-shadow', '#000 0px 0px 1px, #000 0px 0px 1px');

            if (svgElem) {
                const svgWidth = svgElem.width.baseVal.value || svgElem.clientWidth || 800;
                const textNode = text.node();
                if (textNode && textNode.getBBox) {
                    const bbox = textNode.getBBox();
                    if (x + bbox.width > svgWidth) {
                        text.attr('x', Math.max(0, x - bbox.width - 8));
                    }
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
