import { Component, ElementRef, Input, AfterViewInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import * as d3 from 'd3';
import { map } from 'rxjs/operators';
import { D3JsService } from '../../../services/D3JsService';
import { SkanderbegProxyService } from '../../../services/api/SkanderbegProxyService';
import { MegaModderE2VService } from './MegaModderE2VService';

interface PlayerDevData {
    name: string;
    dev: number;
    color: string;
    nationId?: string;
}

@Component({
    selector: 'app-pop-scale-diagram',
    standalone: true,
    imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatSliderModule, CommonModule],
    template: `
        <div class="controls-container">
            <div>
                <mat-form-field appearance="outline" class="save-selector">
                    <mat-label>Select Save</mat-label>
                    <mat-select [(ngModel)]="selectedSaveId" (selectionChange)="onSaveSelected($event.value)">
                        @for (save of saves; track save) {
                        <mat-option [value]="save.id">
                            {{ save.year }}
                        </mat-option>
                        }
                    </mat-select>
                </mat-form-field>
            </div>

            <div class="sliders-container">
                <div class="slider-row">
                    <label class="slider-label">X-Domain Min:</label>
                    <mat-slider class="slider-control" [min]="xDomainAbsMin" [max]="xDomainAbsMax" [step]="10">
                        <input matSliderThumb [(ngModel)]="xDomainMin" (change)="onXDomainChange()" />
                    </mat-slider>
                    <span class="slider-value">{{ xDomainMin }}</span>
                </div>

                <div class="slider-row">
                    <label class="slider-label">X-Domain Max:</label>
                    <mat-slider class="slider-control" [min]="xDomainAbsMin" [max]="xDomainAbsMax" [step]="10">
                        <input matSliderThumb [(ngModel)]="xDomainMax" (change)="onXDomainChange()" />
                    </mat-slider>
                    <span class="slider-value">{{ xDomainMax }}</span>
                </div>
            </div>
        </div>

        <div #chartContainer></div>
    `,
    styles: [`
        .controls-container {
            display: flex;
            flex-direction: column;
            gap: 1rem;
            margin-bottom: 1rem;
        }

        .sliders-container {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .slider-row {
            display: flex;
            align-items: center;
            gap: 1rem;
        }

        .slider-label {
            width: 100px;
            font-weight: 500;
        }

        .slider-control {
            flex: 1;
            max-width: 400px;
        }

        .slider-value {
            width: 60px;
            text-align: right;
            font-weight: 500;
        }

        .save-selector {
            width: 200px;
        }
    `]
})
export class PopScaleDiagramComponent implements AfterViewInit {
    @ViewChild('chartContainer') chartContainer!: ElementRef;
    @Input() playerDevData: PlayerDevData[] = [];

    private readonly MARKER_SIZE = 8;

    private readonly service = inject(MegaModderE2VService);
    private d3jsService = inject(D3JsService);
    private http = inject(HttpClient);
    private skanderbegProxyService = inject(SkanderbegProxyService);

    selectedSaveId: string = '';
    saves = this.skanderbegProxyService.getAvailableSaves();

    readonly xDomainAbsMin: number = 0;
    readonly xDomainAbsMax: number = 4500;
    readonly STORAGE_KEY_MIN = 'megaModderXDomainMin';
    readonly STORAGE_KEY_MAX = 'megaModderXDomainMax';
    xDomainMin: number = this.xDomainAbsMin;
    xDomainMax: number = this.xDomainAbsMax;
    private currentPlayerDevData: PlayerDevData[] = [];

    ngAfterViewInit(): void {
        this.loadSliderValuesFromLocalStorage();
        if (this.xDomainMin < this.xDomainMax) {
            this.renderChart();
        }
    }

    private loadSliderValuesFromLocalStorage(): void {
        const savedMin = localStorage.getItem(this.STORAGE_KEY_MIN);
        const savedMax = localStorage.getItem(this.STORAGE_KEY_MAX);

        if (savedMin !== null) {
            this.xDomainMin = Math.max(this.xDomainAbsMin, Math.min(parseInt(savedMin, 10), this.xDomainAbsMax));
        }
        if (savedMax !== null) {
            this.xDomainMax = Math.max(this.xDomainAbsMin, Math.min(parseInt(savedMax, 10), this.xDomainAbsMax));
        }
    }

