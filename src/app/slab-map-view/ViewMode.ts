import { RGB } from "../../util/RGB";
import { ColorConfigProvider } from "../viewers/polygon-select/ColorConfigProvider";
import { ValueGradientColorConfig } from "../viewers/polygon-select/ValueGradientColorConfig";

export interface ViewMode {
    getColorConfig(): ColorConfigProvider;
    getTooltip(): (key: string) => string;
}

export class CategoryViewMode<T, R> implements ViewMode {

    private colorConfig: ColorConfigProvider;
    private key2Category: Map<string, R>;

    constructor(private key2Entity: Map<string, T>, private entity2Category: (entity: T) => R, category2Color: (category: R) => RGB, private nameGetter: (entity: T) => string, private categoryNameGetter: (category: R) => string, private categoryType: string, private icon: string) {
        this.key2Category = new Map<string, R>();
        const key2Color = new Map<string, number>();
        for (const [key, entity] of key2Entity) {
            const category = entity2Category(entity);
            const color = category2Color(category);
            this.key2Category.set(key, category);
            key2Color.set(key, color.toNumber());

        }
        this.colorConfig = new ColorConfigProvider(key2Color, true);
    }

    getColorConfig(): ColorConfigProvider {
        return this.colorConfig;
    }

    getTooltip(): (key: string) => string {
        return (key: string) => {
            const entity = this.key2Entity.get(key);
            if (!entity) {
                return '';
            }
            const category = this.key2Category.get(key);
            if (category === undefined) {
                return '';
            }
            return `<strong>${this.nameGetter(entity)}</strong><br>${this.categoryType}: ${this.categoryNameGetter(category)}`;
        };
    }

}

export class ValueViewMode<T> implements ViewMode {

    private colorConfig: ColorConfigProvider;

    constructor(private key2Entity: Map<string, T>, private entity2Value: (entity: T) => number, private nameGetter: (entity: T) => string, private valueName: string, private icon: string) {
        const key2Value = new Map<string, number>();
        for (const [key, entity] of key2Entity) {
            key2Value.set(key, entity2Value(entity));
        }
        this.colorConfig = new ValueGradientColorConfig(key2Value);
    }

    getIcon() {
        return this.icon;
    }

    getColorConfig(): ColorConfigProvider {
        return this.colorConfig;
    }

    getTooltip(): (key: string) => string {
        return (key: string) => {
            const entity = this.key2Entity.get(key);
            if (!entity) {
                return '';
            }
            const value = this.entity2Value(entity);
            let valueStr: string;
            if (typeof value === 'number') {
                valueStr = Number.isInteger(value) ? value.toString() : value.toFixed(2);
            } else {
                valueStr = value;
            }
            let tooltip = `<strong>${this.nameGetter(entity)}</strong><br>`;
            tooltip += `${valueStr} ${this.valueName}`;
            return tooltip;
        }
    }
}