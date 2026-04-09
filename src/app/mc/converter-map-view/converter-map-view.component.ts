import { Component, inject, ViewChild, AfterViewInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormsModule } from '@angular/forms';

import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule } from '@angular/cdk/menu';
import { MapService } from '../../../services/map.service';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { Ck3ToEu4ConverterServiceService } from '../../../services/megacampaign/ck3-to-eu4-converter-service.service';
import { PolygonSelectComponent, PolygonSelectionEvent, HoverChangedEvent } from '../../viewers/polygon-select/polygon-select.component';
import { makeGeoJsonPolygons } from '../../../util/geometry/threeGeometry';
import { ColorConfigProvider } from '../../viewers/polygon-select/ColorConfigProvider';
import { BehaviorConfigProvider } from '../../viewers/polygon-select/BehaviorConfigProvider';
import { RGB } from '../../../util/RGB';
import { trigger, transition, style, animate } from '@angular/animations';
import { CK3TitleRegistry } from '../../../model/ck3/game/Ck3TitleRegistry';
import { Localiser } from '../../../model/ck3/game/Localiser';

@Component({
    selector: 'app-converter-map-view',
    imports: [PolygonSelectComponent, CommonModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatTooltipModule, FormsModule, CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule],
    templateUrl: './converter-map-view.component.html',
    styleUrl: './converter-map-view.component.scss',
    animations: [
        trigger('menuFadeScale', [
            transition(':enter', [
                style({ opacity: 0, transform: 'scale(0.95)' }),
                animate('180ms cubic-bezier(0.4,0.0,0.2,1)',
                    style({ opacity: 1, transform: 'scale(1)' })
                )
            ]),
            transition(':leave', [
                animate('120ms cubic-bezier(0.4,0.0,0.2,1)',
                    style({ opacity: 0, transform: 'scale(0.95)' })
                )
            ])
        ])
    ]
})
export class ConverterMapViewComponent implements AfterViewInit {

    mapService = inject(MapService);
    ck3Service = inject(CK3Service);
    converterService = inject(Ck3ToEu4ConverterServiceService);

    @ViewChild('ck3Map') ck3Map!: PolygonSelectComponent;
    @ViewChild('eu4Map') eu4Map!: PolygonSelectComponent;

    private readonly eu4DefaultColor = new RGB(128, 128, 128);

    titleRegistry: CK3TitleRegistry | null = null;
    localiser: Localiser | null = null;
    provinceMapping: { ck3BaronyIndices: string[], eu4ProvinceIds: string[] }[] = [];
    autoFitCameraOnSelection = true;
    ck3Countries = signal<{ id: string, ck3Provinces: Set<string>, color: RGB, name: string }[]>([]);
    currentlyActiveCountryKey = signal<string | null>(null);
    selectedCountryForDelete: string | null = null;
    private eu4ProvinceVotes: Map<string, Map<string, number>> = new Map();
    private lastHoveredEu4Keys: string[] = [];
    private lastHoveredCk3Keys: string[] = [];
    private ck3ProvinceDuchyColors: Map<string, number> = new Map();
    private eu4Province2Color: Map<string, number> = new Map();
    private ck3ColorConfigLambda = (key: string) => {
        const owner = this.getOwningCountryOfCK3Province(key);
        return owner ? owner.color.toNumber() : this.ck3ProvinceDuchyColors.get(key)!;
    }
    private eu4Province2ColorLambda = (key: string) => this.eu4Province2Color.get(key) || this.eu4DefaultColor.toNumber();

    ngAfterViewInit() {
        combineLatest([
            this.ck3Service.getTitleRegistry$(),
            this.ck3Service.getLocaliser$(),
            this.converterService.getProvinceMapping$()
        ]).subscribe(([titleRegistry, localiser, mapping]) => {
            this.titleRegistry = titleRegistry;
            this.localiser = localiser;
            this.provinceMapping = mapping;
            this.mapService.fetchCK3GeoJson(true, true).subscribe((geoJson) => {
                const countyKey2DuchyColor = new Map<string, number>();
                titleRegistry.getAllCountyTitleKeys().forEach(countyKey => {
                    const duchyKey = titleRegistry.getDeJureLiegeTitle(countyKey)!;
                    const duchyColor = titleRegistry.getVanillaTitleColor(duchyKey);
                    countyKey2DuchyColor.set(countyKey, duchyColor!.toNumber())
                });
                this.ck3ProvinceDuchyColors = countyKey2DuchyColor;
                const meshes = makeGeoJsonPolygons(geoJson, new ColorConfigProvider(this.ck3ColorConfigLambda, false), () => null, () => false, 0.75);
                this.ck3Map.launch(meshes, [new ColorConfigProvider(this.ck3ColorConfigLambda, false)], new BehaviorConfigProvider(0.75));
            });

            this.mapService.fetchEU4GeoJson(true, true).subscribe((geoJson) => {
                const colorConfig = new ColorConfigProvider(this.eu4Province2ColorLambda, true);
                const meshes = makeGeoJsonPolygons(geoJson, colorConfig, () => null, () => false, 0.75);
                this.eu4Map.launch(meshes, [colorConfig], new BehaviorConfigProvider(0.75));
            });
        });
    }