    private saveSliderValuesToLocalStorage(): void {
        localStorage.setItem(this.STORAGE_KEY_MIN, this.xDomainMin.toString());
        localStorage.setItem(this.STORAGE_KEY_MAX, this.xDomainMax.toString());
    }

    private findClosestPointOnCurve(
        data: { x: number; y: number }[],
        mouseX: number,
        mouseY: number,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>
    ): { x: number; y: number } | null {
        return this.d3jsService.findClosestDataPoint(data, mouseX, mouseY, xScale, yScale);
    }

    private findClosestMarker(
        markers: PlayerDevData[],
        mouseX: number,
        mouseY: number,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        markerRadius: number = 15
    ): { x: number; y: number; playerName?: string; nationId?: string } | null {
        if (!markers || markers.length === 0) {
            throw new Error('No markers provided');
        }
        let closestMarker: { x: number; y: number; playerName?: string; nationId?: string } | null = null;
        let minDistance = Infinity;

        markers.forEach(marker => {
            const pixelX = xScale(marker.dev);
            const pixelY = yScale(this.service.getDevelopmentToPopTransformation()(marker.dev));
            const distance = Math.sqrt(
                Math.pow(pixelX - mouseX, 2) + Math.pow(pixelY - mouseY, 2)
            );
            if (distance < markerRadius && distance < minDistance) {
                minDistance = distance;
                closestMarker = {
                    x: marker.dev,
                    y: this.service.getDevelopmentToPopTransformation()(marker.dev),
                    playerName: marker.name,
                    nationId: marker.nationId
                };
            }
        });

        return closestMarker;
    }

    renderChart(playerDevData?: PlayerDevData[]): void {
        if (this.xDomainMin >= this.xDomainMax) {
            const container = d3.select(this.chartContainer.nativeElement);
            container.selectAll('*').remove();
            return;
        }

        if (playerDevData) {
            this.currentPlayerDevData = playerDevData;
        }

        const data = this.generateCurveData();
        const visibleData = data.filter(d => d.dev >= this.xDomainMin && d.dev <= this.xDomainMax);
        const dimensions = { width: 1600, height: 800, marginLeft: 70, marginTop: 20, marginRight: 30, marginBottom: 50 };
        const colors = this.extractThemeColors();

        const container = d3.select(this.chartContainer.nativeElement);
        container.selectAll('*').remove();
        const svg = this.createSvgContainer(container, dimensions);

        const scales = this.createScales(data, dimensions);
        const workingWidth = dimensions.width - dimensions.marginLeft - dimensions.marginRight;
        const workingHeight = dimensions.height - dimensions.marginTop - dimensions.marginBottom;

        this.drawCurve(svg, visibleData, scales);
        this.drawPlayerMarkers(svg, playerDevData || this.currentPlayerDevData, scales);
        this.drawAxes(svg, scales, workingHeight);
        this.drawAxisLabels(svg, workingWidth, workingHeight);

        this.setupHoverInteraction(svg, scales, visibleData, playerDevData || this.currentPlayerDevData, colors, dimensions, workingWidth, workingHeight);
    }

    private generateCurveData(): { dev: number; value: number }[] {
        const data: { dev: number; value: number }[] = [];
        for (let i = 0; i <= 4500; i += 10) {
            data.push({ dev: i, value: this.service.getDevelopmentToPopTransformation()(i) });
        }
        return data;
    }

    private extractThemeColors() {
        return {
            accent: window.getComputedStyle(document.documentElement).getPropertyValue('--mat-sys-primary').trim() || '#1976d2',
            background: window.getComputedStyle(document.documentElement).getPropertyValue('--lighter-background-color').trim() || 'rgb(37, 37, 37)',
            text: window.getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || 'rgba(255, 255, 255, 0.9)',
            border: window.getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || 'rgba(255, 255, 255, 0.9)'
        };
    }

