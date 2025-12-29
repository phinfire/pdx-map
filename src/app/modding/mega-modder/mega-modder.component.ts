
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Vic3GameFilesService } from '../../../model/vic/Vic3GameFilesService';
import { PdxFileService } from '../../../services/pdx-file.service';
import { TableColumn } from '../../../util/table/TableColumn';
import { TableComponent } from '../../vic3-country-table/vic3-country-table.component';
import { MegaModderE2VService, MappingTableRow } from './MegaModderE2VService';
import { ModPop } from '../../../model/vic/game/ModPop';
import { Eu4Save } from '../../../model/eu4/Eu4Save';
import { PopScaleDiagramComponent } from './pop-scale-diagram.component';
import { forkJoin } from 'rxjs';
import { MapStateRegion } from '../../../model/vic/game/MapStateRegion';


@Component({
    selector: 'app-mega-modder',
    imports: [MatTabsModule, MatButtonModule, MatIconModule, MatTooltipModule, TableComponent, CommonModule, PopScaleDiagramComponent],
    templateUrl: './mega-modder.component.html',
    styleUrl: './mega-modder.component.scss',
})
export class MegaModderComponent implements AfterViewInit {

    private readonly service = inject(MegaModderE2VService);
    private vic3GameFilesService = inject(Vic3GameFilesService);
    private pdxFileService = inject(PdxFileService);

    selectedSaveId: string = '';

    mappingTableRows: MappingTableRow[] = [];
    private scaledPopsByTag: Map<string, number> = new Map();
    private scaledArableLandByTag: Map<string, number> = new Map();
    countryResourceMetrics: Map<string, { population: number; arableLand: number; populationPerArableLand: number }> = new Map();
    private scaledPops: ModPop[] = [];
    private scaledMapStateRegions: MapStateRegion[] = [];
    totalWorldPopulation: number = 0;
    playerCount: number = 0;
    hasNonUniqueMappings: boolean = false;
    mappingTableColumns: TableColumn<MappingTableRow>[] = [
        new TableColumn('name', 'EU4 Tag', null, true, (e) => e.eu4Name, e => e.eu4Tag),
        new TableColumn('vic3', 'Vic3', null, true, (e) => e.vic3Name, e => e.vic3Subjects.length > 0 ? "Subjects:\n" + e.vic3Subjects.join('\n') : null),
        new TableColumn('eu4Dev', 'Dev', null, true, (e) => e.eu4Dev, () => null),
        new TableColumn('vic3Pop', 'Raw', null, true, (e) => e.vic3Pop, () => null),
        new TableColumn('initialArableLand', 'Arable Land', null, true, (e) => e.initialArableLand, () => null),
        new TableColumn('scalingFactor', 'α', 'Scaling factor to apply', true, (e) => e.scalingFactor, () => null),
        new TableColumn('scaledArableLand', 'Scaled Arable', null, true, (e) => e.scaledArableLand, () => null),
        new TableColumn('scaledVic3Pop', 'Scaled Pop Σ  ', "Nations and their vassals with actual scaled population", true, (e) => this.computeScaledTotal(e), (e) => this.buildScaledTooltip(e))
    ];

    ngAfterViewInit(): void {
        this.testGuessTagMapping();
    }

