import { Injectable } from "@angular/core";
import { TableColumn } from "../../util/table/TableColumn";
import { SimpleTableColumn } from "../../util/table/SimpleTableColumn";
import { HttpClient } from "@angular/common/http";
import { GoodsViewMode } from "./GoodViewMode";
import { map } from "rxjs";
import { Country } from "../../model/vic/Country";
import { GoodCategory } from "../../model/vic/enum/GoodCategory";
import { Good } from "../../model/vic/game/Good";
import { ModelElementList } from "../../model/vic/ModelElementList";
import { Ownership } from "../../model/vic/Ownership";
import { Pop } from "../../model/vic/Pop";
import { PowerBloc } from "../../model/vic/PowerBloc";
import { Vic3GameFilesService } from "../../model/vic/Vic3GameFilesService";
import { AggregatingTableColumn } from "../../util/table/AggregatingTableColumn";
import { Building } from "../../model/vic/Building";

class BuildingAggregatingTableColumn extends AggregatingTableColumn<Country, Building> {

    constructor(def: string, header: string, tooltip: string, sortable: boolean, predicate: (building: Building) => boolean, valueExtractor: (building: Building) => number, predicateForNormalization: ((building: Building) => boolean) | null = null) {
        super(def, header, tooltip, sortable, predicate, valueExtractor, (building: Building) => building.getName(), predicateForNormalization);
    }
}

@Injectable({
    providedIn: 'root'
})
export class Vic3TableColumnProvider {

    baseColumns: TableColumn<Country>[] = [
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
            (element: Country) => this.getCountryName(element.getTag()),
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

    countryColumns: TableColumn<Country>[] = [
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
    ];

    countryFinancialColumns: TableColumn<Country>[] = [
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
                    .map(([key, value]) => `${TableColumn.formatNumber(value)} ${this.localiseBuildingName(key) || key}`).join('\n');
            }
        ),
    ];

    buildingFinancialsColumns: TableColumn<Country>[] = [
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
    ];

    buildingTableColumns: TableColumn<Country>[] = [
        new BuildingAggregatingTableColumn(
            'buildings',
            'Eco Buildings',
            'Total levels buildings excluding subsistence, governmental or infrastructure buildings',
            true,
            building => !building.isSubsistence() && !building.isGovernment() && !building.isInfrastructure() && !building.isCapitalistDen() && !building.isCompany(),
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
            b => b.isCapitalistDen() || b.isCompany(),
            b => b.getLevels()
        ),
    ];

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
            (element: PowerBloc) => this.getCountryName(element.getLeader().getTag())
        ),
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
        new BuildingAggregatingTableColumn(
            "localOwnedBuildings",
            "Public",
            "",
            true,
            b => b.getOwnership() == Ownership.LOCAL_GOVERNMENT,
            b => b.getLevels(),
            b => !b.isConstructionSector() && !b.isGovernment() && !b.isSubsistence()
        ),
        new BuildingAggregatingTableColumn(
            "localPrivateBuildingsFraction",
            "Private",
            "",
            true,
            b => b.getOwnership() == Ownership.LOCAL_CAPITALISTS,
            b => b.getLevels(),
            b => !b.isConstructionSector() && !b.isGovernment() && !b.isSubsistence()
        ),
        new BuildingAggregatingTableColumn(
            "foreignOwnedBuildings",
            "Foreign Owned",
            "",
            true,
            b => b.getOwnership() == Ownership.FOREIGN_CAPITALISTS || b.getOwnership() == Ownership.FOREIGN_GOVERNMENT,
            b => b.getLevels(),
            b => !b.isConstructionSector() && !b.isGovernment() && !b.isSubsistence()
        )
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

    public getGoodColumns(countries: Country[], viewMode: GoodsViewMode, selectedGoodsCategory: GoodCategory): TableColumn<Country>[] {
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
                        this.sharedGoodColumnTooltipFunction(good)
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