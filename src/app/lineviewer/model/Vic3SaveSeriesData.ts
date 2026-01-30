import { Injectable } from "@angular/core";
import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";
import { LineViewerData } from "./LineViewerData";
import { of } from "rxjs";
import { DataSeries } from "../LinePlotterService";
import { Vic3Save } from "../../../model/vic/Vic3Save";
import { Country } from "../../../model/vic/Country";

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

export class Vic3SaveSeriesData implements LineViewerData {

    private entities: LineableEntity[] | null = null;
    private save: Vic3Save | null = null;

    private readonly options = new Map([
        ["GDP", () => of(this.buildSeriesForCurve((country: Country) => country.getGdpCurve(), 1_000_000))],
        ["Prestige", () => of(this.buildSeriesForCurve((country: Country) => country.getPrestigeCurve(), 1))],
        ["Literacy", () => of(this.buildSeriesForCurve((country: Country) => country.getLiteracyCurve(), 1))],
        ["Average SoL", () => of(this.buildSeriesForCurve((country: Country) => country.getAvgSolTrendCurve(), 1))],
    ]);

    private buildSeriesForCurve(curveAccessor: (country: Country) => any, scaleFactor: number): Map<LineableEntity, DataSeries> {
        const seriesMap = new Map<LineableEntity, DataSeries>();
        
        this.entities?.forEach((entity) => {
            const countryEntity = entity as any;
            const country = countryEntity.getCountry();
            const curve = curveAccessor(country); 
            const dateValuePairs = curve.getDateValuePairs();
            const yearMap = new Map<number, number>();
            dateValuePairs.forEach((pair: any) => {
                const year = pair.date.getFullYear();
                yearMap.set(year, pair.value);
            });
            const values = Array.from(yearMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([year, value]) => ({
                    x: year,
                    y: parseFloat((value / scaleFactor).toFixed(1))
                }));
            
            const series: DataSeries = {
                name: entity.getName(),
                color: entity.getColor(),
                values: values
            };
            seriesMap.set(entity, series);
        });
        
        return seriesMap;
    }

    constructor(save: Vic3Save) {
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
        return this.entities ?? [];
    }

    getOptions(): Map<string, LineAccessor> {
        return this.options;
    }
}
