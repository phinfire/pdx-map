export class ColorConfigProvider {

    private readonly GEOMETRY_DEFAULT_COLOR = 0x666666;
    private readonly INACTIVE_GEOMETRY_COLOR = 0x202020;
    private key2color: ((key: string) => number);
    constructor(key2color: Map<string, number> | ((key: string) => number), private fullColorByDefault: boolean = false) {
        if (key2color instanceof Map) {
            this.key2color = (key: string) => {
                if (key2color.has(key)) {
                    return key2color.get(key)!;
                }
                return this.GEOMETRY_DEFAULT_COLOR;
            };
        } else {
            this.key2color = key2color;
        }
    }

    getColor(key: string, interactive: boolean, hover: boolean, locked: boolean) {
        if (interactive) {
            if (this.fullColorByDefault) {
                return this.getPrimaryColor(key);
            }
            const primaryColor = this.getPrimaryColor(key);
            if (locked) {
                return primaryColor;
            } else {
                if (hover) {
                    return this.adjustBrightness(primaryColor, 0.8);
                } else {
                    return this.adjustBrightness(primaryColor, 0.4);
                }
            }
        } else {
            return this.INACTIVE_GEOMETRY_COLOR;
        }
    }

    getPrimaryColor(key: string) {
        return this.key2color(key);
    }

    getClearColor() {
        return 0x000000;
    }

    alphaBlend(color1: number, color2: number, alpha: number): number {
        alpha = Math.max(0, Math.min(1, alpha));

        const r1 = (color1 >> 16) & 0xff;
        const g1 = (color1 >> 8) & 0xff;
        const b1 = color1 & 0xff;

        const r2 = (color2 >> 16) & 0xff;
        const g2 = (color2 >> 8) & 0xff;
        const b2 = color2 & 0xff;
        const r = Math.round(r1 * (1 - alpha) + r2 * alpha);
        const g = Math.round(g1 * (1 - alpha) + g2 * alpha);
        const b = Math.round(b1 * (1 - alpha) + b2 * alpha);
        return (r << 16) | (g << 8) | b;
    }

    adjustBrightness(color: number, brightnessFactor: number): number {
        brightnessFactor = Math.max(0, Math.min(1, brightnessFactor));

        const r = (color >> 16) & 0xff;
        const g = (color >> 8) & 0xff;
        const b = color & 0xff;

        const newR = Math.round(r * brightnessFactor);
        const newG = Math.round(g * brightnessFactor);
        const newB = Math.round(b * brightnessFactor);

        const clampedR = Math.max(0, Math.min(255, newR));
        const clampedG = Math.max(0, Math.min(255, newG));
        const clampedB = Math.max(0, Math.min(255, newB));

        return (clampedR << 16) | (clampedG << 8) | clampedB;
    }
}