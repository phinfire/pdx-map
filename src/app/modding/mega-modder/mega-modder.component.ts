
import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, inject, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import * as d3 from 'd3';
import { map } from 'rxjs/operators';
import { Vic3GameFilesService } from '../../../model/vic/Vic3GameFilesService';
import { SkanderbegProxyService } from '../../../services/api/SkanderbegProxyService';
import { D3JsService } from '../../../services/D3JsService';
import { PdxFileService } from '../../../services/pdx-file.service';
import { TableColumn } from '../../../util/table/TableColumn';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { MegaModderE2VService } from './MegaModderE2VService';

@Component({
    selector: 'app-mega-modder',
    imports: [MatTabsModule, MatSelectModule, MatFormFieldModule, MatSliderModule, FormsModule, TableComponent],
    templateUrl: './mega-modder.component.html',
    styleUrl: './mega-modder.component.scss',
})
export class MegaModderComponent implements AfterViewInit {

    @ViewChild('chartContainer') chartContainer!: ElementRef;
    @ViewChild('devChartContainer') devChartContainer!: ElementRef;

    private readonly MARKER_SIZE = 8;

    private readonly service = inject(MegaModderE2VService);
    private d3jsService = inject(D3JsService);
    private http = inject(HttpClient);
    private vic3GameFilesService = inject(Vic3GameFilesService);
    private skanderbegProxyService = inject(SkanderbegProxyService);
    private pdxFileService = inject(PdxFileService);

    selectedSaveId: string = '';
    saves = this.skanderbegProxyService.getAvailableSaves();

    readonly xDomainAbsMin: number = 0;
    readonly xDomainAbsMax: number = 4500;
    readonly STORAGE_KEY_MIN = 'megaModderXDomainMin';
    readonly STORAGE_KEY_MAX = 'megaModderXDomainMax';
    xDomainMin: number = this.xDomainAbsMin;
    xDomainMax: number = this.xDomainAbsMax;
    private currentPlayerDevData: Array<{ name: string; dev: number; color: string; nationId?: string }> = [];
    mappingTableRows: Array<{ eu4Name: string; vic3Tag: string; eu4Dev: number; vic3Pop: number; adjustedVic3Pop: number; totalAdjustedVic3Pop: number; unityAdjustedVic3Pop: number; unityTotalVic3Pop: number }> = [];
    mappingTableColumns: TableColumn<{ eu4Name: string; vic3Tag: string; eu4Dev: number; vic3Pop: number; adjustedVic3Pop: number; totalAdjustedVic3Pop: number; unityAdjustedVic3Pop: number; unityTotalVic3Pop: number }>[] = [
        new TableColumn('name', 'EU4 Tag', null, true, (e) => e.eu4Name, () => null),
        new TableColumn('vic3Tag', 'Vic3 Tag', null, true, (e) => e.vic3Tag, () => null),
        new TableColumn('eu4Dev', 'Dev', null, true, (e) => e.eu4Dev, () => null),
        new TableColumn('vic3Pop', 'Raw', null, true, (e) => e.vic3Pop, () => null),
        //new TableColumn('adjustedVic3Pop', 'Opt.1', null, true, (e) => e.adjustedVic3Pop, () => null),
        new TableColumn('totalAdjustedVic3Pop', 'Opt.1 Σ  ', "Nations and their vassals scaled by overlord ratio", true, (e) => e.totalAdjustedVic3Pop, () => null),
        //new TableColumn('unityAdjustedVic3Pop', 'Opt.2', null, true, (e) => e.unityAdjustedVic3Pop, () => null),
        new TableColumn('unityTotalVic3Pop', 'Opt.2 Σ ', "Nations and their vassals scaled by combined ratio", true, (e) => e.unityTotalVic3Pop, () => null)
    ];

    ngAfterViewInit(): void {
        this.loadSliderValuesFromLocalStorage();
        if (this.xDomainMin < this.xDomainMax) {
            this.renderChart();
        }
        this.testGuessTagMapping();
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
        data: { dev: number; value: number }[],
        mouseX: number,
        mouseY: number,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>
    ): { dev: number; value: number } | null {
        return this.d3jsService.findClosestPoint(data, mouseX, mouseY, xScale, yScale) as any;
    }