    onCK3SelectionChanged(event: PolygonSelectionEvent) {
        if (this.currentlyActiveCountryKey() == null) {
            this.currentlyActiveCountryKey.set(new Date().toISOString());
            const clickedColor = this.titleRegistry!.getVanillaTitleColor(event.key);
            const newCountry = { id: this.currentlyActiveCountryKey()!, ck3Provinces: new Set([event.key]), color: clickedColor!, name: `Country ${this.ck3Countries().length + 1}` };
            this.ck3Countries.set([...this.ck3Countries(), newCountry]);
        }
        const countries = this.ck3Countries();
        const countryIndex = countries.findIndex(c => c.id === this.currentlyActiveCountryKey());
        if (countryIndex !== -1) {
            const updatedCountries = [...countries];
            updatedCountries[countryIndex] = {
                ...updatedCountries[countryIndex],
                ck3Provinces: new Set(event.locked
                    ? [...updatedCountries[countryIndex].ck3Provinces, event.key]
                    : Array.from(updatedCountries[countryIndex].ck3Provinces).filter(k => k !== event.key))
            };
            this.ck3Countries.set(updatedCountries);
        }
        this.rebuildEU4ProvinceVotes();
        this.repropagateStateToEU4();
    }

    onEU4SelectionChanged(event: PolygonSelectionEvent) {
    }

    onCK3HoverChanged(event: HoverChangedEvent) {
        if (event.isHovered) {
            if (event.key) {
                this.eu4Map.applyHoverEffectsByKeys(this.lastHoveredEu4Keys, false);
                this.lastHoveredEu4Keys = this.resolveCountyToEU4Provinces(event.key);
                this.eu4Map.applyHoverEffectsByKeys(this.lastHoveredEu4Keys, true);
            }
        } else {
            this.eu4Map.applyHoverEffectsByKeys(this.lastHoveredEu4Keys, false);
            this.lastHoveredEu4Keys = [];
        }
    }

    onEU4HoverChanged(event: HoverChangedEvent) {
        if (event.isHovered) {
            if (event.key) {
                this.ck3Map.applyHoverEffectsByKeys(this.lastHoveredCk3Keys, false);
                this.lastHoveredCk3Keys = this.resolveEU4ProvinceToCounties(event.key);
                this.ck3Map.applyHoverEffectsByKeys(this.lastHoveredCk3Keys, true);
            }
        }
    }

    private rebuildEU4ProvinceVotes() {
        this.eu4ProvinceVotes.clear();
        for (const country of this.ck3Countries()) {
            for (const countyKey of country.ck3Provinces) {
                const eu4Provinces = this.resolveCountyToEU4Provinces(countyKey);
                for (const eu4Province of eu4Provinces) {
                    if (!this.eu4ProvinceVotes.has(eu4Province)) {
                        this.eu4ProvinceVotes.set(eu4Province, new Map());
                    }
                    const votes = this.eu4ProvinceVotes.get(eu4Province)!;
                    votes.set(country.id, (votes.get(country.id) || 0) + 1);
                }
            }
        }
    }

    private repropagateStateToEU4() {
        const eu4ProvinceOwnershipVotes = this.gatherOwnershipVotes();
        const ownershipResults: Map<string, string> = new Map();
        eu4ProvinceOwnershipVotes.forEach((voters, province) => {
            const mostVotes = Math.max(...voters.map(voter => voters.filter(v => v === voter).length));
            ownershipResults.set(province, voters.find(voter => voters.filter(v => v === voter).length === mostVotes)!);
        });
        this.eu4Province2Color.clear();
        const lockedProvinces: string[] = [];
        ownershipResults.forEach((owner, province) => {
            const country = this.ck3Countries().find(c => c.id === owner)!;
            this.eu4Province2Color.set(province, country.color.toNumber());
            const uniqueContestants = new Set(eu4ProvinceOwnershipVotes.get(province)!).size;
            if (uniqueContestants === 1) {
                lockedProvinces.push(province);
            }
        });
        this.eu4Map.resetSelection();
        this.eu4Map.refreshAllColors();
        if (this.autoFitCameraOnSelection) {
            this.eu4Map.fitCameraToPolygons(0.3, Array.from(ownershipResults.keys()));
        }
    }

