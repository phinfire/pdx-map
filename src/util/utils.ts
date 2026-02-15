import { Point2D } from "./Point2D";

export function simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return hash >>> 0;
}

export function gaussianSmooth<T>(points: Point2D<T>[], radius: number): Point2D<T>[] {
    if (!Number.isInteger(radius)) throw new Error("Radius must be an integer");
    if (radius <= 0 || points.length === 0) return points;
    const sigma = radius / 2;
    const kernel = Array.from({ length: radius * 2 + 1 }, (_, i) => {
        const x = i - radius;
        return Math.exp(-(x * x) / (2 * sigma * sigma));
    });
    const kernelSum = kernel.reduce((a, b) => a + b, 0);
    const normKernel = kernel.map(v => v / kernelSum);

    return points.map((p, i) => {
        let sum = 0;
        let weight = 0;

        for (let k = -radius; k <= radius; k++) {
            const queryIndex = i + k;
            const idx = Math.max(0, Math.min(points.length - 1, queryIndex));

            const w = normKernel[k + radius];
            sum += points[idx].y * w;
            weight += w;
        }

        return new Point2D(p.x, sum / weight);
    });
}