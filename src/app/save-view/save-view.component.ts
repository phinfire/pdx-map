import { Component, Input, SimpleChanges } from '@angular/core';
import { PdxFileService } from '../pdx-file.service';
import { HttpClient } from '@angular/common/http';
import { MatTabsModule } from '@angular/material/tabs';
import { Vic3Save } from '../model/Vic3Save';
import { Country } from '../model/vic/Country';
import { TableComponent } from '../vic3-country-table/vic3-country-table.component';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TableColumn } from '../util/TableColumn';
import { BuildingAggregatingTableColumn } from '../util/BuildingAggregatingTableColumn';
import { MatRadioModule } from '@angular/material/radio';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PowerBloc } from '../model/vic/PowerBloc';
import { SimpleTableColumn } from '../util/SimpleTableColumn';
import { Pop } from '../model/vic/Pop';
import { ModelElementList } from '../model/vic/ModelElementList';

enum GoodsViewMode {
    INPUT = "input",
    OUTPUT = "output",
    BALANCE = "balance"
}

@Component({
    selector: 'app-save-view',
    imports: [MatTabsModule, TableComponent, MatProgressSpinnerModule, CommonModule, MatRadioModule, FormsModule, MatButtonToggleModule],
    templateUrl: './save-view.component.html',
    styleUrl: './save-view.component.scss'
})
export class SaveViewComponent {

    @Input() activeSave?: Vic3Save;

    includeAi = false;
    selectedTabIndex = 0;
    locLookup = new Map<string, string>();
    index2GoodKey = new Map<number, string>();
    goodKey2Category = new Map<string, string>();

    cachedCountries: Country[] = [];

    sharedColumns: TableColumn<Country>[] = [
        new TableColumn<Country>(
            'position',
            '',
            null,
            false,
            (element: Country, index: number) => index + 1,
            (element: Country, index: number) => null
        ),
        new TableColumn<Country>(
            'name',
            'Country',
            null,
            true,
            (element: Country) => this.getCountryName(element.getName()),
            (element: Country) => null
        ),
        new TableColumn<Country>(
            "player",
            "Player",
            null,
            true,
            (element: Country) => element.getPlayerName() || "",
            (element: Country) => null
        ),
    ];

    countryColumns: TableColumn<Country>[] = this.sharedColumns.concat([
        new TableColumn<Country>(
            "pops",
            "Pop.",
            "Population",
            true,
            (element: Country) => element.getPops().getTotal("pops", (pop: Pop) => true, (pop: Pop) => pop.getSize()),
            (element: Country) => Array.from(element.getPops().getTotalExplanation("pops", (pop: Pop) => true, (pop: Pop) => pop.getSize(), (pop: Pop) => pop.getType()).entries())
                .map(([name, val]) => `${TableColumn.formatNumber(val).padStart(15, ' ')}  ${name}`)
                .join('\n')
        ),
        new TableColumn<Country>(
            'employed',
            'Employees',
            null,
            true,
            (element: Country) => element.getNumberOfEmployed(),
            (element: Country) => element.getNumberOfEmployed().toLocaleString()
        ),
        new TableColumn<Country>(
            "technologies",
            "Techs",
            null,
            true,
            (element: Country) => element.getAcquiredTechs().length,
            (element: Country) => element.getAcquiredTechs().sort().join('\n')
        ),
        new SimpleTableColumn<Country>(
            "netincome",
            "Net Income",
            (element: Country) => element.getBudget().getNetIncome()
        ),
        new BuildingAggregatingTableColumn(
            "construction_sectors",
            "Construction Sectors",
            "Total levels of all construction sector buildings owned by this country",
            true,
            b => b.isConstructionSector(),
            b => b.getLevels()
        )

    ]);

    countryFinancialColumns: TableColumn<Country>[] = this.sharedColumns.concat([]).concat([
        new TableColumn<Country>(
            "cash",
            "Cash",
            null,
            true,
            (element: Country) => element.getBudget().getNetCash(),
            (element: Country) => null
        ),
        new TableColumn<Country>(
            "credit",
            "Credit",
            null,
            true,
            (element: Country) => element.getBudget().getCredit(),
            (element: Country) => null
        ),
        new TableColumn<Country>(
            "investmentPool",
            "I. Pool",
            null,
            true,
            (element: Country) => element.getBudget().getInvestmentPool(),
            (element: Country) => null
        ),
        new SimpleTableColumn<Country>(
            "tax",
            "Tax",
            (element: Country) => element.getBudget().getTaxIncome(),
            (element: Country) => element.getTaxLevel().toUpperCase()
        ),
        new SimpleTableColumn<Country>(
            "minting",
            "Minting",
            (element: Country) => element.getBudget().getMintingIncome()),
        new TableColumn<Country>(
            "investmentPoolGrowth",
            "I. Pool Growth",
            null,
            true,
            (element: Country) => {
                const growth = element.getBudget().getInvestmentPoolGrowth();
                return Array.from(growth.values()).reduce((a, b) => a + b, 0);
            },
            (element: Country) => {
                const growth = element.getBudget().getInvestmentPoolGrowth();
                return Array.from(growth.entries()).sort((a, b) => b[1] - a[1])
                    .map(([key, value]) => `${TableColumn.formatNumber(value)} ${this.locLookup.get(key) || key}`).join('\n');
            }
        ),
    ]);

