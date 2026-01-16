import { inject, Injectable } from "@angular/core";
import { ViewMode } from "../../app/slab-map-view/ViewMode";
import { ValueGradientColorConfig } from "../../app/viewers/polygon-select/ValueGradientColorConfig";
import { TableColumn } from "../../util/table/TableColumn";
import { Vic3Save } from "../../model/vic/Vic3Save";
import { StateRegion } from "../../model/vic/StateRegion";
import { Vic3GameFilesService } from "../../model/vic/Vic3GameFilesService";
import { map } from "rxjs";

@Injectable({
    providedIn: 'root',
})
export class Vic3MapViewModeProvider {

    private vic3GameFiles = inject(Vic3GameFilesService);

    getViewModes(save: Vic3Save) {
        return this.vic3GameFiles.getGoods().pipe(
            map(goods => {
                const minerals = goods.filter(g => ["coal", "iron", "sulphur", "lead"].includes(g.key));
                const mineralViews = [];
                for (const mineral of minerals) {
                    const view = this.buildViewMode(save, `${mineral.name} Mine Levels`,
                        (s: StateRegion) => {
                            return s.getBuildings().filter(r => r.getGoodsOut().get(mineral.index) || 0 > 0).reduce((sum, b) => sum + b.getLevels(), 0);
                        },
                        (val: number, key: string) => val
                    );
                    mineralViews.push({ good: mineral, view: view });
                }
                return mineralViews;
            })
        );
    }

    private getMineralDepositUtilizationViewModes(save: Vic3Save) {
        return this.buildViewMode(save, "Coal Deposit Levels",
            (s: StateRegion) => s.getBuildings().filter(b => b.getName().includes("coal")).reduce((sum, b) => sum + b.getLevels(), 0)
        );
    }

    private buildViewMode(save: Vic3Save, label: string, lambda: (s: StateRegion) => number, postprocessor: (val: number, key: string) => number = (val) => val): ViewMode {
        const state2Value = new Map<string, number>();
        save.getCountries(true).flatMap(c => c.getStates()).forEach(s => {
            state2Value.set(s.getName(), lambda(s));
        });
        for (const [key, value] of state2Value) {
            state2Value.set(key, postprocessor(value, key));
        }
        const colorConfig = new ValueGradientColorConfig(state2Value);
        const viewMode: ViewMode = {
            getColorConfig: () => colorConfig,
            getTooltip: () => (key: string) => `<b>${key}</b><br>${label}: ${TableColumn.formatNumber(state2Value.get(key) || 0)}`
        };
        return viewMode;
    }
}