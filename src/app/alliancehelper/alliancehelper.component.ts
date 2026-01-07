import { Component, inject, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GaugeComponent } from '../gauge/gauge.component';
import { MegaModderE2VService } from '../modding/mega-modder/MegaModderE2VService';
import { Vic3GameFilesService } from '../../model/vic/Vic3GameFilesService';
import { CountryShellBuilderService } from '../../model/vic/CountryShellBuilderService';
import { CountryShell } from '../../model/vic/CountryShell';
import { Vic3Save } from '../../model/vic/Vic3Save';
import { Subject, forkJoin, from, of } from 'rxjs';
import { takeUntil, switchMap, catchError, map } from 'rxjs/operators';
import { MegaService } from '../mc/MegaService';
import { TableColumn } from '../../util/table/TableColumn';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { SaveDatabaseService } from '../savedatabase.service';

interface Nation {
    key: string;
    name: string;
    selected?: boolean;
    disabled?: boolean;
    countryShell?: CountryShell;
}

@Component({
    selector: 'app-alliancehelper',
    imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, GaugeComponent, MatProgressSpinnerModule],
    templateUrl: './alliancehelper.component.html',
    styleUrl: './alliancehelper.component.scss',
})
export class AlliancehelperComponent implements OnInit, OnDestroy {

    @Input() vic3SaveFile?: Vic3Save;
    saveFileId: string = "f9396abb-f48e-4f80-8d83-355d0ed59dc3"; // TODO: Don't hardcode this, needs to depend on MegaCampaign's last V3 session
    private nationsLoaded = false;
    private countriesLoaded = false;
    private megaService = inject(MegaService);
    private service = inject(MegaModderE2VService);
    private vic3GameFilesService = inject(Vic3GameFilesService);
    private countryShellBuilder = inject(CountryShellBuilderService);
    private saveDatabase = inject(SaveDatabaseService);
    private destroy$ = new Subject<void>();
    protected appReady = false;
    private LOCAL_STORAGE_KEY = 'alliancehelper.selectedNations';

    readonly vassalPopulationFactor = 0.66;
    playerCount: number = 1;
    userThresholdExplanation: string = '';
    totalWorldPopulation: number = 0;
    get userThreshold(): number {
        if (this.playerCount <= 0) return 0;
        return 3.0 * this.totalWorldPopulation / this.playerCount;
    }
    get barMax(): number {
        return this.userThreshold * 1.5;
    }

    countries: Map<string, CountryShell> = new Map();
    nations: Nation[] = [];
    totalPopulation: number = 0;

