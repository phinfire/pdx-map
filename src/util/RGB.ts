export class RGB {

    constructor(public readonly r: number, public readonly g: number, public readonly b: number) {
        if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255 || !Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b)) {
            throw new Error("Invalid RGB color");
        }
    }

    toNumber(): number {
        return (this.r << 16) | (this.g << 8) | this.b;
    }

    toHexString(): string {
        return `#${this.toNumber().toString(16).padStart(6, '0')}`;
    }

    adjustBrightness(factor: number): RGB {
        return new RGB(
            Math.min(255, Math.max(0, Math.round(this.r * factor))),
            Math.min(255, Math.max(0, Math.round(this.g * factor))),
            Math.min(255, Math.max(0, Math.round(this.b * factor)))
        );
    }

    public static fromHSV(h: number, s: number, v: number): RGB {
        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;
        let r = 0, g = 0, b = 0;
        if (h < 60) {
            r = c; g = x; b = 0;
        } else if (h < 120) {
            r = x; g = c; b = 0;
        } else if (h < 180) {
            r = 0; g = c; b = x;
        } else if (h < 240) {
            r = 0; g = x; b = c;
        } else if (h < 300) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        return new RGB(Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255));
    }

    
}