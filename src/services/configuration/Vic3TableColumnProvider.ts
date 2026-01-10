import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { map } from "rxjs";
import { Country } from "../../model/vic/Country";
import { GoodCategory } from "../../model/vic/enum/GoodCategory";
import { Good } from "../../model/vic/game/Good";
import { ModelElementList } from "../../model/vic/ModelElementList";
import { Ownership } from "../../model/vic/Ownership";
import { Pop } from "../../model/vic/Pop";
import { PowerBloc } from "../../model/vic/PowerBloc";
import { Vic3GameFilesService } from "../../model/vic/Vic3GameFilesService";
import { BuildingAggregatingTableColumnBuilder } from "../../util/table/BuildingAggregatingTableColumnBuilder";
import { ImageIconType } from "../../util/table/ImageIconType";
import { TableColumn } from "../../util/table/TableColumn";
import { TableColumnBuilder } from "../../util/table/TableColumnBuilder";
import { GoodsViewMode } from "./GoodViewMode";

@Injectable({
    providedIn: 'root'
})
export class Vic3TableColumnProvider {

    baseColumns: TableColumn<Country>[] = [
        new TableColumnBuilder<Country>("position", "")
            .isSortable(false)
            .withCellValue((element: Country, index: number) => index + 1)
            .withCellTooltip((_: Country) => null)
            .build(),
        new TableColumnBuilder<Country>("name", "Country")
            .withCellValue((element: Country) => this.getCountryName(element.getTag()))
            .withCellTooltip((_: Country) => null)
            .build(),
        new TableColumnBuilder<Country>("player", "Player")
            .withCellValue((element: Country) => element.getPlayerName() || "")
            .withCellTooltip((_: Country) => null)
            .build(),
    ];

