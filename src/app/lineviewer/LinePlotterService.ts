import { inject, Injectable } from '@angular/core';
import * as d3 from 'd3';
import { D3JsService } from '../../services/D3JsService';
import { DataSeries } from './model/DataSeries';

@Injectable({
    providedIn: 'root'
})
export class LinePlotterService {

    private readonly MARKER_SIZE = 8;
    private readonly TRIANGLE_SIZE = 14;
    private readonly AXIS_TEXT_COLOR = 'currentColor';

    private d3jsService = inject(D3JsService);

    public redrawChart(dataSeries: DataSeries[], chartContainer: HTMLElement, showDataPoints: boolean): SVGSVGElement {
        if (dataSeries.length === 0) {
            return document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
        }

        const margin = { top: 20, right: 100, bottom: 50, left: 30 };
        const width = chartContainer.clientWidth - margin.left - margin.right;
        const height = chartContainer.clientHeight - margin.top - margin.bottom;

        const svgSelection = d3.create('svg:svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('width', '100%')
            .style('height', '100%');

        const gSelection = svgSelection.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const allData = dataSeries.flatMap(s => s.values);
        const xExtent = d3.extent(allData, d => d.x) as [number, number];
        const yExtent = d3.extent(allData, d => d.y) as [number, number];

        const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.05;

        const xScale = d3.scaleLinear()
            .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
            .range([height, 0]);

        const line = d3.line<{ x: number; y: number }>()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y));

        gSelection.append('g')
            .attr('class', 'grid')
            .attr('opacity', 0.1)
            .call(d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat(() => ''));

