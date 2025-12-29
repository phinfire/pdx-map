import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MegaModderE2VService } from '../modding/mega-modder/MegaModderE2VService';
import { Vic3GameFilesService } from '../../model/vic/Vic3GameFilesService';
import { CountryShellBuilderService } from '../../model/vic/CountryShellBuilderService';
import { PdxFileService } from '../../services/pdx-file.service';
import { CountryShell } from '../../model/vic/CountryShell';
import { Subject, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface Nation {
    key: string;
    name: string;
    selected?: boolean;
    disabled?: boolean;
    countryShell?: CountryShell;
}

@Component({
    selector: 'app-alliancehelper',
    imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule],
    templateUrl: './alliancehelper.component.html',
    styleUrl: './alliancehelper.component.scss',
})
export class AlliancehelperComponent implements OnInit, OnDestroy {
    private nationsLoaded = false;
    private countriesLoaded = false;
    private service = inject(MegaModderE2VService);
    private vic3GameFilesService = inject(Vic3GameFilesService);
    private countryShellBuilder = inject(CountryShellBuilderService);
    private pdxFileService = inject(PdxFileService);
    private destroy$ = new Subject<void>();

    // User threshold for marker/color (e.g. 100M)
    readonly userThreshold = 100_000_000;
    // Bar max for bar fill (e.g. 200M)
    readonly barMax = this.userThreshold * 1.2;
    Math = Math; // Expose Math to template

    countries: Map<string, CountryShell> = new Map();
    nations: Nation[] = [];
    totalPopulation: number = 0;

    ngOnInit(): void {
        this.loadGameData();
        this.fetchNations();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    private loadGameData(): void {
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

        forkJoin([
            this.vic3GameFilesService.getHistoryStateRegions(),
            this.vic3GameFilesService.getModPops(),
            this.vic3GameFilesService.getDiplomaticPacts()
        ]).pipe(
            takeUntil(this.destroy$)
        ).subscribe(([historyRegions, pops, diplomaticPacts]) => {
            const vic3OwnershipMap = this.buildVic3OwnershipMap(historyRegions);
            this.service.guessTagMapping(provinces, vic3OwnershipMap).pipe(
                takeUntil(this.destroy$)
            ).subscribe(mapping => {
                this.buildCountries(mapping, pops, diplomaticPacts);
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

    private buildCountries(
        mapping: Map<string, string>,
        pops: any[],
        diplomaticPacts: { overlordTag: string; vassalTag: string; type: string }[]
    ): void {
        // Build raw VIC3 population by tag
        const vic3PopByTag = new Map<string, number>();
        for (const pop of pops) {
            if (!vic3PopByTag.has(pop.countryTag)) {
                vic3PopByTag.set(pop.countryTag, 0);
            }
            const currentPop = vic3PopByTag.get(pop.countryTag) || 0;
            vic3PopByTag.set(pop.countryTag, currentPop + pop.size);
        }

        // Build VIC3 vassal relationships
        const vic3Vassals = new Map<string, string[]>();
        for (const pact of diplomaticPacts) {
            if (!vic3Vassals.has(pact.overlordTag)) {
                vic3Vassals.set(pact.overlordTag, []);
            }
            vic3Vassals.get(pact.overlordTag)!.push(pact.vassalTag);
        }
        this.countries = this.countryShellBuilder.buildCountryShells(mapping, vic3PopByTag, vic3Vassals);
        console.log('Countries:', this.countries);
        this.updateNationsWithCountries();
        this.countriesLoaded = true;
        this.tryRestoreSelectionAndRecalc();
    }

    private updateNationsWithCountries(): void {
        for (const nation of this.nations) {
            if (this.countries.has(nation.key)) {
                nation.countryShell = this.countries.get(nation.key);
                nation.disabled = nation.countryShell ? nation.countryShell.getPopulation() === 0 : true;
            } else {
                // Nations not in the mapping are disabled
                nation.disabled = true;
            }
        }
    }

    private fetchNations(): void {
        const url = "https://codingafterdark.de/mc/ideas/flags/nations.json?" + Date.now();
        fetch(url)
            .then(response => response.json())
            .then((data: Nation[]) => {
                this.nations = data.map(nation => ({
                    ...nation,
                    selected: false
                })).sort((a, b) => a.name.localeCompare(b.name));
                this.nationsLoaded = true;
                this.tryRestoreSelectionAndRecalc();
            })
            .catch(error => console.error('Failed to fetch nations:', error));
    }
    /**
     * Only restore selection and recalc population when both nations and countries are loaded.
     */
    private tryRestoreSelectionAndRecalc(): void {
        if (this.nationsLoaded && this.countriesLoaded) {
            this.restoreSelectionFromStorage();
            this.calculateTotalPopulation();
        }
    }

    toggleNation(nation: Nation): void {
        if (!nation.disabled) {
            nation.selected = !nation.selected;
            this.calculateTotalPopulation();
            this.saveSelectionToStorage();
        }
    }

    private calculateTotalPopulation(): void {
        this.totalPopulation = 0;
        for (const nation of this.nations) {
            if (nation.selected && nation.countryShell) {
                this.totalPopulation += nation.countryShell.getPopulation();
            }
        }
    }

    private saveSelectionToStorage(): void {
        const selectedKeys = this.nations.filter(n => n.selected).map(n => n.key);
        localStorage.setItem('alliancehelper.selectedNations', JSON.stringify(selectedKeys));
    }

    private restoreSelectionFromStorage(): void {
        const raw = localStorage.getItem('alliancehelper.selectedNations');
        if (!raw) return;
        try {
            const selectedKeys: string[] = JSON.parse(raw);
            for (const nation of this.nations) {
                nation.selected = selectedKeys.includes(nation.key);
            }
            this.calculateTotalPopulation();
        } catch { }
    }

    resetSelection(): void {
        for (const nation of this.nations) {
            nation.selected = false;
        }
        this.calculateTotalPopulation();
        this.saveSelectionToStorage();
    }

    getFlagUrl(nationKey: string): string {
        return `https://codingafterdark.de/mc/ideas/flags/${nationKey}.webp`;
    }

    formatPopulation(value: number): string {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        }
        if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        }
        return value.toString();
    }

    getBarFillPercentage(): number {
        return Math.min((this.totalPopulation / this.barMax) * 100, 100);
    }

    getMarkerPercentage(): number {
        return Math.min((this.userThreshold / this.barMax) * 100, 100);
    }

    isOverThreshold(): boolean {
        return this.totalPopulation > this.userThreshold;
    }

    getOverflowPercentage(): number {
        if (this.totalPopulation <= this.userThreshold) return 0;
        return Math.min(((this.totalPopulation - this.userThreshold) / this.barMax) * 100, 100 - this.getMarkerPercentage());
    }
}
