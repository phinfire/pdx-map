import { Injectable } from "@angular/core";
import { Character } from "../../model/ck3/Character";
import { CK3 } from "../../model/ck3/CK3";
import { TableColumn } from "../../util/table/TableColumn";
import { TableColumnBuilder } from "../../util/table/TableColumnBuilder";

@Injectable({
    providedIn: 'root'
})
export class CK3TableColumnProvider {

    rootUrl = "https://codingafterdark.de/ck3/gfx/interface/icons";

    getCharacterColumns() {
        const map = new Map<string, TableColumn<Character>[]>();
        map.set("Basic", [
            new TableColumnBuilder<Character>("Character")
                .withCellValue(char => char.getName())
                .build(),
            new TableColumnBuilder<Character>("Faith")
                .withCellValue(char => char.getFaith() ? char.getFaith()!.getName() : null)
                .withCellValueTransform(value => value || "")
                .build(),
            new TableColumnBuilder<Character>("Culture")
                .withCellValue(char => char.getCulture() ? char.getCulture()!.getName() : null)
                .withCellValueTransform(value => value || "")
                .build(),
            new TableColumnBuilder<Character>("Tech")
                .withCellValue((char: Character) => char.getCulture() ? char.getCulture()!.getResearchedInnovationNames().length : 0)
                .withCellTooltip((char: Character) => char.getCulture() ? char.getCulture()!.getResearchedInnovationNames().map((n: string) => n.replace("innovation_", "")).join("\n") : null)
                .build(),
            new TableColumnBuilder<Character>("Age")
                .withCellValue(char => char.getAge())
                .build(),
            new TableColumnBuilder<Character>("Health")
                .withCellValue((char: Character) => getHealthIconURL(char.getAliveValue("health", 0)))
                .withCellTooltip((char: Character) => `Health: ${char.getAliveValue("health", 0)}`)
                .showCellAsImage()
                .build(),
            new TableColumnBuilder<Character>("Prestige")
                .withCellValue(char => Math.floor(char.getPrestige().getCurrent()))
                .build(),
            new TableColumnBuilder<Character>("Piety")
                .withCellValue(char => Math.floor(char.getPiety().getCurrent()))
                .build(),
        ]);
        map.set("Realm", [
            new TableColumnBuilder<Character>("Rank")
                .withCellValue((char: Character) => char.getHighestTitle()?.getTier().getImageUrl() || "")
                .withCellTooltip((char: Character) => char.getHighestTitle()?.getTier().getStateTitle() + " of " + (char.getHighestTitle() ? char.getHighestTitle()!.getLocalisedName() : "No Title") || null)
                .showCellAsImage()
                .build(),
            new TableColumnBuilder<Character>("Gold")
                .withCellValue(char => char.getCash())
                .build(),
            new TableColumnBuilder<Character>("Income")
                .withCellValue(char => char.getIncome())
                .build(),
            new TableColumnBuilder<Character>("Domain")
                .withCellValue((char: Character) => char.getDomainBaronies().length)
                .withCellTooltip((char: Character) => char.getDomainBaronies().map(barony => barony.getTier().getStateTitle() + " of " + barony.getLocalisedName()).join("\n"))
                .build(),
            new TableColumnBuilder<Character>("Titles")
                .withCellValue((char: Character) => char.getTitles().length)
                .withCellTooltip((char: Character) => char.getTitles().map(title => title.getTier().getStateTitle() + " of " + title.getLocalisedName()).join("\n"))
                .build(),
            new TableColumnBuilder<Character>("Troops")
                .withCellValue((char: Character) => char.getLevies() + char.getNonLevyTroops() + char.getKnights().length)
                .withCellTooltip((char: Character) => `Levies: ${char.getLevies()}\nMAA: ${char.getNonLevyTroops()}\nKnights: ${char.getKnights().length}`)
                .build(),
            new TableColumnBuilder<Character>("Levies")
                .withCellValue(char => char.getLevies())
                .build(),
            new TableColumnBuilder<Character>("MAA")
                .withCellValue(char => char.getNonLevyTroops())
                .build(),
            new TableColumnBuilder<Character>("Knights")
                .withCellValue((char: Character) => char.getKnights().length)
                .build(),
        ]);
        map.set("Fun Facts", [
            new TableColumnBuilder<Character>("Traits")
                .isSortable(false)
                .withCellValue((char: Character) => char.getTraits().length)
                .withCellTooltip((char: Character) => char.getTraits().map(trait => trait.getName()).join("<br>"))
                .build(),
            new TableColumnBuilder<Character>("Perks")
                .isSortable(false)
                .withCellValue((char: Character) => char.getPerks().length)
                .withCellTooltip((char: Character) => char.getPerks().map((perk: string) => perk).join("<br>"))
                .build(),
            new TableColumnBuilder<Character>("Kills")
                .withCellValue(char => char.getAliveValue("kills", []).length)
                .build(),
            new TableColumnBuilder<Character>("Sights Seen")
                .withCellValue(char => char.getVisistedPointsOfInterest().length)
                .build(),
            new TableColumnBuilder<Character>("Dynasty")
                .withCellValue(char => char.getDynastyHouse() ? char.getDynastyHouse()!.getName() : null)
                .build(),
            new TableColumnBuilder<Character>("Dynasty Members")
                .withCellValue(char => char.getDynastyHouse() ? char.getDynastyHouse()!.getHouseMembers().length : 0)
                .build(),
        ]);
        return map;
    }
}


function getHealthIconURL(health: number) {
        const get = (i: number) => CK3.CK3_DATA_URL + "gfx/interface/icons/character_status/icon_health_slice_" + i + ".webp";
        if (health >= 5) {
            return get(0);
        }
        if (health > 3) {
            return get(1);
        }
        if (health > 1) {
            return get(2);
        }
        return get(3);
    }
