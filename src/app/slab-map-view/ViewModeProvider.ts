import { Injectable } from "@angular/core";
import { CategoryViewMode, ValueViewMode, ViewMode } from "./ViewMode";
import { County } from "../../model/ck3/County";
import { ICk3Save } from "../../model/ck3/save/ICk3Save";
import { Eu4Save } from '../../model/eu4/Eu4Save';
import { ColorConfigProvider } from '../viewers/polygon-select/ColorConfigProvider';
import { RGB } from '../../util/RGB';
import { AbstractLandedTitle } from "../../model/ck3/title/AbstractLandedTitle";
import { ValueGradientColorConfig } from "../viewers/polygon-select/ValueGradientColorConfig";

@Injectable({
    providedIn: 'root'
})
export class ViewModeProvider {

    public buildViewModesForCk3(save: ICk3Save): ViewMode<any>[] {
        return [
            this.buildCategoryViewMode(save),
            this.build(save, (entity: County) => entity.getDevelopment(), "Development", "bar_chart"),
            this.buildIncomeView(save),
        ];
    }

    private buildCategoryViewMode(save: ICk3Save) {
        const key2Entity = new Map<string, AbstractLandedTitle>();
        save.getCounties().forEach(county => {
            const title = save.getTitle(county.getKey());
            key2Entity.set(county.getKey(), title);
        });
        const entity2Category = (entity: AbstractLandedTitle) => {
            const ultiLiege = entity.getUltimateLiegeTitle();
            const holder = ultiLiege.getHolder();
            if (holder) {
                const highestHolderTitle = holder.getHighestTitle()!;
                const isPlayer = holder != null && save.isPlayerCharacter(holder);
                return { title: highestHolderTitle, isPlayer: isPlayer };
            }
            return { title: ultiLiege, isPlayer: false };
        };
        const category2Color = (category: { title: AbstractLandedTitle, isPlayer: boolean }) => {
            const baseColor = category.title.getColor();
            if (category.isPlayer) {
                return baseColor;
            }
            return baseColor.adjustBrightness(0.4);
        };
        const cat2Name = (cat: { title: AbstractLandedTitle, isPlayer: boolean }) => {
            return cat.title.getLocalisedName() + (cat.isPlayer ? " (Player)" : "");
        }
        return new CategoryViewMode<AbstractLandedTitle, { title: AbstractLandedTitle, isPlayer: boolean }>(key2Entity, entity2Category, category2Color, (entity: AbstractLandedTitle) => entity.getLocalisedName(), cat2Name, "Liege", "account_tree");
    }

    private build(save: ICk3Save, entity2Value: (entity: County) => number, valueName: string, icon: string): ViewMode<any> {
        const key2Entity = this.getProvinceId2Province(save);
        return new ValueViewMode<County>(key2Entity, entity2Value, (entity: County) => (save as ICk3Save).getTitle(entity.getKey())!.getLocalisedName(), valueName, icon);
    }

    private getProvinceId2Province(save: ICk3Save) {
        const key2Entity = new Map<string, County>();
        save.getCounties().forEach(county => {
            key2Entity.set(county.getKey(), county);
        });
        return key2Entity;
    }

    private buildIncomeView(save: ICk3Save): ViewMode<any> {
        const key2Entity = new Map<string, County>();
        save.getCounties().forEach(county => {
            key2Entity.set(county.getKey(), county);
        });
        const entity2Value = (entity: County) => entity.getHoldings().reduce((sum, holding) => sum + holding[1].getIncome(), 0);
        const key2Value = new Map<string, number>();
        save.getCounties().forEach(county => {
            key2Value.set(county.getKey(), entity2Value(county));
        });
        const colorConfig = new ValueGradientColorConfig(key2Value);
        return new class implements ViewMode<any> {

            getColorConfig(): ColorConfigProvider {
                return colorConfig;
            }
            getTooltip(): (key: string) => string {
                return (key: string) => {
                    const entity = key2Entity.get(key)!;
                    const val = entity2Value(entity).toFixed(2);
                    const s = entity.getHoldings().map(holdingAndTitle => {
                        const baronyTitleKey = holdingAndTitle[0];
                        const holding = holdingAndTitle[1];
                        const holdingIncome = holding.getIncome().toFixed(2);
                        const baronyName = save.getTitle(baronyTitleKey)?.getLocalisedName() ?? baronyTitleKey;
                        return "<strong>" + holdingIncome + "</strong> " + baronyName;
                    }).reduce((prev, curr) => prev + `<br>${curr}`, '');
                    return `<strong>${save.getTitle(entity.getKey())!.getLocalisedName()}</strong><br><br><strong>${val}</strong><br><small><i>${s}</i></small>`;
                };
            }

        }
    }

    public buildViewModeForEu4(eu4Save: Eu4Save): ViewMode<any> {
        const key2province = new Map<string, any>();
        const key2color = new Map<string, number>();
        eu4Save.getProvinces().forEach(prov => {
            key2province.set(prov.getId(), prov);
            if (prov.getOwner() != null) {
                const color = prov.getOwner()!.getColor();
                key2color.set(prov.getId(), new RGB(color[0], color[1], color[2]).toNumber());
            }
        });
        return new class implements ViewMode<any> {
            getColorConfig(): ColorConfigProvider {
                return new ColorConfigProvider(key2color, false);
            }
            getTooltip(): (key: string) => string {
                return (key: string) => {
                    const province = key2province.get(key);
                    if (!province) return '';
                    const owner = province.getOwner();
                    let tooltip = `<strong>${province.getName()}</strong><br>`;
                    if (owner) {
                        tooltip += `Owner: ${owner.getTag()}`;
                    } else {
                        tooltip += `Unowned`;
                    }
                    return tooltip;
                };
            }
        };
    }
}