    private findClosestMarker(
        markers: Array<{ name: string; dev: number; color: string; nationId?: string }>,
        mouseX: number,
        mouseY: number,
        xScale: d3.ScaleLinear<number, number>,
        yScale: d3.ScaleLinear<number, number>,
        markerRadius: number = 15
    ): { dev: number; value: number; playerName?: string; nationId?: string } | null {
        let closestMarker: { dev: number; value: number; playerName?: string; nationId?: string } | null = null;
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
                    dev: marker.dev,
                    value: this.service.getDevelopmentToPopTransformation()(marker.dev),
                    playerName: marker.name,
                    nationId: marker.nationId
                };
            }
        });

        return closestMarker;
    }

    renderChart(playerDevData?: Array<{ name: string; dev: number; color: string }>): void {
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
        this.drawPlayerMarkers(svg, playerDevData, scales);
        this.drawAxes(svg, scales, workingHeight);
        this.drawAxisLabels(svg, workingWidth, workingHeight);

        this.setupHoverInteraction(svg, scales, visibleData, playerDevData, colors, dimensions, workingWidth, workingHeight);
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

    private drawPlayerMarkers(svg: any, playerDevData: any, scales: any) {
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

    private setupHoverInteraction(svg: any, scales: any, visibleData: any, playerDevData: any, colors: any, dimensions: any, workingWidth: number, workingHeight: number) {
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

            let closestPoint: { dev: number; value: number } | null = null;
            if (playerDevData && playerDevData.length > 0) {
                closestPoint = this.findClosestMarker(playerDevData, mousePos[0], mousePos[1], scales.x, scales.y);
            }
            if (!closestPoint) {
                closestPoint = this.findClosestPointOnCurve(visibleData, mousePos[0], mousePos[1], scales.x, scales.y);
            }
            if (closestPoint) {
                const pixelX = scales.x(closestPoint.dev);
                const pixelY = scales.y(closestPoint.value);

                marker
                    .attr('cx', pixelX)
                    .attr('cy', pixelY)
                    .style('opacity', 1);

                const valueStr = this.d3jsService.formatValue(closestPoint.value);

                let labelLines: string[] = [];
                if ('playerName' in closestPoint && closestPoint.playerName && typeof closestPoint.playerName === 'string') {
                    labelLines = [closestPoint.playerName, `Dev: ${closestPoint.dev}, Pop: ${valueStr}M`];
                } else {
                    labelLines = [`Dev: ${closestPoint.dev}, Pop: ${valueStr}M`];
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

    private extractPlayerDevData(data: any): Array<{ name: string; dev: number; color: string; nationId?: string }> {
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



    private renderDevChart(playerDevData: Array<{ name: string; dev: number; color: string }>): void {
        console.log('Rendering dev chart with data:', playerDevData);
        const accentColor = window.getComputedStyle(document.documentElement).getPropertyValue('--mat-sys-primary').trim() || '#1976d2';
        const bgColor = window.getComputedStyle(document.documentElement).getPropertyValue('--lighter-background-color').trim() || 'rgb(37, 37, 37)';
        const textColor = window.getComputedStyle(document.documentElement).getPropertyValue('--text-color').trim() || 'rgba(255, 255, 255, 0.9)';

        const margin = { top: 20, right: 30, bottom: 150, left: 70 };
        const width = 800 - margin.left - margin.right;
        const height = 400 - margin.top - margin.bottom;

        const container = d3.select(this.devChartContainer.nativeElement);
        container.selectAll('*').remove();

        const svg = container
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .style('width', '100%')
            .style('height', '100%')
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const maxDev = Math.max(...playerDevData.map(d => d.dev));
        const yScale = d3.scaleLinear()
            .domain([0, maxDev * 1.1])
            .range([height, 0]);

        const xScale = d3.scaleBand()
            .domain(playerDevData.map(d => d.name))
            .range([0, width])
            .padding(0.4);

        // Draw bars
        svg.selectAll('.bar')
            .data(playerDevData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => xScale(d.name) as number)
            .attr('y', d => yScale(d.dev))
            .attr('width', xScale.bandwidth())
            .attr('height', d => height - yScale(d.dev))
            .attr('fill', d => d.color);

        // X Axis
        svg
            .append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale))
            .selectAll('text')
            .style('font-size', '12px')
            .style('font-family', this.d3jsService.getFont())
            .style('text-anchor', 'end')
            .attr('dx', '-0.5em')
            .attr('dy', '0.15em')
            .attr('transform', 'rotate(-45)');

        // Y Axis
        svg
            .append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(yScale))
            .selectAll('text')
            .style('font-size', '14px')
            .style('font-family', this.d3jsService.getFont());

        svg
            .append('text')
            .attr('x', width / 2)
            .attr('y', height + 100)
            .attr('text-anchor', 'middle')
            .style('fill', 'currentColor')
            .style('font-family', this.d3jsService.getFont())
            .style('font-size', '14px')
            .text('Player Nations');

        svg
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -50)
            .attr('text-anchor', 'middle')
            .style('fill', 'currentColor')
            .style('font-family', this.d3jsService.getFont())
            .style('font-size', '14px')
            .text('Total Development');
    }

    testGuessTagMapping(): void {
        const eu4SaveURL = "http://localhost:5500/public/mp_Palatinate1705_10_30.eu4";
        this.pdxFileService.loadEu4SaveFromUrl(eu4SaveURL)
            .then(save => this.processEu4Save(save))
            .catch(error => console.error('Failed to load EU4 save:', error));
    }

    private processEu4Save(save: any): void {
        const provinces = new Map<string, any>();
        for (const [key, prov] of save.getProvinces().entries()) {
            if (prov.getOwner() != null) {
                provinces.set(key, prov);
            }
        }
        this.vic3GameFilesService.getHistoryStateRegions().subscribe(historyRegions => {
            const vic3OwnershipMap = this.buildVic3OwnershipMap(historyRegions);
            this.service.guessTagMapping(provinces, vic3OwnershipMap).subscribe(mapping => {
                this.processTagMapping(save, provinces, mapping);
            });
        });
    }

    private buildVic3OwnershipMap(historyRegions: any[]): Map<string, string> {
        const vic3OwnershipMap = new Map<string, string>();
        for (const region of historyRegions) {
            for (const provinceId of region.tiles) {
                vic3OwnershipMap.set(provinceId, region.ownerCountryTag);
            }
        }
        return vic3OwnershipMap;
    }

    private processTagMapping(save: any, provinces: Map<any, any>, mapping: Map<any, any>): void {
        console.log('Guessed tag mapping:', mapping.size);
        console.log("Nation tags in save:", save.getAllExistingCountryTags().size);

        const sortedLexByEu4Tags = Array.from(mapping.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        const eu4DevByTag = this.buildEu4DevByTag(provinces);

        this.vic3GameFilesService.getModPops().subscribe((pops: any) => {
            const vic3PopByTag = this.buildVic3PopByTag(pops);
            this.buildMappingTableRows(save, sortedLexByEu4Tags, eu4DevByTag, vic3PopByTag);
        });
    }

    private buildEu4DevByTag(provinces: Map<any, any>): Map<string, number> {
        const eu4DevByTag = new Map<string, number>();
        provinces.forEach((prov) => {
            const owner = prov.getOwner();
            if (owner) {
                const tag = owner.getTag();
                const currentDev = eu4DevByTag.get(tag) || 0;
                const devArray = prov.getDevelopment();
                const provDev = Array.isArray(devArray) ? devArray.reduce((a, b) => a + b, 0) : devArray;
                eu4DevByTag.set(tag, currentDev + provDev);
            }
        });
        return eu4DevByTag;
    }

    private buildVic3PopByTag(pops: any[]): Map<string, number> {
        const vic3PopByTag = new Map<string, number>();
        for (const pop of pops) {
            if (!vic3PopByTag.has(pop.countryTag)) {
                vic3PopByTag.set(pop.countryTag, 0);
            }
            const currentPop = vic3PopByTag.get(pop.countryTag) || 0;
            vic3PopByTag.set(pop.countryTag, currentPop + pop.size);
        }
        return vic3PopByTag;
    }

    private buildMappingTableRows(save: any, sortedLexByEu4Tags: Array<[string, string]>, eu4DevByTag: Map<string, number>, vic3PopByTag: Map<string, number>): void {
        const rows: any[] = [];
        for (const [eu4Tag, vic3Tag] of sortedLexByEu4Tags) {
            const eu4Nation = save.getCountry(eu4Tag);
            if (!eu4Nation.isIndependent()) {
                continue;
            }
            const groupNations: Array<[string, string]> = [
                [eu4Tag, vic3Tag],
                ...sortedLexByEu4Tags.filter(
                    ([subjectTag]) => save.getCountry(subjectTag).getOverlordTag() === eu4Tag
                )
            ];

            const totalGroupDev = groupNations.map(([tag]) => eu4DevByTag.get(tag) || 0).reduce((a, b) => a + b, 0);
            const overlordDev = eu4DevByTag.get(eu4Tag) || 0;
            const overlordRatio = 1000000 * this.service.getDevelopmentToPopTransformation()(overlordDev) / overlordDev;
            const groupBalancedDevPopRatio = 1000000 * this.service.getDevelopmentToPopTransformation()(totalGroupDev) / totalGroupDev;
            const localRows = [];
            for (const [tag, vic3MapTag] of groupNations) {
                const nation = save.getCountry(tag);
                const name = nation.getName();
                const dev = eu4DevByTag.get(tag) || 0;
                const adjustedPop = Math.floor(overlordRatio * dev);
                const unityAdjustedPop = Math.floor(groupBalancedDevPopRatio * dev);
                localRows.push({
                    eu4Name: nation.getOverlordTag() == null ? name : nation.getOverlordTag() + "'s " + name,
                    vic3Tag: vic3MapTag,
                    eu4Dev: dev,
                    vic3Pop: vic3PopByTag.get(vic3MapTag) || 0,
                    adjustedVic3Pop: adjustedPop,
                    totalAdjustedVic3Pop: adjustedPop,
                    unityAdjustedVic3Pop: unityAdjustedPop,
                    unityTotalVic3Pop: unityAdjustedPop,
                });
            }
            const totalAdjustedPop = localRows.map(r => r.adjustedVic3Pop).reduce((a, b) => a + b, 0);
            const totalUnityAdjustedPop = localRows.map(r => r.unityAdjustedVic3Pop).reduce((a, b) => a + b, 0);
            localRows[0].totalAdjustedVic3Pop = totalAdjustedPop;
            localRows[0].unityTotalVic3Pop = totalUnityAdjustedPop;
            
            rows.push(...localRows);
        }
        this.mappingTableRows = rows;
    }
}