    countryColumns: TableColumn<Country>[] = [
        new TableColumnBuilder<Country>("pops", "Pop.")
            .withTooltip("Population")
            .withCellValue((element: Country) => element.getPops().getTotal("pops", (pop: Pop) => true, (pop: Pop) => pop.getSize()))
            .withCellTooltip((element: Country) => Array.from(element.getPops().getTotalExplanation("pops", (pop: Pop) => true, (pop: Pop) => pop.getSize(), (pop: Pop) => pop.getType()).entries())
                .map(([name, val]) => `${TableColumn.formatNumber(val).padStart(15, ' ')}  ${name}`)
                .join('\n'))
            .withHeaderImage("groups", ImageIconType.MATERIAL_SYMBOL)
            .build(),
        new TableColumnBuilder<Country>("employed", "Employees")
            .withCellValue((element: Country) => element.getNumberOfEmployed())
            .withCellTooltip((element: Country) => element.getNumberOfEmployed().toLocaleString())
            .build(),
        new TableColumnBuilder<Country>("technologies", "Techs")
            .withCellValue((element: Country) => element.getAcquiredTechs().length)
            .withCellTooltip((element: Country) => element.getAcquiredTechs().sort().join('\n'))
            .withHeaderImage("experiment", ImageIconType.MATERIAL_SYMBOL)
            .build(),
        new TableColumnBuilder<Country>("netincome", "Net Income")
            .withCellValue((element: Country) => element.getBudget().getNetIncome())
            .withCellTooltip((_: Country) => null)
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            "construction_sectors",
            "Construction Sectors"
        )
            .withTooltip("Total levels of all construction sector buildings owned by this country")
            .isSortable(true)
            .withPredicate(b => b.isConstructionSector())
            .withValueExtractor(b => b.getLevels())
            .build()
    ];

    countryFinancialColumns: TableColumn<Country>[] = [
        new TableColumnBuilder<Country>("cash", "Cash")
            .withCellValue((element: Country) => element.getBudget().getNetCash())
            .withCellTooltip((_: Country) => null)
            .build(),
        new TableColumnBuilder<Country>("credit", "Credit")
            .withCellValue((element: Country) => element.getBudget().getCredit())
            .withCellTooltip((_: Country) => null)
            .build(),
        new TableColumnBuilder<Country>("investmentPool", "I. Pool")
            .withCellValue((element: Country) => element.getBudget().getInvestmentPool())
            .withCellTooltip((_: Country) => null)
            .build(),
        new TableColumnBuilder<Country>("tax", "Tax")
            .withCellValue((element: Country) => element.getBudget().getTaxIncome())
            .withCellTooltip((element: Country) => element.getTaxLevel().toUpperCase())
            .build(),
        new TableColumnBuilder<Country>("minting", "Minting")
            .withCellValue((element: Country) => element.getBudget().getMintingIncome())
            .withCellTooltip((_: Country) => null)
            .build(),
        new TableColumnBuilder<Country>("investmentPoolGrowth", "I. Pool Growth")
            .withCellValue((element: Country) => {
                const growth = element.getBudget().getInvestmentPoolGrowth();
                return Array.from(growth.values()).reduce((a, b) => a + b, 0);
            })
            .withCellTooltip((element: Country) => {
                const growth = element.getBudget().getInvestmentPoolGrowth();
                return Array.from(growth.entries()).sort((a, b) => b[1] - a[1])
                    .map(([key, value]) => `${TableColumn.formatNumber(value)} ${this.localiseBuildingName(key) || key}`).join('\n');
            })
            .build(),
    ];

    buildingFinancialsColumns: TableColumn<Country>[] = [
        new BuildingAggregatingTableColumnBuilder(
            "cashReserves",
            "£ Reserves"
        )
            .withTooltip("Total cash reserve of all buildings")
            .isSortable(true)
            .withPredicate(b => true)
            .withValueExtractor(b => Math.floor(b.getCashReserves()))
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            "dividends",
            "Dividends"
        )
            .withTooltip("Total dividends paid by all buildings")
            .isSortable(true)
            .withPredicate(b => true)
            .withValueExtractor(b => Math.floor(b.getDividends()))
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            "valueGoodsSold",
            "Goods Sold"
        )
            .withTooltip("")
            .isSortable(true)
            .withPredicate(b => true)
            .withValueExtractor(b => Math.floor(b.getMarketValueOfGoodSold()))
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            "valueAdded",
            "Value Added"
        )
            .withTooltip("")
            .isSortable(true)
            .withPredicate(b => true)
            .withValueExtractor(b => Math.floor(Math.max(0, b.getNetValueAdded())))
            .build()
    ];

    buildingTableColumns: TableColumn<Country>[] = [
        new BuildingAggregatingTableColumnBuilder(
            'buildings',
            'Eco Buildings'
        )
            .withTooltip('Total levels buildings excluding subsistence, governmental or infrastructure buildings')
            .isSortable(true)
            .withPredicate(building => !building.isSubsistence() && !building.isGovernment() && !building.isInfrastructure() && !building.isCapitalistDen() && !building.isCompany())
            .withValueExtractor(b => b.getLevels())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            'factories',
            'Factories'
        )
            .withTooltip('Number of factories')
            .isSortable(true)
            .withPredicate(b => b.isFactory())
            .withValueExtractor(b => b.getLevels())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            'agricultural',
            'Agricultural'
        )
            .withTooltip('Number of agricultural buildings')
            .isSortable(true)
            .withPredicate(b => b.isAgricultural())
            .withValueExtractor(b => b.getLevels())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            'mine',
            'Mines'
        )
            .withTooltip('Number of mine buildings')
            .isSortable(true)
            .withPredicate(b => b.isMine())
            .withValueExtractor(b => b.getLevels())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            'government',
            'Government'
        )
            .withTooltip('Number of government buildings')
            .isSortable(true)
            .withPredicate(b => b.isGovernment())
            .withValueExtractor(b => b.getLevels())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            'infrastructure',
            'Infrastructure'
        )
            .withTooltip('Number of infrastructure buildings')
            .isSortable(true)
            .withPredicate(b => b.isInfrastructure())
            .withValueExtractor(b => b.getLevels())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            'capital',
            'Capital'
        )
            .withTooltip('Number of capitalist den buildings')
            .isSortable(true)
            .withPredicate(b => b.isCapitalistDen() || b.isCompany())
            .withValueExtractor(b => b.getLevels())
            .build(),
    ];

    powerBlocColumns: TableColumn<PowerBloc>[] = [
        new TableColumnBuilder<PowerBloc>("position", "")
            .withCellValue((_, index: number) => index + 1)
            .withCellTooltip((_: PowerBloc) => null)
            .build(),
        new TableColumnBuilder<PowerBloc>("name", "Name")
            .withCellValue((element: PowerBloc) => element.getName())
            .withCellTooltip((_: PowerBloc) => null)
            .build(),
        new TableColumnBuilder<PowerBloc>("leader", "Leader")
            .withCellValue((element: PowerBloc) => this.getCountryName(element.getLeader().getTag()))
            .withCellTooltip((_: PowerBloc) => null)
            .build(),
        Vic3TableColumnProvider.tableColumnfromModelElementList<PowerBloc, Country>(
            "members",
            "Members",
            null,
            element => element.getCountries(),
            _ => true,
            _ => 1,
            (country: Country) => country.getTag()
        ),
        Vic3TableColumnProvider.tableColumnfromModelElementList<PowerBloc, Country>(
            "population",
            "Population",
            null,
            element => element.getCountries(),
            _ => true,
            (country: Country) => country.getPopulation(),
            (country: Country) => this.getCountryName(country.getTag())
        )
    ];

    ecoConnectionsColumns: TableColumn<Country>[] = [
        new BuildingAggregatingTableColumnBuilder(
            "localOwnedBuildings",
            "Public"
        )
            .withTooltip("")
            .isSortable(true)
            .withPredicate(b => b.getOwnership() == Ownership.LOCAL_GOVERNMENT)
            .withValueExtractor(b => b.getLevels())
            .withPredicateForNormalization(b => !b.isConstructionSector() && !b.isGovernment() && !b.isSubsistence())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            "localPrivateBuildingsFraction",
            "Private"
        )
            .withTooltip("")
            .isSortable(true)
            .withPredicate(b => b.getOwnership() == Ownership.LOCAL_CAPITALISTS)
            .withValueExtractor(b => b.getLevels())
            .withPredicateForNormalization(b => !b.isConstructionSector() && !b.isGovernment() && !b.isSubsistence())
            .build(),
        new BuildingAggregatingTableColumnBuilder(
            "foreignOwnedBuildings",
            "Foreign Owned"
        )
            .withTooltip("")
            .isSortable(true)
            .withPredicate(b => b.getOwnership() == Ownership.FOREIGN_CAPITALISTS || b.getOwnership() == Ownership.FOREIGN_GOVERNMENT)
            .withValueExtractor(b => b.getLevels())
            .withPredicateForNormalization(b => !b.isConstructionSector() && !b.isGovernment() && !b.isSubsistence())
            .build()
    ];

    goodColumns: TableColumn<Country>[] = [];

    locLookup = new Map<string, string>();

    constructor(http: HttpClient, private vic3GameFiles: Vic3GameFilesService) {
        const dataUrl = "https://codingafterdark.de/pdx/pdx-map-gamedata/vic/"
        http.get(dataUrl + 'converted_countries_l_english.yml', { responseType: 'text' }).subscribe((data) => {
            for (const line of data.split('\n')) {
                if (line.trim().length > 0 && !line.startsWith('#')) {
                    const [key, value] = line.split(':').map(part => part.trim());
                    if (key && value) {
                        this.locLookup.set(key, value.substring(1, value.length - 1));
                    }
                }
            }
        });
    }

    getCountryName(key: string): string {
        return key;
    }

    localiseBuildingName(key: string): string {
        return key;
    }

    public getBaseColumnList(): TableColumn<Country>[] {
        return this.baseColumns;
    }

    public getCountryColumnList(): TableColumn<Country>[] {
        return this.baseColumns.concat(this.countryColumns);
    }

    public getCountryFinancialColumnList(): TableColumn<Country>[] {
        return this.baseColumns.concat(this.countryFinancialColumns);
    }

    public getBuildingFinancialColumnList(): TableColumn<Country>[] {
        return this.baseColumns.concat(this.buildingFinancialsColumns);
    }

    public getBuildingTableColumnList(): TableColumn<Country>[] {
        return this.baseColumns.concat(this.buildingTableColumns);
    }

    public getPowerBlocColumnList(): TableColumn<PowerBloc>[] {
        return this.powerBlocColumns;
    }

    public getEcoConnectionsColumnList(): TableColumn<Country>[] {
        return this.baseColumns.concat(this.ecoConnectionsColumns);
    }

    public getGoodColumns(): TableColumn<Country>[] {
        return this.goodColumns;
    }

    private sharedGoodColumnTooltipFunction(good: Good) {
        return (element: Country) => {
            const outVal = Math.floor(element.getGoodOut(good.index)).toString();
            const inVal = Math.floor(element.getGoodIn(good.index)).toString();
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

    refreshGoodColumnList(countries: Country[], viewMode: GoodsViewMode, selectedGoodsCategory: GoodCategory) {
        this.vic3GameFiles.getGoods().pipe(
            map(goods => {
                const cols = goods
                    .filter(good => {
                        const total = countries
                            .map((country: Country) => {
                                if (viewMode === GoodsViewMode.INPUT) { return country.getGoodIn(good.index); }
                                if (viewMode === GoodsViewMode.OUTPUT) { return country.getGoodOut(good.index); }
                                return country.getGoodOut(good.index) - country.getGoodIn(good.index);
                            })
                            .reduce((a, b) => a + b, 0);
                        return good.category === selectedGoodsCategory && total > 0;
                    })
                    .map(good => new TableColumn<Country>(
                        good.key,
                        good.name,
                        null,
                        true,
                        (element: Country) => {
                            let value = 0;
                            if (viewMode === GoodsViewMode.INPUT) value = element.getGoodIn(good.index);
                            else if (viewMode === GoodsViewMode.OUTPUT) value = element.getGoodOut(good.index);
                            else value = element.getGoodOut(good.index) - element.getGoodIn(good.index);

                            return Math.floor(value);
                        },
                        this.sharedGoodColumnTooltipFunction(good),
                        null,
                        false,
                        good.getIconUrl(),
                        ImageIconType.IMAGE_URL
                    ));

                return this.getBaseColumnList().concat(cols);
            })
        ).subscribe(cols => {
            this.goodColumns = cols;
            console.log(
                `Found ${cols.length} goods columns for view mode ${viewMode} and category ${selectedGoodsCategory.key}`
            );
        });
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