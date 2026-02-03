import { Injectable } from "@angular/core";
import * as d3 from 'd3';

@Injectable({
    providedIn: 'root',
})
export class D3JsService {

    getFont(): string {
        return '"Titillium Web", sans-serif';
    }

    findClosestDataPoint<X, Y>(
        data: Array<{ x: X; y: Y }>,
        mouseX: number,
        mouseY: number,
        xScale: (value: X) => number,
        yScale: (value: Y) => number,
        threshold: number = 30
    ) {
        let closestPoint: any = null;
        let minDistance = Infinity;

        data.forEach(point => {
            const xVal = point.x;
            const yVal = point.y;
            if (xVal === undefined || yVal === undefined) return;
            const pixelX = xScale(xVal);
            const pixelY = yScale(yVal);
            const distance = Math.sqrt(Math.pow(pixelX - mouseX, 2) + Math.pow(pixelY - mouseY, 2));

            if (distance < threshold && distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        });
        return closestPoint;
    }

    formatValue(value: number): string {
        return Number.isInteger(value)
            ? d3.format(',.0f')(value)
            : d3.format(',.2f')(value);
    }

    createLinearScales(
        dataExtent: [number, number],
        range: [number, number],
        zoomDomain?: [number, number]
    ) {
        const domain = zoomDomain || dataExtent;
        return d3.scaleLinear()
            .domain(domain)
            .range([range[0], range[1]]);
    }

    drawAxes(
        svg: any,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        workingHeight: number,
        xAxisTickFormat?: (d: any) => string
    ) {
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${workingHeight})`)
            .call(xAxisTickFormat ? d3.axisBottom(xScale).tickFormat(xAxisTickFormat) : d3.axisBottom(xScale))
            .selectAll('text')
            .style('font-size', '14px')
            .style('font-family', this.getFont());

        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale))
            .selectAll('text')
            .style('font-size', '14px')
            .style('font-family', this.getFont());
    }

    calculateLabelBackground<T extends SVGTextElement = SVGTextElement>(
        textElement: T,
        padding: { x: number; y: number } = { x: 4, y: 2 }
    ): { x: number; y: number; width: number; height: number } {
        const bbox = textElement.getBBox();
        return {
            x: bbox.x - padding.x,
            y: bbox.y - padding.y,
            width: bbox.width + padding.x * 2,
            height: bbox.height + padding.y * 2
        };
    }

    positionTooltip(
        pointX: number,
        pointY: number,
        tooltipWidth: number,
        tooltipHeight: number,
        maxWidth: number,
        maxHeight: number,
        offset: number = 10
    ): { x: number; y: number } {
        return {
            x: Math.min(pointX + offset, maxWidth - tooltipWidth),
            y: Math.max(pointY - offset, 0)
        };
    }
}