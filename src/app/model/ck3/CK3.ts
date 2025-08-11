import JSZip from "jszip";
import { Jomini } from "jomini";
import { Trait } from "./Trait";
import { Skill } from "./enum/Skill";
import { RGB } from "../../util/RGB";
import { I } from "@angular/cdk/keycodes";
import { Building } from "./Building";
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

    constructor(localisation: Map<string, string>, traits: Trait[],
        county2Baronies: Map<string, string[]>,
        barony2provinceIndices: Map<string, number>,
        titleKey2Color: Map<string, RGB>) {
        this.localisation = localisation;
        this.traits = new Map<string, Trait>();
        traits.forEach(trait => {
            this.traits.set(trait.getName(), trait);
        });
        this.county2Baronies = county2Baronies;
        this.barony2provinceIndices = barony2provinceIndices;
        this.titleKey2Color = titleKey2Color;
    }
    
    static recursivelyInsertBaronyIndices(parsed: any, previousKey: string,
        titleKey2Color: Map<string, RGB>,
        county2Baronies: Map<string, string[]>,
        barony2provinceIndices: Map<string, number>
    ) {
        if (parsed.color) {
            if (parsed.color.hsv) {
                const hsv = parsed.color.hsv;
                titleKey2Color.set(previousKey, RGB.fromHSV(hsv[0], hsv[1], hsv[2]));
            } else {
                titleKey2Color.set(previousKey, new RGB(parsed.color[0], parsed.color[1], parsed.color[2]));
            }
        }

        const okKeys = Object.keys(parsed).filter(key => ["e", "k", "d", "c", "b"].some(prefix => key.startsWith(prefix + "_")));
        for (let key of okKeys) {
            if (key.startsWith("b_")) {
                const baronyData = parsed[key];
                const baronyName = key;
                if (!county2Baronies.has(previousKey)) {
                    county2Baronies.set(previousKey, []);
                }
                county2Baronies.get(previousKey)!.push(baronyName);
                barony2provinceIndices.set(baronyName, baronyData.province);
            } else {
                this.recursivelyInsertBaronyIndices(parsed[key], key, titleKey2Color, county2Baronies, barony2provinceIndices);
            }
        }
    }

    static fetchAndInsertLocalisationMapping(fileName: string) {
        return fetch(CK3.CK3_DATA_URL + "localisation/english/" + fileName.substring(0, fileName.indexOf(".")) + ".zip")
            .then(response => {
                return response.blob();
            }).then((blob) => {
                const zip = new JSZip();
                return zip.loadAsync(blob).then((zip: any) => {
                    return zip.file(fileName)!.async("string");
                });
            }).then((data: string) => {
                const locMap = new Map<string, string>();
                data.split("\n").map(line => line.trim()).filter(line => line.indexOf(":") != -1 && !line.startsWith("#")).forEach(line => {
                    const parts = line.split(":");
                    locMap.set(parts[0].trim(), parts[1].substring(3, parts[1].length - 1));
                });
                return locMap;
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