    private createSvgContainer(container: any, dimensions: any) {
        const { width, height, marginLeft, marginTop } = dimensions;
        return container
            .append('svg')
            .attr('width', width + marginLeft + 30)
            .attr('height', height + marginTop + 50)
            .style('width', '100%')
            .style('height', '100%')
            .append('g')
            .attr('transform', `translate(${marginLeft},${marginTop})`);
    }

    private createScales(data: { dev: number; value: number }[], dimensions: any) {
        const { width, height } = dimensions;
        const workingWidth = width - 70 - 30;
        const workingHeight = height - 20 - 50;

        return {
            x: d3.scaleLinear()
                .domain([this.xDomainMin, this.xDomainMax])
                .range([0, workingWidth]),
            y: d3.scaleLinear()
                .domain([0, d3.max(data, d => d.value) as number])
                .range([workingHeight, 0])
        };
    }

    private drawCurve(svg: any, visibleData: { dev: number; value: number }[], scales: any) {
        const line = d3.line<{ dev: number; value: number }>()
            .x(d => scales.x(d.dev))
            .y(d => scales.y(d.value));

        svg.append('path')
            .datum(visibleData)
            .attr('fill', 'none')
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('d', line);
    }

    private drawPlayerMarkers(svg: any, playerDevData: PlayerDevData[], scales: any) {
        if (!playerDevData || playerDevData.length === 0) return;

        svg.selectAll('.player-marker')
            .data(playerDevData)
            .enter()
            .append('circle')
            .attr('class', 'player-marker')
            .attr('cx', (d: any) => scales.x(d.dev))
            .attr('cy', (d: any) => scales.y(this.service.getDevelopmentToPopTransformation()(d.dev)))
            .attr('r', 5)
            .attr('fill', (d: any) => d.color)
            .attr('stroke', (d: any) => d.color)
            .attr('stroke-width', 1.5)
            .style('opacity', 1);
    }

    private setupHoverInteraction(svg: any, scales: any, visibleData: any, playerDevData: PlayerDevData[], colors: any, dimensions: any, workingWidth: number, workingHeight: number) {
        const hoverGroup = svg.append('g').attr('class', 'hover-group').style('pointer-events', 'none');

        const marker = hoverGroup.append('circle')
            .attr('class', 'hover-marker')
            .attr('r', this.MARKER_SIZE)
            .style('fill', colors.accent)
            .style('stroke', 'none')
            .style('opacity', 0);

        const flagImage = hoverGroup.append('image')
            .attr('class', 'flag-image')
            .attr('width', 72)
            .attr('height', 72)
            .style('opacity', 0)
            .style('filter', 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))');