    private gatherOwnershipVotes() {
        const eu4ProvinceOwnershipVotes: Map<string, string[]> = new Map();
        for (const country of this.ck3Countries()) {
            for (const countyKey of country.ck3Provinces) {
                const eu4Provinces = this.resolveCountyToEU4Provinces(countyKey);
                for (const eu4Province of eu4Provinces) {
                    if (!eu4ProvinceOwnershipVotes.has(eu4Province)) {
                        eu4ProvinceOwnershipVotes.set(eu4Province, []);
                    }
                    eu4ProvinceOwnershipVotes.get(eu4Province)!.push(country.id);
                }
            }
        }
        return eu4ProvinceOwnershipVotes;
    }

    private resolveCountyToEU4Provinces(countyKey: string): string[] {
        return this.resolveCountyToAllInvolvedMappings(countyKey).map(m => m.eu4ProvinceId);
    }

    private resolveCountyToAllInvolvedMappings(countyKey: string): { ck3BaronyIndex: string, eu4ProvinceId: string }[] {
        const baronies = (this.titleRegistry!.getCountyBaronies(countyKey) || []);
        if (baronies.length == 0) {
            return [];
        }
        const mappings: { ck3BaronyIndex: string, eu4ProvinceId: string }[] = [];
        for (const barony of baronies) {
            const baronyIndex = this.titleRegistry!.getBaronyProvinceIndex(barony)!;
            const mappingEntries = this.provinceMapping.filter(entry => entry.ck3BaronyIndices.includes(baronyIndex.toString()));
            for (const mappingEntry of mappingEntries) {
                for (const eu4ProvinceId of mappingEntry.eu4ProvinceIds) {
                    mappings.push({ ck3BaronyIndex: baronyIndex.toString(), eu4ProvinceId });
                }
            }
        }
        return mappings;
    }

    // TODO: vibe coded
    private resolveEU4ProvinceToCounties(eu4ProvinceId: string): string[] {
        const counties: string[] = [];
        const allCounties = this.titleRegistry!.getAllCountyTitleKeys();

        for (const countyKey of allCounties) {
            const eu4Provinces = this.resolveCountyToEU4Provinces(countyKey);
            if (eu4Provinces.includes(eu4ProvinceId)) {
                counties.push(countyKey);
            }
        }

        return counties;
    }

    clearAllSelections() {
        const currentlyLockedCK3Provinces = this.ck3Countries().flatMap(c => Array.from(c.ck3Provinces));
        this.ck3Map.setLockedStates(currentlyLockedCK3Provinces, false, false);
        this.eu4Map.setLockedStates([], true, false);
        this.ck3Map.refreshAllColors();
    }

    selectCountry(countryId: string) {
        this.currentlyActiveCountryKey.set(countryId);
    }

    createNewCountry() {
        this.currentlyActiveCountryKey.set(null);
    }

    removeCountry(event: Event, countryId: string) {
        event.stopPropagation();
        const updatedCountries = this.ck3Countries().filter(c => c.id !== countryId);
        this.ck3Countries.set(updatedCountries);
        if (this.currentlyActiveCountryKey() === countryId) {
            this.currentlyActiveCountryKey.set(updatedCountries.length > 0 ? updatedCountries[0].id : null);
        }
        this.ck3Map.setLockedStates(this.ck3Countries().flatMap(c => Array.from(c.ck3Provinces)), true, false);
        this.rebuildEU4ProvinceVotes();
        this.repropagateStateToEU4();
    }

    getEU4ProvinceCountForCountry(country: { id: string, ck3Provinces: Set<string>, color: RGB, name: string }): number {
        const eu4Provinces = new Set<string>();
        for (const countyKey of country.ck3Provinces) {
            this.resolveCountyToEU4Provinces(countyKey).forEach(p => eu4Provinces.add(p));
        }
        return eu4Provinces.size;
    }

    ck3TooltipProvider = (key: string): string => {
        const owner = this.getOwningCountryOfCK3Province(key);
        return "<b>" + this.localiser!.localise(key) + "</b><br>"
            + (owner ? `Owned by: ${owner.name}` : 'Unclaimed');
    };

    eu4TooltipProvider = (key: string): string => {
        const contestingCountries = this.eu4ProvinceVotes.get(key) || new Map();
        const tooltipTop = `<b>${key}</b><br>`;
        if (contestingCountries.size > 1) {
            return `${tooltipTop}Contested by:<br>${Array.from(contestingCountries.entries()).map(([countryId, votes]) => {
                const country = this.ck3Countries().find(c => c.id === countryId);
                return `${country?.name || 'Unknown'} (${votes} votes)`;
            }).join('<br>')}`;
        } else if (contestingCountries.size === 1) {
            const countryId = Array.from(contestingCountries.keys())[0];
            const country = this.ck3Countries().find(c => c.id === countryId)!;
            return `${tooltipTop}Owned by: ${country.name}`;
        }
        return tooltipTop;
    };

    private getOwningCountryOfCK3Province(provinceKey: string) {
        return this.ck3Countries().find(c => c.ck3Provinces.has(provinceKey)) || null;
    }


}