    ngOnInit(): void {
        this.megaService.getLastEu4Save().pipe(takeUntil(this.destroy$)).subscribe(save => {
            const demographicsObservable = this.saveFileId
                ? this.saveDatabase.downloadSaveFile(this.saveFileId).pipe(
                    map(data => {
                        const jsonStr = new TextDecoder().decode(data);
                        return JSON.parse(jsonStr);
                    }),
                    catchError(error => {
                        console.warn('Failed to fetch demographics:', error);
                        return of(null);
                    })
                )
                : of(null);

            forkJoin({
                nations: this.megaService.getNations$(),
                historyRegions: this.vic3GameFilesService.getHistoryStateRegions(),
                pops: this.vic3GameFilesService.getModPops(),
                diplomaticPacts: this.vic3GameFilesService.getDiplomaticPacts(),
                demographics: demographicsObservable
            }).pipe(takeUntil(this.destroy$)).subscribe(({ nations, historyRegions, pops, diplomaticPacts, demographics }) => {
                this.nations = (nations || []).map(nation => ({ ...nation, selected: false })).sort((a, b) => a.name.localeCompare(b.name));
                const provinces = new Map<string, any>();
                for (const [key, prov] of save.getProvinces().entries()) {
                    if (prov.getOwner() != null) {
                        provinces.set(key, prov);
                    }
                }
                const vic3OwnershipMap = this.buildVic3OwnershipMap(historyRegions);
                this.service.guessTagMapping(provinces, vic3OwnershipMap).pipe(takeUntil(this.destroy$)).subscribe(mapping => {
                    this.buildCountries(mapping, pops, diplomaticPacts, demographics);
                    this.nationsLoaded = true;
                    this.countriesLoaded = true;
                    this.tryRestoreSelectionAndRecalc();
                });
                this.appReady = true;
            });
        });
    }


    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
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
        diplomaticPacts: { overlordTag: string; vassalTag: string; type: string }[],
        demographics?: any
    ): void {
        let vic3PopByTag = new Map<string, number>();
        let worldPop = 0;
        if (this.vic3SaveFile) {
            for (const country of this.vic3SaveFile.getCountries(true)) {
                vic3PopByTag.set(country.getTag(), country.getPopulation());
                worldPop += country.getPopulation();
            }
        } else if (demographics && demographics.populationByCountry) {
            // Use demographics from SaveDatabaseService if available
            for (const countryData of demographics.populationByCountry) {
                vic3PopByTag.set(countryData.tag, countryData.population);
                worldPop += countryData.population;
            }
        } else {
            // Fall back to mod pops if neither save file nor demographics are available
            for (const pop of pops) {
                if (!vic3PopByTag.has(pop.countryTag)) {
                    vic3PopByTag.set(pop.countryTag, 0);
                }
                const currentPop = vic3PopByTag.get(pop.countryTag) || 0;
                vic3PopByTag.set(pop.countryTag, currentPop + pop.size);
                worldPop += pop.size;
            }
        }
        this.totalWorldPopulation = worldPop;
        const vic3Vassals = new Map<string, string[]>();
        for (const pact of diplomaticPacts) {
            if (!vic3Vassals.has(pact.overlordTag)) {
                vic3Vassals.set(pact.overlordTag, []);
            }
            vic3Vassals.get(pact.overlordTag)!.push(pact.vassalTag);
        }
        this.countries = this.countryShellBuilder.buildCountryShells(mapping, vic3PopByTag, vic3Vassals);
        this.updateNationsWithCountries();
        this.countriesLoaded = true;
        const allCountries = Array.from(this.countries.values());
        const vassalTags = new Set<string>();
        for (const country of allCountries) {
            for (const vassal of country.getVassals()) {
                vassalTags.add(vassal.getTag());
            }
        }
        const independentNations = allCountries.filter(cs => !vassalTags.has(cs.getTag()));
        this.playerCount = independentNations.length;
        this.updateUserThresholdExplanation();

        this.tryRestoreSelectionAndRecalc();
    }

    private updateUserThresholdExplanation(): void {
        this.userThresholdExplanation = `Threshold = 3.0 × (Total World Population) / Player Count\n= 3.0 × ${this.formatPopulation(this.totalWorldPopulation)} / ${this.playerCount} = ${this.formatPopulation(this.userThreshold)}`;
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
                const nationPop = nation.countryShell.getPopulation();
                let vassalPop = 0;
                for (const vassal of nation.countryShell.getVassals()) {
                    vassalPop += vassal.getPopulation();
                }
                this.totalPopulation += nationPop + this.vassalPopulationFactor * vassalPop;
            }
        }
    }

    private saveSelectionToStorage(): void {
        const selectedKeys = this.nations.filter(n => n.selected).map(n => n.key);
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(selectedKeys));
    }

    private restoreSelectionFromStorage(): void {
        const raw = localStorage.getItem(this.LOCAL_STORAGE_KEY);
        if (!raw) return;
        const selectedKeys = JSON.parse(raw);
        for (const nation of this.nations) {
            nation.selected = selectedKeys.includes(nation.key);
        }
        this.calculateTotalPopulation();
    }

    resetSelection(): void {
        for (const nation of this.nations) {
            nation.selected = false;
        }
        this.calculateTotalPopulation();
        this.saveSelectionToStorage();
    }

    getFlagUrl(nationKey: string): string {
        return this.megaService.getFlagUrl(nationKey);
    }

    formatPopulation(value: number): string {
        return TableColumn.formatNumber(value);
    }

    getPopulationTooltip(nation: Nation): string {
        if (!nation.selected || !nation.countryShell) return '';
        const nationPop = nation.countryShell.getPopulation();
        let vassalPop = 0;
        for (const vassal of nation.countryShell.getVassals()) {
            vassalPop += vassal.getPopulation();
        }
        const total = nationPop + this.vassalPopulationFactor * vassalPop;
        return `Nation Pop: ${this.formatPopulation(nationPop)} + ${this.vassalPopulationFactor} * Vassal Pop: ${this.formatPopulation(vassalPop)} = ${this.formatPopulation(total)}`;
    }

    isOverThreshold(): boolean {
        return this.totalPopulation > this.userThreshold;
    }
}
