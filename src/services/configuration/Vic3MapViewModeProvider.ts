import { inject, Injectable } from "@angular/core";
import { ViewMode } from "../../app/slab-map-view/ViewMode";
import { ValueGradientColorConfig } from "../../app/viewers/polygon-select/ValueGradientColorConfig";
import { TableColumn } from "../../util/table/TableColumn";
import { Vic3Save } from "../../model/vic/Vic3Save";
import { StateRegion } from "../../model/vic/StateRegion";
import { Vic3GameFilesService } from "../../model/vic/Vic3GameFilesService";
import { map } from "rxjs";
import { LabeledAndIconed } from "../../ui/LabeledAndIconed";

@Injectable({
    providedIn: 'root',
})
export class Vic3MapViewModeProvider {

    private vic3GameFiles = inject(Vic3GameFilesService);

    getViewModes(save: Vic3Save) {
        return this.vic3GameFiles.getGoods().pipe(
            map(goods => {
                const minerals = goods;
                const mineralViews = [];
                for (const mineral of minerals) {
                    const view = this.buildViewMode(save, `${mineral.name} Produced`,
                        (s: StateRegion) => {
                            return s.getBuildings().filter(b => {
                                const goodsOut = b.getGoodsOut();
                                return goodsOut.has(mineral.index) && (goodsOut.get(mineral.index) || 0) > 0;
                            }).map(b => {
                                return b.getGoodsOut().get(mineral.index) || 0;
                            }).reduce((sum, qty) => sum + qty, 0);
                        },
                        (val: number, key: string) => val
                    );
                    if (view) {
                        mineralViews.push({ good: mineral, view: view });
                    }
                }
                return mineralViews;
            })
        );
    }

    getInterestingViewModes(save: Vic3Save) {
        const viewConfigs = [
            {
                label: "Value Added per Employee",
                icon: "money_bag",
                viewBuilder: (s: StateRegion) => {
                    return s.getBuildings().map(b => b.getNetValueAdded()).reduce((sum, va) => sum + va, 0) / s.getPopulationStatBlock().salariedWorkforce;
                },
                postProcessor: (v: number) => v,
                unit: "£"
            },
            {
                label: "Goods Produced per Employee",
                icon: "package",
                viewBuilder: (s: StateRegion) => {
                    return s.getBuildings().map(b => Array.from(b.getGoodsOut().values()).reduce((sum, qty) => sum + qty, 0)).reduce((sum, g) => sum + g, 0) / s.getPopulationStatBlock().salariedWorkforce;
                },
                postProcessor: (v: number) => v,
                unit: "Units"
            },
            {
                label: "Population",
                icon: "people",
                viewBuilder: (s: StateRegion) => {
                    return s.getPopulationStatBlock().getTotalPopulation();
                },
                postProcessor: (v: number) => v,
                unit: ""
            },
            {
                label: "Avg. Wealth",
                icon: "payments",
                viewBuilder: (s: StateRegion) => s.getPopulationStatBlock().totalWealth / s.getPopulationStatBlock().getTotalPopulation(),
                postProcessor: (v: number) => v,
                unit: "£"
            },
            {
                label: "Loyalists Percentage",
                icon: "thumb_up",
                viewBuilder: (s: StateRegion) => {
                    const totalPopulation = s.getPopulationStatBlock().getTotalPopulation();
                    const loyalists = s.getPopulationStatBlock().loyalists;
                    return (loyalists / totalPopulation) * 100;
                },
                postProcessor: (v: number) => v,
                unit: "%"
            },
            {
                label: "Radicals Percentage",
                icon: "thumb_down",
                viewBuilder: (s: StateRegion) => {
                    const totalPopulation = s.getPopulationStatBlock().getTotalPopulation();
                    const radicals = s.getPopulationStatBlock().radicals;
                    return (radicals / totalPopulation) * 100;
                },
                postProcessor: (v: number) => v,
                unit: "%"
            }
        ];

        return viewConfigs
            .map(config => ({
                ...config,
                view: this.buildViewMode(save, config.label, config.viewBuilder, config.postProcessor, config.unit)
            }))
            .filter(config => config.view !== null)
            .map(config => new LabeledAndIconed<ViewMode>(
                "MISC",
                config.label,
                config.icon,
                config.view!
            ));
    }

    private getMineralDepositUtilizationViewModes(save: Vic3Save) {
        return this.buildViewMode(save, "Coal Deposit Levels",
            (s: StateRegion) => s.getBuildings().filter(b => b.getName().includes("coal")).reduce((sum, b) => sum + b.getLevels(), 0)
        );
    }

    private buildViewMode(save: Vic3Save, label: string, lambda: (s: StateRegion) => number, postprocessor: (val: number, key: string) => number = (val) => val, unitName: string = "") {
        const state2Value = new Map<string, number>();
        save.getCountries(true).flatMap(c => c.getStates()).forEach(s => {
            state2Value.set(s.getName(), lambda(s));
        });
        for (const [key, value] of state2Value) {
            state2Value.set(key, postprocessor(value, key));
        }
        if (Array.from(state2Value.values()).every(v => v === 0)) {
            return null;
        }
        const colorConfig = new ValueGradientColorConfig(state2Value);
        const viewMode: ViewMode = {
            getColorConfig: () => colorConfig,
            getTooltip: () => (key: string) => `<b>${key}</b><br>${label}: ${TableColumn.formatNumber(state2Value.get(key) || 0)} ${unitName}`.trim()
        };
        return viewMode;
    }
}