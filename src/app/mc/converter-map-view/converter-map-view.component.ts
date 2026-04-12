import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectorRef, Component, computed, effect, inject, NgZone, signal, ViewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { combineLatest, Subject, switchMap, filter, take, of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule } from '@angular/cdk/menu';
import { CK3TitleRegistry } from '../../../model/ck3/game/CK3TitleRegistry';
import { Localiser } from '../../../model/ck3/game/Localiser';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { MapService } from '../../../services/map.service';
import { MapClaimService, MapClaimSessionHeader } from '../../../services/map-claim.service';
import { Ck3ToEu4ConverterServiceService } from '../../../services/megacampaign/ck3-to-eu4-converter-service.service';
import { makeGeoJsonPolygons } from '../../../util/geometry/threeGeometry';
import { RGB } from '../../../util/RGB';
import { BehaviorConfigProvider } from '../../viewers/polygon-select/BehaviorConfigProvider';
import { ColorConfigProvider } from '../../viewers/polygon-select/ColorConfigProvider';
import { HoverChangedEvent, PolygonSelectComponent, PolygonSelectionEvent } from '../../viewers/polygon-select/polygon-select.component';
import { MapClaimSession } from '../../../model/megacampaign/MapClaimSession';
import { Game } from '../../../model/Game';
import { StringInputComponent } from '../../string-input/string-input.component';

@Component({
    selector: 'app-converter-map-view',
    imports: [PolygonSelectComponent, CommonModule, MatButtonModule, MatIconModule, MatCheckboxModule, MatSlideToggleModule, MatTooltipModule, FormsModule, CdkContextMenuTrigger, CdkMenu, CdkMenuItem, CdkMenuModule, MatSelectModule, MatFormFieldModule, MatDividerModule, MatDialogModule],
    templateUrl: './converter-map-view.component.html',
    styleUrl: './converter-map-view.component.scss',
})
export class ConverterMapViewComponent implements AfterViewInit {

    mapService = inject(MapService);
    ck3Service = inject(CK3Service);
    converterService = inject(Ck3ToEu4ConverterServiceService);
    mapClaimService = inject(MapClaimService);
    activatedRoute = inject(ActivatedRoute);
    ngZone = inject(NgZone);
    cdr = inject(ChangeDetectorRef);
    dialog = inject(MatDialog);

    @ViewChild('ck3Map') ck3Map!: PolygonSelectComponent;
    @ViewChild('eu4Map') eu4Map!: PolygonSelectComponent;

    private refreshSessions$ = new Subject<void>();
    availableSessions = toSignal(
        this.refreshSessions$.pipe(
            switchMap(() => this.mapClaimService.getSessions$())
        ),
        { initialValue: [] }
    );
    selectedSession = signal<MapClaimSession>(
        new MapClaimSession(null, null, "local2", Game.CK3, new Map(), new Map(), false)
    );

    // Signal to track whether current user can edit the selected session
    protected canEditCurrentSession = signal(true);

    // Setup effect to check permissions when session changes
    private setupPermissionEffect = effect(() => {
        const session = this.selectedSession();
        if (!session.isOnline()) {
            this.canEditCurrentSession.set(true);
        } else {
            this.mapClaimService.canEdit(session).subscribe(canEdit => {
                this.canEditCurrentSession.set(canEdit);
            });
        }
    });

    protected hasChangesToSave = signal(false);

    private readonly eu4DefaultColor = new RGB(128, 128, 128);

    titleRegistry: CK3TitleRegistry | null = null;
    localiser: Localiser | null = null;
    provinceMapping: { ck3BaronyIndices: string[], eu4ProvinceIds: string[] }[] = [];
    private eu4ProvinceVotes: Map<string, Map<string, number>> = new Map();
    private lastHoveredEu4Keys: string[] = [];
    private ck3ProvinceDuchyColors: Map<string, RGB> = new Map();
    private eu4Province2Color: Map<string, RGB> = new Map();
    private ck3ColorConfigLambda = (key: string) => {
        const owner = this.selectedSession().getOwner(key);
        return owner ? owner.color.toNumber() : this.ck3ProvinceDuchyColors.get(key)?.toNumber() || this.eu4DefaultColor.toNumber();
    }
    private eu4Province2ColorLambda = (key: string) => (this.eu4Province2Color.get(key) || this.eu4DefaultColor).toNumber();

