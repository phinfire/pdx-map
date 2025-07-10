import JSZip from "jszip";
import { Jomini } from "jomini";
import { Trait } from "./Trait";
import { Skill } from "./enum/Skill";
import { RGB } from "../../util/RGB";
export class CK3 {

    public static SKILLS_IN_ORDER = [Skill.DIPLOMACY, Skill.MARTIAL, Skill.STEWARDSHIP, Skill.INTRIGUE, Skill.LEARNING, Skill.PROWESS];
    public static readonly CK3_DATA_URL = "https://codingafterdark.de/ck3/";

    private traits: Map<string, Trait> = new Map<string, Trait>();
    private localisation: Map<string, string> = new Map<string, string>();
    private county2Baronies: Map<string, string[]> = new Map<string, string[]>();
    private barony2provinceIndices: Map<string, number> = new Map<string, number>();
    private titleKey2Color: Map<string, RGB> = new Map<string, RGB>();

    private scriptedBuildingValues: any;

    private buildingKey2Data: Map<string, any> = new Map<string, any>();

    constructor() {
        this.fetchAndInsertLocalisationMapping("traits_l_english.yml");
        this.fetchAndInsertLocalisationMapping("titles_l_english.yml");
        const urls = [
            "common/traits/00_traits.txt",
            "common/landed_titles/00_landed_titles.txt",
            "common/scripted_values/00_building_values.txt"
        ].map(file => CK3.CK3_DATA_URL + "/" + file);

        Promise.all(urls.map(url => fetch(url).then(response => response.text()))).then(datas => {
            Jomini.initialize().then((parser) => {
                const parsed = parser.parseText(datas[0]);
                let i = 0;
                for (let key of Object.keys(parsed)) {
                    if (!key.startsWith("@")) {
                        this.traits.set(key, new Trait(key, parsed[key], i));
                        i++;
                    }
                }
                const parsedlandedTitles = parser.parseText(datas[1]);
                for (let key of Object.keys(parsedlandedTitles)) {
                    this.recursivelyInsertBaronyIndices(parsedlandedTitles[key], key);
                }
                this.scriptedBuildingValues = parser.parseText(datas[2]);
            });
        });
        fetch(CK3.CK3_DATA_URL + "common/buildings.zip").then(response => response.blob())
            .then((blob) => {
                const zip = new JSZip();
                return zip.loadAsync(blob).then((zip: any) => {
                    const promises = Object.keys(zip.files).map((filename) => {
                        Jomini.initialize().then((parser) => {
                            return zip.file(filename).async("string").then((data: string) => {
                                const parsedBuildingFile = parser.parseText(data);
                                for (let key of Object.keys(parsedBuildingFile)) {
                                    if (!key.startsWith("@")) {
                                        this.buildingKey2Data.set(key, parsedBuildingFile[key]);
                                    }
                                }
                            });
                        });
                    });
                    Promise.all(promises);
                });
            });
        /*
        fetch(CK3.CK3_DATA_URL + "map_data/definition.csv").then(response => response.text()).then((data) => {
            data.split("\n").filter(line => line.trim().length != 0).forEach(line => {
                const parts = line.split(";");
                const id = Number.parseInt(parts[0]);
                const r = Number.parseInt(parts[1]);
                const g = Number.parseInt(parts[2]);
                const b = Number.parseInt(parts[3]);
                
            });
            */
    }

    private recursivelyInsertBaronyIndices(parsed: any, previousKey: string) {
        const okKeys = Object.keys(parsed).filter(key => ["e","k","d","c","b"].some(prefix => key.startsWith(prefix + "_")));
        if (parsed.color) {
            if (parsed.color.hsv) {
                const hsv = parsed.color.hsv;
                this.titleKey2Color.set(previousKey, RGB.fromHSV(hsv[0], hsv[1], hsv[2]));
            } else {
                this.titleKey2Color.set(previousKey, new RGB(parsed.color[0], parsed.color[1], parsed.color[2]));
            }
        }

        for (let key of okKeys) {
            if (key.startsWith("b_")) {
                const baronyData = parsed[key];
                const baronyName = key;
                if (!this.county2Baronies.has(previousKey)) {
                    this.county2Baronies.set(previousKey, []);
                }
                this.county2Baronies.get(previousKey)!.push(baronyName);
                this.barony2provinceIndices.set(baronyName, baronyData.province);
            } else {
                this.recursivelyInsertBaronyIndices(parsed[key], key);
            }
        }
    }

    private fetchAndInsertLocalisationMapping(fileName: string) {
        fetch(CK3.CK3_DATA_URL + "localisation/english/" + fileName.substring(0, fileName.indexOf("."))  + ".zip")
            .then(response => {
                return response.blob();
            }).then((blob) => {
                const zip = new JSZip();
                return zip.loadAsync(blob).then((zip: any) => {
                    return zip.file(fileName)!.async("string");
                });
            }).then((data: string) => {
                data.split("\n").map(line => line.trim()).filter(line => line.indexOf(":") != -1 && !line.startsWith("#")).forEach(line => {
                    const parts = line.split(":");
                    this.localisation.set(parts[0].trim(), parts[1].substring(3, parts[1].length - 1));
                });
            });
    }

    public getTraitByIndex(index: number) {
        return Array.from(this.traits.values()).filter(trait => trait.getIndex() == index)[0];
    }

    public getTraitByName(name: string) {
        if (this.traits.has(name)) {
            return this.traits.get(name)!;
        }
        throw new Error("Trait not found: " + name);
    }
    
    public hasLocalisation(trait: string) {
        return this.localisation.has(trait);
    }

    public localise(trait: string) {
        return this.localisation.get(trait)!
    }
    
    public getCountyBaronies(countyName: string) {
        return this.county2Baronies.get(countyName);
    }

    public getBaronyProvinceIndex(barony: string) {
        return this.barony2provinceIndices.get(barony);
    }

    public getBaronyKeyFromProvinceIndex(provinceIndex: number) {
        return Array.from(this.barony2provinceIndices.keys()).filter(key => this.barony2provinceIndices.get(key) == provinceIndex)[0];
    }

    public getVanillaTitleColor(titleKey: string) {
        if (!this.titleKey2Color.has(titleKey)) {
            throw new Error("No color found for title " + titleKey);
        }
        return this.titleKey2Color.get(titleKey);
    }

    hasBuildingData(key: string) {
        return this.buildingKey2Data.has(key);
    }

    getBuildingData(key: string) {
        return new Building(key, this.buildingKey2Data.get(key), this);
    }
}