    buildingFinancialsColumns: TableColumn<Country>[] = this.sharedColumns.concat([
        new BuildingAggregatingTableColumn(
            "cashReserves",
            "£ Reserves",
            "Total cash reserve of all buildings",
            true,
            b => true,
            b => Math.floor(b.getCashReserves())
        ),
        new BuildingAggregatingTableColumn(
            "dividends",
            "Dividends",
            "Total dividends paid by all buildings",
            true,
            b => true,
            b => Math.floor(b.getDividends())
        ),
        new BuildingAggregatingTableColumn(
            "valueGoodsSold",
            "Goods Sold",
            "",
            true,
            b => true,
            b => Math.floor(b.getMarketValueOfGoodSold())
        ),
        new BuildingAggregatingTableColumn(
            "valueAdded",
            "Value Added",
            "",
            true,
            b => true,
            b => Math.floor(Math.max(0, b.getNetValueAdded()))
        )
    ]);

    buildingTableColumns: TableColumn<Country>[] = this.sharedColumns.concat([
        new BuildingAggregatingTableColumn(
            'buildings',
            'Eco Buildings',
            'Total levels buildings excluding subsistence, governmental or infrastructure buildings',
            true,
            building => !building.isSubsistence() && !building.isGovernment() && !building.isInfrastructure() && !building.isCapitalistDen(),
            b => b.getLevels()
        ),
        new BuildingAggregatingTableColumn(
            'factories',
            'Factories',
            'Number of factories',
            true,
            b => b.isFactory(),
            b => b.getLevels()
        ),
        new BuildingAggregatingTableColumn(
            'agricultural',
            'Agricultural',
            'Number of agricultural buildings',
            true,
            b => b.isAgricultural(),
            b => b.getLevels()
        ),
        new BuildingAggregatingTableColumn(
            'mine',
            'Mines',
            'Number of mine buildings',
            true,
            b => b.isMine(),
            b => b.getLevels()
        ),
        new BuildingAggregatingTableColumn(
            'government',
            'Government',
            'Number of government buildings',
            true,
            b => b.isGovernment(),
            b => b.getLevels()
        ),
        new BuildingAggregatingTableColumn(
            'infrastructure',
            'Infrastructure',
            'Number of infrastructure buildings',
            true,
            b => b.isInfrastructure(),
            b => b.getLevels()
        ),
        new BuildingAggregatingTableColumn(
            'capital',
            'Capital',
            'Number of capitalist den buildings',
            true,
            b => b.isCapitalistDen(),
            b => b.getLevels()
        ),
    ]);

    powerBlocColumns: TableColumn<PowerBloc>[] = [
        new SimpleTableColumn<PowerBloc>(
            'position',
            '',
            (_, index: number) => index + 1
        ),
        new SimpleTableColumn<PowerBloc>(
            "name",
            "Name",
            (element: PowerBloc) => element.getName()),
        new SimpleTableColumn<PowerBloc>(
            "leader",
            "Leader",
            (element: PowerBloc) => this.locLookup.get(element.getLeader().getName()) || element.getLeader().getName()
        ),
        SaveViewComponent.tableColumnfromModelElementList<PowerBloc, Country>(
            "members",
            "Members",
            null,
            element => element.getCountries(),
            _ => true,
            _ => 1,
            (country: Country) => country.getName()
        ),
        SaveViewComponent.tableColumnfromModelElementList<PowerBloc, Country>(
            "population",
            "Population",
            null,
            element => element.getCountries(),
            _ => true,
            (country: Country) => country.getPopulation(),
            (country: Country) => this.locLookup.get(country.getName()) || country.getName()
        )
    ];

    potentialGoodColumns: TableColumn<Country>[] = [];
    goodColumns: TableColumn<Country>[] = [];

    goodsViewMode = GoodsViewMode.BALANCE;

    availableGoodsCategories: string[] = ["staple", "industrial", "luxury", "military"];
    selectedGoodsCategory: string = "industrial"

    constructor(fileService: PdxFileService, private http: HttpClient) {
        const dataUrl = "https://codingafterdark.de/pdx/vic3gamedata/"
        this.http.get(dataUrl + 'converted_countries_l_english.yml', { responseType: 'text' }).subscribe((data) => {
            for (const line of data.split('\n')) {
                if (line.trim() === '' || line.startsWith('#')) continue;
                const [key, value] = line.split(':').map(part => part.trim());
                if (key && value) {
                    this.locLookup.set(key, value.substring(1, value.length - 1));
                }
            }
        });
        this.http.get(dataUrl + "00_goods.txt", { responseType: 'text' }).subscribe((data) => {
            fileService.importFile([new File([data], "00_goods.txt")], (name, json) => {
                let i = 0;
                for (const key in json) {
                    this.index2GoodKey.set(i, key);
                    const category = json[key]["category"];
                    this.goodKey2Category.set(key, category);
                    this.locLookup.set(key, key.charAt(0).toUpperCase() + key.slice(1));
                    i++;
                }
                this.refreshGoodColumnList();
            })
        });
    }

