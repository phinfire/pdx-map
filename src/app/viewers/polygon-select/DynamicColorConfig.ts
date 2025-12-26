import { ColorConfigProvider } from "./ColorConfigProvider";
import * as d3 from 'd3';

export class ValueGradientColorConfig extends ColorConfigProvider {

    private key2Value: Map<string, number>;

    private cached2Color = new Map<string, number>();

    constructor(key2Value: Map<string, number>) {
        super(new Map<string, number>(), true);
        this.key2Value = key2Value;
    }

    private valueToColor(value: number) {
        const max = Math.max(...Array.from(this.key2Value.values()));
        const normalizedValue = value / max;
        const scale = d3.scaleSequential(d3.interpolateInferno);
        const offsetValue = 0.1 + normalizedValue * 0.8;
        scale.domain([0, 1]);
        const hex = scale(offsetValue);
        return parseInt(hex.slice(1), 16);
    }

    override getColor(key: string): number {
        if (!this.cached2Color.has(key)) {
            const value = this.key2Value.get(key) || 0;
            const color = this.valueToColor(value);
            this.cached2Color.set(key, color);
        }
        return this.cached2Color.get(key)!;
    }
}