    protected currentlyActiveCountryKey = signal<string | null>(null);
    protected selectedCountryForDelete: string | null = null;
    protected autoFitCameraOnSelection = true;

    ngAfterViewInit() {
        // Combine route params with sessions load to avoid race condition
        combineLatest([
            this.activatedRoute.paramMap,
            this.refreshSessions$.pipe(
                switchMap(() => this.mapClaimService.getSessions$())
            )
        ]).pipe(
            filter(([params, sessions]) => sessions.length > 0 || !params.get('sessionId')),
            take(1)
        ).subscribe(([params, sessions]) => {
            const sessionId = params.get('sessionId');
            if (sessionId) {
                const id = parseInt(sessionId, 10);
                const session = sessions.find(s => s.id === id);
                if (session) {
                    this.loadSessionByHeader(session);
                }
            }
        });

        // Initial load of sessions
        this.refreshSessions$.next();

        combineLatest([
            this.ck3Service.getTitleRegistry$(),
            this.ck3Service.getLocaliser$(),
            this.converterService.getProvinceMapping$()
        ]).subscribe(([titleRegistry, localiser, mapping]) => {
            this.titleRegistry = titleRegistry;
            this.localiser = localiser;
            this.provinceMapping = mapping;
            this.mapService.fetchCK3GeoJson(true, true).subscribe((geoJson) => {
                const countyKey2DuchyColor = new Map<string, RGB>();
                titleRegistry.getAllCountyTitleKeys().forEach((countyKey: string) => {
                    const duchyKey = titleRegistry.getDeJureLiegeTitle(countyKey)!;
                    const duchyColor = titleRegistry.getVanillaTitleColor(duchyKey)!;
                    countyKey2DuchyColor.set(countyKey, duchyColor)
                });
                this.ck3ProvinceDuchyColors = countyKey2DuchyColor;
                const colorConfig = new ColorConfigProvider(this.ck3ColorConfigLambda, false);
                const meshes = makeGeoJsonPolygons(geoJson, colorConfig, () => null, () => false, 0.75);
                this.ck3Map.launch(meshes, [colorConfig], new BehaviorConfigProvider(0.75));
            });

            this.mapService.fetchEU4GeoJson(true, true).subscribe((geoJson) => {
                const colorConfig = new ColorConfigProvider(this.eu4Province2ColorLambda, true);
                const meshes = makeGeoJsonPolygons(geoJson, colorConfig, () => null, () => false, 0.75);
                this.eu4Map.launch(meshes, [colorConfig], new BehaviorConfigProvider(0.75));
            });
        });
    }

    onCK3SelectionChanged(event: PolygonSelectionEvent) {
        this.ngZone.runOutsideAngular(() => {
            if (this.currentlyActiveCountryKey() == null) {
                this.createNewCountryWithProvinceAndSetActive(event.key);
            }
            const country = this.selectedSession().countries.get(this.currentlyActiveCountryKey()!);
            if (country) {
                if (event.locked) {
                    this.selectedSession().setOwnership(event.key, this.currentlyActiveCountryKey()!);
                } else {
                    this.selectedSession().removeOwnership(event.key);
                }
            }
            this.rebuildEU4ProvinceVotes();
            this.repropagateStateToEU4();
        });
        this.hasChangesToSave.set(true);
        this.cdr.markForCheck();
    }

    private createNewCountryWithProvinceAndSetActive(provinceKey: string) {
        const clickedColor = this.titleRegistry!.getVanillaTitleColor(provinceKey)!;
        this.currentlyActiveCountryKey.set(this.selectedSession().createNewCountryWithProvince(`Country ${this.selectedSession().getCountries().size + 1}`, clickedColor, provinceKey));
    }