    ngOnInit() {
        const savedIndex = localStorage.getItem('saveViewTabIndex');
        this.selectedTabIndex = savedIndex !== null ? +savedIndex : 0;
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['activeSave'] && this.activeSave) {
            this.onGoodsCategoryChange(this.selectedGoodsCategory);
        }
    }

    onTabChange(index: number) {
        this.selectedTabIndex = index;
        localStorage.setItem('saveViewTabIndex', index.toString());
    }

    onGoodsViewModeChange(mode: string) {
        const asEnum = [GoodsViewMode.INPUT, GoodsViewMode.OUTPUT, GoodsViewMode.BALANCE].find(m => m === mode);
        if (asEnum) {
            this.goodsViewMode = asEnum;
            this.refreshGoodColumnList();
        } else {
            throw new Error(`Invalid goods view mode: ${mode}`);
        }
    }

    onGoodsCategoryChange(category: string) {
        this.selectedGoodsCategory = category;
        this.refreshGoodColumnList();
    }

    refreshGoodColumnList() {
        const getSharedTooltipFunction = (goodIndex: number) => {
            return (element: Country) => {
                const outVal = Math.floor(element.getGoodOut(goodIndex)).toString();
                const inVal = Math.floor(element.getGoodIn(goodIndex)).toString();
                const maxValueLength = Math.max(
                    outVal.length,
                    inVal.length
                );
                const outPadding = ' '.repeat(Math.max(1, maxValueLength - outVal.length));
                const inPadding = ' '.repeat(Math.max(1, maxValueLength - inVal.length));
                if (outVal === "0" && inVal === "0") {
                    return null;
                }
                if (outVal === "0") {
                    return "- " + inVal;
                }
                if (inVal === "0") {
                    return "+ " + outVal;
                }
                return "+" + outPadding + outVal + "\n-" + inPadding + inVal;

            }
        }
        const cols = Array.from(this.index2GoodKey.keys()).map((index) => {
            const goodKey = this.index2GoodKey.get(index)!;
            const total = this.activeSave == null ? 0 : this.activeSave.getCountries(true).map((country: Country) => {
                if (this.goodsViewMode == GoodsViewMode.INPUT) {
                    return country.getGoodIn(index);
                } else if (this.goodsViewMode == GoodsViewMode.OUTPUT) {
                    return country.getGoodOut(index);
                } else {
                    return country.getGoodOut(index) - country.getGoodIn(index);
                }
            }).reduce((a: number, b: number) => a + b, 0);
            if (total === 0) {
                return null;
            }
            return new TableColumn<Country>(
                goodKey,
                this.locLookup.get(goodKey)!,
                null,
                true,
                (element: Country) => {
                    let value = -1;
                    if (this.goodsViewMode == GoodsViewMode.INPUT) {
                        value = element.getGoodIn(index);
                    } else if (this.goodsViewMode == GoodsViewMode.OUTPUT) {
                        value = element.getGoodOut(index);
                    } else if (this.goodsViewMode == GoodsViewMode.BALANCE) {
                        value = element.getGoodOut(index) - element.getGoodIn(index);
                    }
                    return Math.floor(value);
                },
                getSharedTooltipFunction(index)
            );
        }).filter(col => col !== null);
        this.potentialGoodColumns = cols;
        this.goodColumns = this.sharedColumns.concat(this.potentialGoodColumns.filter(col => {
            return this.goodKey2Category.get(col.def) === this.selectedGoodsCategory;
        }));
    }

    getCountryName(tag: string) {
        return this.locLookup.get(tag) || tag;
    }

    format(value: number): string {
        if (value < 1000) {
            return value.toString();
        } else if (value < 1000000) {
            return (value / 1000).toFixed(1) + 'K';
        } else {
            return (value / 1000000).toFixed(1) + 'M';
        }
    }

    getCountries() {
        if (this.cachedCountries.length === 0 && this.activeSave) {
            this.cachedCountries = this.activeSave.getCountries(this.includeAi);
        }
        return this.cachedCountries;
    }


    public static tableColumnfromModelElementList<T, R>(def: string, header: string, tooltip: string | null, listAccessor: (element: T) => ModelElementList<R>, predicate: (e: R) => boolean, accessor: (e: R) => number, keyFunction: (e: R) => string): TableColumn<T> {
        return new TableColumn<T>(
            def,
            header,
            tooltip,
            true,
            (element: T, index: number) => listAccessor(element).getTotal(def, predicate as (e: R) => boolean, accessor as (e: R) => number),
            (element: T, index: number) => Array.from(listAccessor(element).getTotalExplanation(def, predicate, accessor, keyFunction))
                .map(([name, val]) => `${TableColumn.formatNumber(val).padStart(15, ' ')}  ${name}`).join('\n')
        );
    }
}