    testGuessTagMapping(): void {
        const eu4SaveURL = "http://localhost:5500/public/Convert2_local.eu4";
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

    private processTagMapping(save: Eu4Save, provinces: Map<any, any>, mapping: Map<any, any>): void {
        forkJoin([
            this.vic3GameFilesService.getModPops(),
            this.vic3GameFilesService.getDiplomaticPacts(),
            this.vic3GameFilesService.getHistoryStateRegions(),
            this.vic3GameFilesService.getMapStateRegions()
        ]).subscribe(([pops, pacts, historyRegions, mapStateRegions]) => {
            const eu4DevLookup = (tag: string) => save.getTotalCountryDevelopment(tag);
            const eu4VassalLookup = (tag: string) => save.getVassalsOfOverlord(tag);
            const vic3VassalLookup = (tag: string) => pacts.filter(pact => pact.overlordTag === tag).map(pact => pact.vassalTag);
            const refinedMapping = this.service.refineTagMapping(mapping, eu4DevLookup, eu4VassalLookup, vic3VassalLookup);
            const sortedLexByEu4Tags = Array.from(refinedMapping.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            const eu4DevByTag = this.buildEu4DevByTag(provinces);
            const vic3PopByTag = this.buildVic3PopByTag(pops);
            const initialArableLandByCountry = this.service.getInitialArableLandByCountry(historyRegions, mapStateRegions);
            this.mappingTableRows = this.buildMappingTableRows(save, sortedLexByEu4Tags, eu4DevByTag, vic3PopByTag, pacts, initialArableLandByCountry);
            this.hasNonUniqueMappings = new Set(this.mappingTableRows.map(r => r.vic3Tag)).size !== this.mappingTableRows.length;
            const scalingFactors = this.buildScalingFactors();
            this.scaledPops = this.vic3GameFilesService.scalePopulationsByCountry(pops, scalingFactors);
            this.buildScaledPopsByTag(this.scaledPops);

            const scaledRegions = this.service.scaleArableLandByCountry(historyRegions, mapStateRegions, scalingFactors);
            this.buildScaledArableLandByTag(scaledRegions);
            this.scaledMapStateRegions = scaledRegions;

            // Share mapping data with other components via observables
            this.service.updateEu4ToVic3Mapping(refinedMapping);
            this.service.updateScaledPopsByTag(this.scaledPopsByTag);
            this.service.updateScaledArableLandByTag(this.scaledArableLandByTag);

            const metricsToAggregate = new Map<string, Map<string, number>>();
            metricsToAggregate.set('population', this.scaledPopsByTag);

            const arableLandByCountry = new Map<string, number>();
            for (const scaledRegion of scaledRegions) {
                const tiles = Array.from(scaledRegion.getTiles());
                const owner = historyRegions.find(r => r.tiles.some(t => tiles.includes(t)))?.ownerCountryTag;
                if (owner) {
                    const current = arableLandByCountry.get(owner) ?? 0;
                    arableLandByCountry.set(owner, current + scaledRegion.getArableLand());
                }
            }
            metricsToAggregate.set('arableLand', arableLandByCountry);
            this.countryResourceMetrics = this.service.aggregateCountryMetrics(metricsToAggregate);
            this.totalWorldPopulation = this.scaledPops.map(pop => pop.size).reduce((a, b) => a + b, 0);
            this.calculatePlayerCount();
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

    private buildScalingFactors(): Map<string, number> {
        const scalingFactors = new Map<string, number>();
        const seenVic3Tags = new Set<string>();

        for (const row of this.mappingTableRows) {
            if (!seenVic3Tags.has(row.vic3Tag)) {
                scalingFactors.set(row.vic3Tag, row.scalingFactor);
                seenVic3Tags.add(row.vic3Tag);
            }
        }

        return scalingFactors;
    }

    get conflictingTagsTooltip(): string {
        const vic3TagMap = new Map<string, string[]>();
        for (const row of this.mappingTableRows) {
            if (!vic3TagMap.has(row.vic3Tag)) {
                vic3TagMap.set(row.vic3Tag, []);
            }
            vic3TagMap.get(row.vic3Tag)!.push(row.eu4Tag);
        }

        const conflictingVic3Tags: string[] = [];
        for (const [vic3Tag, eu4Tags] of vic3TagMap.entries()) {
            if (eu4Tags.length > 1) {
                conflictingVic3Tags.push(`${vic3Tag}: ${eu4Tags.join(', ')}`);
            }
        }

        if (conflictingVic3Tags.length === 0) {
            return '';
        }

        return 'Conflicting mappings:\n' + conflictingVic3Tags.join('\n');
    }

    private buildMappingTableRows(save: Eu4Save, sortedLexByEu4Tags: Array<[string, string]>, eu4DevByTag: Map<string, number>, vic3PopByTag: Map<string, number>, diplomaticPacts: { overlordTag: string, vassalTag: string, type: string }[], initialArableLandByCountry: Map<string, number>): MappingTableRow[] {
        const rows: any[] = [];
        const processedEu4Tags = new Set<string>();
        const processedVic3Tags = new Set<string>();
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
            const subjects: MappingTableRow[] = [];
            const localRows: MappingTableRow[] = [];
            for (const [tag, vic3MapTag] of groupNations) {
                const nation = save.getCountry(tag);
                const name = nation.getName();
                const dev = eu4DevByTag.get(tag) || 0;
                const overlordDev = eu4DevByTag.get(eu4Tag) || 0;
                const overlordRatio = 1000000 * this.service.getDevelopmentToPopTransformation()(overlordDev) / overlordDev;

                const adjustedPop = Math.ceil(overlordRatio * dev);
                const vic3PopValue = vic3PopByTag.get(vic3MapTag) || 0;
                const scalingFactor = vic3PopValue > 0 ? adjustedPop / vic3PopValue : 0;
                const vassals = diplomaticPacts.filter(pact => pact.overlordTag === vic3MapTag).map(pact => pact.vassalTag);
                const initialArableLand = initialArableLandByCountry.get(vic3MapTag) || 0;
                const row: MappingTableRow = {
                    eu4Tag: tag,
                    eu4Name: nation.getOverlordTag() == null ? name : nation.getOverlordTag() + "'s " + name,
                    vic3Tag: vic3MapTag,
                    vic3Name: vic3MapTag,
                    eu4Dev: dev,
                    vic3Pop: vic3PopValue,
                    adjustedVic3Pop: adjustedPop,
                    scalingFactor: scalingFactor,
                    initialArableLand: initialArableLand,
                    scaledArableLand: Math.ceil(initialArableLand * scalingFactor),
                    vic3Subjects: vassals
                };

                if (tag !== eu4Tag) {
                    subjects.push(row);
                }
                localRows.push(row);
                processedEu4Tags.add(tag);
                processedVic3Tags.add(vic3MapTag);
            }
            localRows[0].subjects = subjects;
            rows.push(...localRows);
        }

        for (const eu4Tag of eu4DevByTag.keys()) {
            if (!processedEu4Tags.has(eu4Tag)) {
                const nation = save.getCountry(eu4Tag);
                if (!nation.isIndependent()) {
                    const dev = eu4DevByTag.get(eu4Tag) || 0;
                    const overlordTag = nation.getOverlordTag();
                    const row: MappingTableRow = {
                        eu4Tag: eu4Tag,
                        eu4Name: `${overlordTag}'s ${nation.getName()} (unmapped)`,
                        vic3Tag: '',
                        vic3Name: '',
                        eu4Dev: dev,
                        vic3Pop: 0,
                        adjustedVic3Pop: 0,
                        scalingFactor: 0,
                        initialArableLand: 0,
                        scaledArableLand: 0,
                        vic3Subjects: []
                    };
                    rows.push(row);
                }
            }
        }

        for (const pact of diplomaticPacts) {
            if (!processedVic3Tags.has(pact.vassalTag)) {
                const initialArableLand = initialArableLandByCountry.get(pact.vassalTag) || 0;
                const row: MappingTableRow = {
                    eu4Tag: '',
                    eu4Name: '(unmapped VIC3)',
                    vic3Tag: pact.vassalTag,
                    vic3Name: pact.vassalTag + " (vassal of " + pact.overlordTag + ")",
                    eu4Dev: 0,
                    vic3Pop: vic3PopByTag.get(pact.vassalTag) || 0,
                    adjustedVic3Pop: 0,
                    scalingFactor: 0,
                    initialArableLand: initialArableLand,
                    scaledArableLand: 0,
                    vic3Subjects: []
                };
                rows.push(row);
            }
        }

        return rows;
    }

    private buildScaledPopsByTag(scaledPops: ModPop[]): void {
        this.scaledPopsByTag.clear();
        for (const pop of scaledPops) {
            const currentPop = this.scaledPopsByTag.get(pop.countryTag) || 0;
            this.scaledPopsByTag.set(pop.countryTag, currentPop + pop.size);
        }
    }

    private buildScaledArableLandByTag(scaledRegions: MapStateRegion[]): void {
        this.scaledArableLandByTag.clear();
        for (const region of scaledRegions) {
            const tiles = Array.from(region.getTiles());
            const owner = Array.from(new Map(this.mappingTableRows.map(r => [r.vic3Tag, r.vic3Tag])).values()).find(tag => {
                return this.mappingTableRows.some(r => r.vic3Tag === tag);
            });
            if (owner) {
                const current = this.scaledArableLandByTag.get(owner) ?? 0;
                this.scaledArableLandByTag.set(owner, current + region.getArableLand());
            }
        }
    }

    private computeScaledTotal(row: MappingTableRow): number {
        let total = this.scaledPopsByTag.get(row.vic3Tag) || 0;
        if (row.subjects) {
            for (const subject of row.subjects) {
                total += this.scaledPopsByTag.get(subject.vic3Tag) || 0;
            }
        }
        return total;
    }

    private buildScaledTooltip(row: MappingTableRow): string {
        const formatAsMillions = (value: number) => (value / 1000000).toFixed(1) + 'M';
        let tooltip = `${row.eu4Name}: ${formatAsMillions(this.scaledPopsByTag.get(row.vic3Tag) || 0)}\n`;
        if (row.subjects && row.subjects.length > 0) {
            for (const subject of row.subjects) {
                tooltip += `${formatAsMillions(this.scaledPopsByTag.get(subject.vic3Tag) || 0)} ${subject.eu4Name}\n`;
            }
        }
        return tooltip;
    }

    private calculatePlayerCount(): void {
        this.playerCount = 0;
        for (const row of this.mappingTableRows) {
            if (row.eu4Tag && row.eu4Tag.startsWith('Z')) {
                this.playerCount++;
            }
        }
    }

    async downloadScaledPopulations(): Promise<void> {
        if (this.scaledPops.length === 0) {
            console.warn('No scaled populations available');
            return;
        }
        const fileContent = this.vic3GameFilesService.writeBackModPops(this.scaledPops);
        await this.triggerFileDownload(fileContent, '99_converted_pops.txt');
    }

    async downloadScaledStates(): Promise<void> {
        if (this.scaledMapStateRegions.length === 0) {
            console.warn('No scaled states available');
            return;
        }
        const blob = await this.vic3GameFilesService.writeMapStateRegionsToZip(this.scaledMapStateRegions);
        await this.triggerBlobDownload(blob, 'map-states.zip');
    }

    private async triggerFileDownload(content: string, filename: string): Promise<void> {
        console.log('Attempting to save file:', filename);
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: 'Text Files',
                            accept: { 'text/plain': ['.txt'] }
                        }
                    ]
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                return;
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('Error saving file with File System API:', err);
                }
            }
        }
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    private async triggerBlobDownload(blob: Blob, filename: string): Promise<void> {
        console.log('Attempting to save file:', filename);
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName: filename,
                    types: [
                        {
                            description: 'Zip Files',
                            accept: { 'application/zip': ['.zip'] }
                        }
                    ]
                });
                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();
                return;
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error('Error saving file with File System API:', err);
                }
            }
        }
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}