        gSelection.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickFormat(d3.format('d')))
            .selectAll('text')
            .style('font-size', '14px')
            .style('font-family', this.d3jsService.getFont());

        gSelection.append('g')
            .attr('class', 'y-axis')
            .attr('transform', `translate(${width},0)`)
            .call(d3.axisRight(yScale))
            .selectAll('text')
            .style('font-size', '14px')
            .style('font-family', this.d3jsService.getFont());

        const linesGroup = gSelection.append('g').attr('class', 'lines-group');
        const pointsGroup = gSelection.append('g').attr('class', 'points-group').style('pointer-events', 'none');
        const hoverGroup = gSelection.append('g').attr('class', 'hover-group').style('pointer-events', 'none');

        dataSeries.forEach(series => {
            linesGroup.append('path')
                .datum(series.values)
                .attr('class', 'line')
                .attr('d', line)
                .attr('stroke', series.color)
                .attr('stroke-width', 2)
                .attr('fill', 'none');

            if (showDataPoints) {
                series.values.forEach(point => {
                    pointsGroup.append('circle')
                        .attr('cx', xScale(point.x))
                        .attr('cy', yScale(point.y))
                        .attr('r', 5)
                        .attr('fill', series.color)
                });
            }
        });

        const overlay = gSelection.append('rect')
            .attr('class', 'overlay')
            .attr('width', width)
            .attr('height', height)
            .style('fill', 'none')
            .style('pointer-events', 'all');

        const marker = hoverGroup.append('circle')
            .attr('class', 'hover-marker')
            .attr('r', this.MARKER_SIZE)
            .style('fill', 'white')
            .style('stroke', 'black')
            .style('stroke-width', 2)
            .style('opacity', 0);

        const xAxisTriangle = hoverGroup.append('polygon')
            .attr('class', 'hover-triangle')
            .style('opacity', 0);

        const xAxisLabel = hoverGroup.append('text')
            .attr('class', 'hover-triangle-label')
            .style('opacity', 0)
            .style('font-family', this.d3jsService.getFont())
            .style('font-size', '14px')
            .style('text-anchor', 'middle')
            .style('pointer-events', 'none');

        const label = hoverGroup.append('g').attr('class', 'hover-label').style('opacity', 0);
        label.append('rect')
            .attr('class', 'label-bg')
            .attr('rx', 4)
            .attr('ry', 4)
            .style('fill', 'white')
            .style('stroke', 'black')
            .style('stroke-width', 1);

        label.append('text')
            .attr('class', 'label-text')
            .style('fill', 'black')
            .style('font-size', '14px')
            .style('font-family', this.d3jsService.getFont())
            .style('pointer-events', 'none');

        overlay.on('mousemove', (event: MouseEvent) => {
            const mousePos = d3.pointer(event, overlay.node());
            const nearestPoint = this.findNearestPoint(dataSeries, mousePos[0], mousePos[1], xScale, yScale);
            
            if (nearestPoint !== null) {
                this.updateMarkerAndLabel(marker, xAxisTriangle, xAxisLabel, label, nearestPoint, xScale, yScale, width, height);
            } else {
                this.hideMarkerAndLabel(marker, xAxisTriangle, xAxisLabel, label);
            }
        });

        overlay.on('mouseleave', () => {
            marker.style('opacity', 0);
            xAxisTriangle.style('opacity', 0);
            xAxisLabel.style('opacity', 0);
            label.style('opacity', 0);
        });

        return svgSelection.node() as SVGSVGElement;
    }

    private findNearestPoint(
        dataSeries: DataSeries[],
        mouseX: number,
        mouseY: number,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>
    ): { series: DataSeries; point: { x: number; y: number }; distance: number } | null {
        const xValue = xScale.invert(mouseX);
        let nearestPoint: { series: DataSeries; point: { x: number; y: number }; distance: number } | null = null;

        dataSeries.forEach(series => {
            const closest = this.findClosestPointInSeries(series, xValue, xScale, yScale, mouseX, mouseY);
            if (closest && (!nearestPoint || closest.distance < nearestPoint.distance)) {
                nearestPoint = closest;
            }
        });

        return nearestPoint;
    }

    private findClosestPointInSeries(
        series: DataSeries,
        xValue: number,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        mouseX: number,
        mouseY: number
    ): { series: DataSeries; point: { x: number; y: number }; distance: number } | null {
        const threshold = 30;
        const closestPoint = this.d3jsService.findClosestPoint(series.values, mouseX, mouseY, xScale, yScale, threshold);
        
        if (!closestPoint) return null;

        const pixelX = xScale(closestPoint.x);
        const pixelY = yScale(closestPoint.y);
        const distance = Math.sqrt(
            Math.pow(pixelX - mouseX, 2) + Math.pow(pixelY - mouseY, 2)
        );

        return {
            series,
            point: { x: closestPoint.x, y: closestPoint.y },
            distance
        };
    }

    private updateMarkerAndLabel(
        marker: d3.Selection<SVGCircleElement, undefined, null, undefined>,
        xAxisTriangle: d3.Selection<SVGPolygonElement, undefined, null, undefined>,
        xAxisLabel: d3.Selection<SVGTextElement, undefined, null, undefined>,
        label: d3.Selection<SVGGElement, undefined, null, undefined>,
        nearestPoint: { series: DataSeries; point: { x: number; y: number }; distance: number },
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        width: number,
        height: number
    ): void {
        const pixelX = xScale(nearestPoint.point.x);
        const pixelY = yScale(nearestPoint.point.y);

        this.updateMarker(marker, pixelX, pixelY, nearestPoint.series.color);
        this.updateAxisTriangle(xAxisTriangle, xAxisLabel, pixelX, height, nearestPoint.point.x);
        this.updateLabel(label, nearestPoint, pixelX, pixelY, width);
    }

    private updateMarker(
        marker: d3.Selection<SVGCircleElement, undefined, null, undefined>,
        pixelX: number,
        pixelY: number,
        color: string
    ): void {
        marker
            .attr('cx', pixelX)
            .attr('cy', pixelY)
            .style('stroke', color)
            .style('fill', color)
            .style('opacity', 1);
    }

    private updateAxisTriangle(
        triangle: d3.Selection<SVGPolygonElement, undefined, null, undefined>,
        yearLabel: d3.Selection<SVGTextElement, undefined, null, undefined>,
        pixelX: number,
        height: number,
        year: number
    ): void {
        const triangleOffset = 4;
        const points = [
            [pixelX, height + triangleOffset],
            [pixelX - this.TRIANGLE_SIZE / 2, height + triangleOffset + this.TRIANGLE_SIZE],
            [pixelX + this.TRIANGLE_SIZE / 2, height + triangleOffset + this.TRIANGLE_SIZE]
        ];
        
        triangle
            .attr('points', points.map(p => p.join(',')).join(' '))
            .style('fill', this.AXIS_TEXT_COLOR)
            .style('opacity', 1);
        
        yearLabel
            .text(year.toString())
            .attr('x', pixelX)
            .attr('y', height + triangleOffset + this.TRIANGLE_SIZE + 14)
            .style('fill', this.AXIS_TEXT_COLOR)
            .style('opacity', 1);
    }

    private updateLabel(
        label: d3.Selection<SVGGElement, undefined, null, undefined>,
        nearestPoint: { series: DataSeries; point: { x: number; y: number }; distance: number },
        pixelX: number,
        pixelY: number,
        width: number
    ): void {
        const value = nearestPoint.point.y;
        const valueStr = this.d3jsService.formatValue(value);
        const labelText = `${nearestPoint.series.name}: ${valueStr}`;

        const textEl = label.select('text')
            .text(labelText)
            .attr('x', 6)
            .attr('y', 14);

        const bgRect = this.d3jsService.calculateLabelBackground(textEl.node() as SVGTextElement);
        const bgColor = nearestPoint.series.color;
        const textColor = this.isLightColor(bgColor) ? 'black' : 'white';
        
        label.select('text')
            .style('fill', textColor);
        
        label.select('rect')
            .attr('x', bgRect.x)
            .attr('y', bgRect.y)
            .attr('width', bgRect.width)
            .attr('height', bgRect.height)
            .style('fill', bgColor)
            .style('opacity', 0.9);

        const labelPos = this.d3jsService.positionTooltip(pixelX, pixelY, 150, bgRect.height, width, 400);

        label
            .attr('transform', `translate(${labelPos.x},${labelPos.y})`)
            .style('opacity', 1);
    }

    private isLightColor(color: string): boolean {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5;
    }

    private hideMarkerAndLabel(
        marker: d3.Selection<SVGCircleElement, undefined, null, undefined>,
        xAxisTriangle: d3.Selection<SVGPolygonElement, undefined, null, undefined>,
        xAxisLabel: d3.Selection<SVGTextElement, undefined, null, undefined>,
        label: d3.Selection<SVGGElement, undefined, null, undefined>
    ): void {
        marker.style('opacity', 0);
        xAxisTriangle.style('opacity', 0);
        xAxisLabel.style('opacity', 0);
        label.style('opacity', 0);
    }
}