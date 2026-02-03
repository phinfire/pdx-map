import { of } from "rxjs";
import { Country } from "../../../model/vic/Country";
import { Vic3Save } from "../../../model/vic/Vic3Save";
import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";
import { LineViewerData } from "./LineViewerData";
import { DataSeries } from "./DataSeries";
import { CurveBuffer } from "../../../model/vic/CurveBuffer";

class CountryEntity implements LineableEntity {
    private visible = true;

    constructor(private country: Country, private color: string) { }

    getName(): string {
        return this.country.getPlayerName() || this.country.getTag();
    }

    getColor(): string {
        return this.color;
    }

    isVisible(): boolean {
        return this.visible;
    }

    setVisible(visible: boolean): void {
        this.visible = visible;
    }

    getCountry(): Country {
        return this.country;
    }
}

export class Vic3SaveSeriesData implements LineViewerData<Date> {

    private entities: LineableEntity[] = [];
    private save: Vic3Save | null = null;

    private readonly options = new Map([
        ["GDP (Millions)", () => of(this.buildSeriesForCurve((country: Country) => country.getGdpCurve(), (value: number) => parseFloat((value / 1_000_000).toFixed(2))))],
        ["Prestige", () => of(this.buildSeriesForCurve((country: Country) => country.getPrestigeCurve()))],
        ["Literacy", () => of(this.buildSeriesForCurve((country: Country) => country.getLiteracyCurve()))],
        ["Avg. Standard of Living", () => of(this.buildSeriesForCurve((country: Country) => country.getAvgSolTrendCurve()))],
    ]);

    private buildSeriesForCurve(curveAccessor: (country: Country) => CurveBuffer, valueTransformation: (value: number) => number = (value) => value) {
        const seriesMap = new Map<LineableEntity, DataSeries<Date>>();

        this.entities?.forEach((entity) => {
            const countryEntity = entity as any;
            const country = countryEntity.getCountry();
            const curve = curveAccessor(country);
            const tuples = this.getMonthlyMedianTuples(curve.getDateValuePairs(), valueTransformation);

            const series: DataSeries<Date> = {
                name: entity.getName(),
                color: entity.getColor(),
                values: tuples
            };
            seriesMap.set(entity, series);
        });

        return seriesMap;
    }

    private getMonthlyMedianTuples(
        dateValuePairs: Array<{ date: Date; value: number }>,
        valueTransformation: (value: number) => number
    ): Array<{ x: Date; y: number }> {
        const monthlyGroups = new Map<string, number[]>();
        dateValuePairs.forEach(({ date, value }) => {
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const transformedValue = valueTransformation(value);

            if (!monthlyGroups.has(monthKey)) {
                monthlyGroups.set(monthKey, []);
            }
            monthlyGroups.get(monthKey)!.push(transformedValue);
        });
        const tuples: Array<{ x: Date; y: number }> = [];
        const sortedMonths = Array.from(monthlyGroups.entries()).sort();

        sortedMonths.forEach(([monthKey, values]) => {
            const median = this.calculateMedian(values);
            const [year, month] = monthKey.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            tuples.push({ x: date, y: median });
        });
        return tuples;
    }

    private calculateMedian(values: number[]): number {
        if (values.length === 0) return 0;

        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);

        if (sorted.length % 2 === 0) {
            return (sorted[mid - 1] + sorted[mid]) / 2;
        }

        return sorted[mid];
    }

    static fromSaves(saves: Vic3Save[], tag2color: Map<string, string> = new Map()): Vic3SaveSeriesData {
        const targetSave = saves[saves.length - 1];
        return new Vic3SaveSeriesData(targetSave);
    }

    private constructor(save: Vic3Save) {
        this.save = save;
        this.entities = this.buildEntities(save);
        return this;
    }

    private buildEntities(save: Vic3Save): LineableEntity[] {
        const countries = save.getCountries(false);
        const colors = this.generateColors(countries.length);

        return countries.map((country, index) => {
            return new CountryEntity(country, colors[index]);
        });
    }

    private generateColors(count: number): string[] {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#52B788'
        ];
        while (colors.length < count) {
            const hue = (colors.length * 360 / count) % 360;
            colors.push(`hsl(${hue}, 70%, 50%)`);
        }

        return colors.slice(0, count);
    }

    getLineableEntities(): LineableEntity[] {
        return this.entities;
    }

    getOptions(): Map<string, LineAccessor<Date>> {
        return this.options;
    }
}