        const label = hoverGroup.append('g').attr('class', 'hover-label').style('opacity', 0);
        label.append('rect')
            .attr('class', 'label-bg')
            .attr('rx', 4)
            .attr('ry', 4)
            .style('fill', colors.background)
            .style('filter', 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5))');

        label.append('text')
            .attr('class', 'label-text')
            .style('fill', colors.text)
            .style('font-size', '14px')
            .style('font-family', this.d3jsService.getFont())
            .style('pointer-events', 'none');

        const overlay = svg.append('rect')
            .attr('class', 'overlay')
            .attr('width', workingWidth)
            .attr('height', workingHeight)
            .style('fill', 'none')
            .style('pointer-events', 'all');

        overlay.on('mousemove', (event: MouseEvent) => {
            const mousePos = d3.pointer(event, overlay.node());

            let closestPoint: { x: number; y: number } | null = null;
            if (playerDevData && playerDevData.length > 0) {
                closestPoint = this.findClosestMarker(playerDevData, mousePos[0], mousePos[1], scales.x, scales.y);
            }
            if (!closestPoint) {
                closestPoint = this.findClosestPointOnCurve(visibleData, mousePos[0], mousePos[1], scales.x, scales.y);
            }
            if (closestPoint) {
                const pixelX = scales.x(closestPoint.x);
                const pixelY = scales.y(closestPoint.y);

                marker
                    .attr('cx', pixelX)
                    .attr('cy', pixelY)
                    .style('opacity', 1);

                const valueStr = this.d3jsService.formatValue(closestPoint.y);

                let labelLines: string[] = [];
                if ('playerName' in closestPoint && closestPoint.playerName && typeof closestPoint.playerName === 'string') {
                    labelLines = [closestPoint.playerName, `Dev: ${closestPoint.x}, Pop: ${valueStr}M`];
                } else {
                    labelLines = [`Dev: ${closestPoint.x}, Pop: ${valueStr}M`];
                }

                const textEl = label.select('text');
                textEl.selectAll('tspan').remove();
                textEl.attr('x', 6).attr('y', 14);

                labelLines.forEach((line, idx) => {
                    textEl.append('tspan')
                        .attr('x', 6)
                        .attr('dy', idx === 0 ? 0 : '1.2em')
                        .text(line);
                });

                const bbox = (textEl.node() as SVGTextElement).getBBox();
                const bgRect = this.d3jsService.calculateLabelBackground(textEl.node() as SVGTextElement);

                if ('nationId' in closestPoint && closestPoint.nationId && typeof closestPoint.nationId === 'string') {
                    const labelX = Math.min(pixelX + 10, workingWidth - 150);
                    const labelY = Math.max(pixelY - 30, 0);
                    const flagX = labelX + (bbox.width + 8 - 72) / 2;
                    const flagY = labelY + bbox.height + 32;

                    flagImage
                        .attr('href', `https://codingafterdark.de/mc/ideas/flags/${closestPoint.nationId}.webp`)
                        .attr('x', flagX)
                        .attr('y', flagY)
                        .style('opacity', 1);
                } else {
                    flagImage.style('opacity', 0);
                }

                label.select('rect')
                    .attr('x', bgRect.x)
                    .attr('y', bgRect.y)
                    .attr('width', bgRect.width)
                    .attr('height', bgRect.height);

                const labelPos = this.d3jsService.positionTooltip(pixelX, pixelY, 150, bgRect.height, workingWidth, workingHeight);

                label
                    .attr('transform', `translate(${labelPos.x},${labelPos.y})`)
                    .style('opacity', 1);
            }
        });

        overlay.on('mouseleave', () => {
            marker.style('opacity', 0);
            label.style('opacity', 0);
        });
    }

    private drawAxes(svg: any, scales: any, workingHeight: number) {
        this.d3jsService.drawAxes(svg, scales.x, scales.y, workingHeight);
    }

    private drawAxisLabels(svg: any, workingWidth: number, workingHeight: number) {
        svg.append('text')
            .attr('x', workingWidth / 2)
            .attr('y', workingHeight + 40)
            .attr('text-anchor', 'middle')
            .style('fill', 'currentColor')
            .style('font-family', this.d3jsService.getFont())
            .style('font-size', '14px')
            .text('EU4 Development');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -workingHeight / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .style('fill', 'currentColor')
            .style('font-family', this.d3jsService.getFont())
            .style('font-size', '14px')
            .text('Vic3 Population (millions)');
    }

    onSaveSelected(saveId: string): void {
        if (saveId) {
            this.http.get<any>(
                `https://codingafterdark.de/skanderbeg/getSaveDataDump?save=${saveId}`
            ).pipe(
                map(data => this.extractPlayerDevData(data))
            ).subscribe(playerDevData => {
                this.renderChart(playerDevData);
            });
        }
    }

    onXDomainChange(): void {
        this.saveSliderValuesToLocalStorage();
        this.renderChart(this.currentPlayerDevData);
    }

    private extractPlayerDevData(data: any): PlayerDevData[] {
        return Object.entries(data)
            .filter(([_, country]: [string, any]) => country && typeof country === 'object' && 'player' in country)
            .map(([countryId, country]: [string, any]) => ({
                name: country.player || countryId,
                dev: parseInt(country.total_development ?? 0),
                color: this.extractColor(country.map_color),
                nationId: countryId
            }))
            .sort((a, b) => b.dev - a.dev);
    }

    private extractColor(mapColor: any): string {
        if (!mapColor || typeof mapColor !== 'object') {
            return '#808080';
        }
        const r = Math.min(255, Math.max(0, parseInt(mapColor.r ?? 0) || 0));
        const g = Math.min(255, Math.max(0, parseInt(mapColor.g ?? 0) || 0));
        const b = Math.min(255, Math.max(0, parseInt(mapColor.b ?? 0) || 0));
        return `rgb(${r},${g},${b})`;
    }
}
