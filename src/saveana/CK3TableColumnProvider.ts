import { Character } from "../model/ck3/Character";
import { CK3 } from "../model/ck3/CK3";
import { SimpleTableColumn } from "../util/table/SimpleTableColumn";
import { TableColumn } from "../util/table/TableColumn";
import { TableColumnBuilder } from "../util/table/TableColumnBuilder";

export class CK3TableColumnProvider {

    rootUrl = "https://codingafterdark.de/ck3/gfx/interface/icons";

    getCharacterColumns() {
        const map = new Map<string, TableColumn<Character>[]>();
        map.set("Basic", [
            new SimpleTableColumn<Character>("char_name", "Character", char => char.getName()),
                new SimpleTableColumn<Character>("faith", "Faith", char => char.getFaith() ? char.getFaith()!.getName() : null, null, false, this.rootUrl + "/faith/catholic.webp"),
                new SimpleTableColumn<Character>("culture", "Culture",
                    char => char.getCulture() ? char.getCulture()!.getName() : null, null, false, this.rootUrl + "/message_feed/culture.webp"),
                    new TableColumnBuilder<Character>("Tech")
                        .withCellValue((char: Character) => char.getCulture() ? char.getCulture()!.getResearchedInnovationNames().length : 0)
                        .withCellTooltip((char: Character) => char.getCulture() ? char.getCulture()!.getResearchedInnovationNames().map((n: string) => n.replace("innovation_", "")).join("\n") : "")
                        .build(),
                new SimpleTableColumn<Character>("age", "Age",
                    char => char.getAge()),
                new TableColumn<Character>(
                    "health",
                    "Health",
                    null,
                    true,
                    (char: Character) => getHealthIconURL(char.getAliveValue("health", 0)),
                    () => null,
                    null,
                    true
                ),
                new SimpleTableColumn<Character>("prestige", "Prestige",
                    char => Math.floor(char.getPrestige().getCurrent()), null, false, this.rootUrl + "/currencies/icon_prestige_05.webp"),
                new SimpleTableColumn<Character>("piety", "Piety",
                    char => Math.floor(char.getPiety().getCurrent()), null, false, this.rootUrl + "/currencies/icon_piety_christian_05.webp"),
            
        ]);
        map.set("Realm", [
                new TableColumn<Character>(
                    "rank",
                    "Rank",
                    null,
                    true,
                    (char: Character) => char.getHighestTitle()?.getTier().getImageUrl(),
                    (char: Character) => char.getHighestTitle()?.getTier().getStateTitle() + " of " + (char.getHighestTitle() ? char.getHighestTitle()!.getLocalisedName() : "No Title"),
                    null,
                    true
                ),
                new SimpleTableColumn<Character>("gold", "Gold",
                    char => char.getCash(), null, false, this.rootUrl + "/icon_gold.webp"),
                new SimpleTableColumn<Character>("income", "Income",
                    char => char.getIncome(), null, false),
                new TableColumn<Character>(
                    "domain",
                    "Domain",
                    null,
                    false,
                    (char: Character) => char.getDomainBaronies().length,
                    (char: Character) => char.getDomainBaronies().map(barony => barony.getTier().getStateTitle() + " of " + barony.getLocalisedName()).join("\n"),
                    null,
                    false,
                    this.rootUrl + "/icon_domain.webp"
                ),
                new TableColumnBuilder<Character>("Titles")
                    .withCellValue((char: Character) => char.getTitles().length)
                    .withCellTooltip((char: Character) => char.getTitles().map(title => title.getTier().getStateTitle() + " of " + title.getLocalisedName()).join("\n"))
                    .build(),
                //new SimpleTableColumn<Character>("vassals", "Vassals",
                //    char => char.getVassals().length, null, false, this.rootUrl + "/icon_vassal.webp"),
                new TableColumnBuilder<Character>("Troops")
                    .withCellValue((char: Character) => char.getLevies() + char.getNonLevyTroops() + char.getKnights().length)
                    .withCellTooltip((char: Character) => `Levies: ${char.getLevies()}\nMAA: ${char.getNonLevyTroops()}\nKnights: ${char.getKnights().length}`)
                    .build(),
                new SimpleTableColumn<Character>("army", "Levies", char => char.getLevies(), null, false, this.rootUrl + "/icon_soldier.webp"),
                new SimpleTableColumn<Character>("maa", "MAA", char => char.getNonLevyTroops(), null, false),
                new SimpleTableColumn<Character>("knights", "Knights",
                    char => char.getKnights().length, null, false, this.rootUrl + "/icon_knight.webp"),
        ]);
        map.set("Fun Facts", [
            new TableColumn<Character>(
                    "traits",
                    "Traits",
                    null,
                    false,
                    (char: Character) => char.getTraits().length,
                    (char: Character) => char.getTraits().map(trait => trait.getName()).join("<br>"),
                    null,
                    false
                ),
                new TableColumn<Character>(
                    "perks",
                    "Perks",
                    null,
                    false,
                    (char: Character) => char.getPerks().length,
                    (char: Character) => char.getPerks().map((perk: string) => perk).join("<br>"),
                    null,
                    false
                ),
                new SimpleTableColumn<Character>("kills", "Kills",
                    char => char.getAliveValue("kills", []).length, null, false, this.rootUrl + "/icon_kill.webp"),
                new SimpleTableColumn<Character>("sights_seen", "Sights Seen",
                    char => char.getVisistedPointsOfInterest().length),
                new SimpleTableColumn<Character>("dynasty", "Dynasty",
                    char => char.getDynastyHouse() ? char.getDynastyHouse()!.getName() : null, null, false),
                new SimpleTableColumn<Character>("dynasty_members", "Dynasty Members",
                    char => char.getDynastyHouse() ? char.getDynastyHouse()!.getHouseMembers().length : 0)
        ]);
        return map;
    }
}


function getHealthIconURL(health: number) {
        const get = (i: number) => CK3.CK3_DATA_URL + "/gfx/interface/icons/character_status/icon_health_slice_" + i + ".webp";
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