    onEU4HoverChanged(event: HoverChangedEvent) {

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

    private rebuildEU4ProvinceVotes() {
        this.eu4ProvinceVotes.clear();
        for (const [countryId, country] of this.selectedSession().getCountries()) {
            for (const countyKey of this.selectedSession().getProvincesOfCountry(countryId)) {
                const eu4Provinces = this.resolveCountyToEU4Provinces(countyKey);
                for (const eu4Province of eu4Provinces) {
                    if (!this.eu4ProvinceVotes.has(eu4Province)) {
                        this.eu4ProvinceVotes.set(eu4Province, new Map());
                    }
                    const votes = this.eu4ProvinceVotes.get(eu4Province)!;
                    votes.set(countryId, (votes.get(countryId) || 0) + 1);
                }
            }
        }
    }

    private repropagateStateToEU4() {
        console.log("Repropagating");
        const eu4ProvinceOwnershipVotes = this.gatherOwnershipVotes();
        const ownershipResults: Map<string, string> = new Map();
        eu4ProvinceOwnershipVotes.forEach((voters, province) => {
            const mostVotes = Math.max(...voters.map(voter => voters.filter(v => v === voter).length));
            ownershipResults.set(province, voters.find(voter => voters.filter(v => v === voter).length === mostVotes)!);
        });
        this.eu4Province2Color.clear();
        const lockedProvinces: string[] = [];
        ownershipResults.forEach((owner, province) => {
            const country = this.selectedSession().getCountry(owner);
            if (country) {
                this.eu4Province2Color.set(province, country.color);
            }
            const uniqueContestants = new Set(eu4ProvinceOwnershipVotes.get(province)!).size;
            if (uniqueContestants === 1) {
                lockedProvinces.push(province);
            }
        });
        this.eu4Map.resetSelection();
        this.eu4Map.refreshAllColors();
        if (this.autoFitCameraOnSelection && ownershipResults.size > 0) {
            this.eu4Map.fitCameraToPolygons(0.3, Array.from(ownershipResults.keys()));
        }
    }

    private gatherOwnershipVotes() {
        const eu4ProvinceOwnershipVotes: Map<string, string[]> = new Map();
        for (const [countryId, country] of this.selectedSession().getCountries()) {
            for (const countyKey of this.selectedSession().getProvincesOfCountry(countryId)) {
                const eu4Provinces = this.resolveCountyToEU4Provinces(countyKey);
                for (const eu4Province of eu4Provinces) {
                    if (!eu4ProvinceOwnershipVotes.has(eu4Province)) {
                        eu4ProvinceOwnershipVotes.set(eu4Province, []);
                    }
                    eu4ProvinceOwnershipVotes.get(eu4Province)!.push(countryId);
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

    clearAllSelections() {
        for (const id of this.selectedSession().countries.keys()) {
            this.removeCountry(null, id);
        }
    }

    selectCountry(countryId: string) {
        this.currentlyActiveCountryKey.set(countryId);
    }

    createNewCountry() {
        this.currentlyActiveCountryKey.set(null);
    }

    removeCountry(event: Event | null, countryId: string) {
        this.ngZone.runOutsideAngular(() => {
            if (event) {
                event.stopPropagation();
            }
            const countryProvinces = this.selectedSession().getProvincesOfCountry(countryId);
            this.selectedSession().removeCountry(countryId);
            if (this.currentlyActiveCountryKey() === countryId) {
                this.currentlyActiveCountryKey.set(this.selectedSession().getACountryId());
            }
            this.ck3Map.setLockedStates(Array.from(countryProvinces), false, false);
            this.rebuildEU4ProvinceVotes();
            this.repropagateStateToEU4();
        });
        this.cdr.markForCheck();
    }

    getEU4ProvinceCountForCountry(countryId: string): number {
        const eu4Provinces = new Set<string>();
        for (const countyKey of this.selectedSession().getProvincesOfCountry(countryId)) {
            this.resolveCountyToEU4Provinces(countyKey).forEach(p => eu4Provinces.add(p));
        }
        return eu4Provinces.size;
    }

    ck3TooltipProvider = (key: string): string => {
        const owner = this.selectedSession().getOwner(key);
        return "<b>" + this.localiser!.localise(key) + "</b><br>"
            + (owner ? `Owned by: ${owner.name}` : 'Unclaimed');
    };

    eu4TooltipProvider = (key: string): string => {
        const contestingCountries = this.eu4ProvinceVotes.get(key) || new Map();
        const tooltipTop = `<b>${key}</b><br>`;
        if (contestingCountries.size > 1) {
            return `${tooltipTop}Contested by:<br>${Array.from(contestingCountries.entries()).map(([countryId, votes]) => {
                const country = this.selectedSession().getCountry(countryId)!;
                return `${country?.name || 'Unknown'} (${votes} votes)`;
            }).join('<br>')}`;
        } else if (contestingCountries.size === 1) {
            const countryId = Array.from(contestingCountries.keys())[0];
            const country = this.selectedSession().getCountry(countryId)!;
            return `${tooltipTop}Owned by: ${country.name}`;
        }
        return tooltipTop;
    };

    toggleSessionPublic(isPublic: boolean) {
        const currentSession = this.selectedSession();
        if (currentSession.isOnline()) {
            this.mapClaimService.setIsPublic$(currentSession.id!, isPublic).subscribe(() => {
                currentSession.isPublic = isPublic;
                this.refreshSessions$.next();
            });
        }
    }

    renameSession() {
        const currentSession = this.selectedSession();
        if (!currentSession.isOnline()) {
            return;
        }

        const dialogRef = this.dialog.open(StringInputComponent, {
            width: '300px',
            data: { currentName: currentSession.name }
        });

        dialogRef.afterClosed().subscribe((newName: string | undefined) => {
            if (newName && newName.trim() !== '') {
                this.mapClaimService.setName$(currentSession.id!, newName).subscribe(() => {
                    currentSession.name = newName;
                    this.refreshSessions$.next();
                });
            }
        });
    }

    makeOnline() {
        const currentSession = this.selectedSession();
        
        const dialogRef = this.dialog.open(StringInputComponent, {
            width: '300px',
            data: { currentName: currentSession.name }
        });

        dialogRef.afterClosed().subscribe((newName: string | undefined) => {
            if (newName && newName.trim() !== '') {
                currentSession.name = newName;
                console.log("Creating session online with data", currentSession);
                this.mapClaimService.createSession$(currentSession).subscribe((result) => {
                    console.log("Received", result);
                    currentSession.id = result.id;
                    this.mapClaimService.setIsPublic$(result.id, true).subscribe(() => {
                        console.log(`Session ${currentSession.name} is now online`);
                        this.refreshSessions$.next();
                    });
                });
            }
        });
    }

    loadSessionByHeader(header: MapClaimSessionHeader) {
        this.mapClaimService.getSession$(header.id).subscribe((fullSession) => {
            this.loadSession(fullSession);
        });
    }

    onSessionSelected(sessionId: number | null) {
        if (sessionId === null) return; // offline session, don't load
        const session = this.availableSessions().find(s => s.id === sessionId);
        if (session) {
            this.loadSessionByHeader(session);
        }
    }

    deleteSession() {
        const currentSession = this.selectedSession();
        if (currentSession.isOnline()) {
            this.mapClaimService.deleteSession$(currentSession.id!).subscribe(() => {
                this.createNewLocalSession();
                //this.refreshSessions$.next();
            });
        }
    }

    createNewLocalSession() {
        const newLocalSession = new MapClaimSession(null, null, "local", Game.CK3, new Map(), new Map(), false);
        this.loadSession(newLocalSession);
    }

    saveCurrentSession() {
        const session = this.selectedSession();
        if (!session.isOnline()) {
            return;
        }

        combineLatest([
            this.mapClaimService.setCountries$(session.id!, session.countries),
            this.mapClaimService.replaceOwnership$(session.id!, session.ownership)
        ]).subscribe(() => {
            console.log(`Session ${session.name} saved successfully`);
            this.hasChangesToSave.set(false);
        });
    }

    private loadSession(session: MapClaimSession) {
        this.selectedSession.set(session);
        this.ck3Map.resetSelection(true);
        this.ngZone.runOutsideAngular(() => {
            const ownedProvinces = Array.from(session.ownership.keys());
            this.ck3Map.setLockedStates(ownedProvinces, true, false);
            this.ck3Map.refreshAllColors();
            this.rebuildEU4ProvinceVotes();
            this.repropagateStateToEU4();
            if (!session.isEmpty()) {
                this.ck3Map.fitCameraToPolygons(0.3, ownedProvinces);
            }
            this.currentlyActiveCountryKey.set(session.getACountryId());
        });
        this.cdr.markForCheck();
    }
}
