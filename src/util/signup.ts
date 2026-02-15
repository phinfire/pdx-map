import { SignupAssetsService } from "../app/mc/SignupAssetsService";
import { ColorConfigProvider } from "../app/viewers/polygon-select/ColorConfigProvider";
import { Ck3Save } from "../model/ck3/Ck3Save";
import { CK3 } from "../model/ck3/game/CK3";
import { RulerTier } from "../model/ck3/RulerTier";
import { AbstractLandedTitle } from "../model/ck3/title/AbstractLandedTitle";
import { Region } from "../model/megacampaign/Region";
import { RegionConfig } from "../model/megacampaign/RegionConfig";

export function findCountiesOwnedByAtMostDoubleCounts(save: Ck3Save, k: number): string[][] {
    const holder2CountyTitles = new Map<string, string[]>();
    const holder2PrimaryTitle = new Map<string, string>();
    for (const title of save.getLandedTitles()) {
        if (!title.getKey().startsWith("c_")) {
            continue;
        }
        const holder = title.getHolder();
        if (holder == null) {
            console.warn(`Title ${title.getKey()} has no holder`);
            continue;
        }
        if (holder.getCharacterTier() == RulerTier.COUNT) {
            if (!holder2PrimaryTitle.has(holder.getCharacterId())) {
                holder2PrimaryTitle.set(holder.getCharacterId(), holder.getPrimaryTitle()!.getKey());
            }
            if (!holder2CountyTitles.has(holder.getCharacterId())) {
                holder2CountyTitles.set(holder.getCharacterId(), []);
            }
            if (title.getKey() == holder2PrimaryTitle.get(holder.getCharacterId())) {
                holder2CountyTitles.get(holder.getCharacterId())!.unshift(title.getKey());
            } else {
                holder2CountyTitles.get(holder.getCharacterId())!.push(title.getKey());
            }
        }
    }
    return Array.from(holder2CountyTitles.values()).filter(titles => titles.length <= k).sort((a, b) => a.length - b.length);
}

export function collectAllChildren(ck3Save: Ck3Save, topLevelKeys: string[]): Set<string> {
    const allChildren = new Set<string>();
    ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
        getPathToTheTop(title.getKey(), ck3Save.getCK3()).forEach(key => {
            if (topLevelKeys.includes(key)) {
                allChildren.add(title.getKey());
                return;
            }
        });
    });
    return allChildren;
}

export function buildKey2Cluster(ck3: CK3, ck3Save: Ck3Save, regions: Region[], key2Exclude: Set<string>) {
    const key2ClusterKey = new Map<string, string>();
    ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
        if (key2Exclude.has(title.getKey())) {
            return;
        }
        let matchedRegionNames = [];
        const pathToTheTop = getPathToTheTop(title.getKey(), ck3);
        for (const region of regions) {
            for (const key of pathToTheTop) {
                if (region.plusElements.has(key) || region.baseElements.has(key)) {
                    matchedRegionNames.push(region.name);
                }
                if (region.minusElements.has(key)) {
                    break;
                }
            }
        }
        if (matchedRegionNames.length == 0) {
            console.error(`Title\n${getPathToTheTop(title.getKey(), ck3).join(" -> ")} \ndoes not belong to any region`);
        } else if (matchedRegionNames.length > 1) {
            console.error(`Title\n${getPathToTheTop(title.getKey(), ck3).join(" -> ")} \nbelongs to multiple regions: ${matchedRegionNames.join(", ")}`);
        } else {
            key2ClusterKey.set(title.getKey(), matchedRegionNames[0]);
        }
    });
    return key2ClusterKey;
}

export function getPathToTheTop(titleKey: string, ck3: CK3) {
    const path = [];
    let currentKey: string | null | undefined = titleKey;
    while (currentKey) {
        path.push(currentKey);
        currentKey = ck3.getDeJureLiegeTitle(currentKey);
    }
    return path;
}

export function parseRegionConfig(fileContent: string) {
    const keysToExclude = [];
    const regions: Region[] = [];
    const cleanLines = Array.from(fileContent.split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0 && !line.startsWith("#")));
    for (const line of cleanLines) {
        if (line.startsWith("!")) {
            keysToExclude.push(line.substring(1).trim());
            continue;
        }
        const parts = line.split("=");
        if (parts.length != 2) {
            console.warn(`Invalid line in region config: ${line}`);
            return { regions: [], topLevelKeysToInclude: [] };
        }
        const regionName = parts[0].trim();
        const formula = parts[1].trim();
        const plusElements = new Set<string>();
        const minusElements = new Set<string>();
        const baseElements = new Set<string>();
        let currentOp: '+' | '~' = '+';
        const tokens = formula.match(/([+~])|([a-zA-Z0-9_-]+)/g) || [];
        tokens.forEach((token, idx) => {
            if (token === '+' || token === '~') {
                currentOp = token as '+' | '~';
            } else {
                if (idx === 0) {
                    baseElements.add(token);
                } else if (currentOp === '+') {
                    plusElements.add(token);
                } else if (currentOp === '~') {
                    minusElements.add(token);
                }
            }
        });
        regions.push(new Region(regionName, plusElements, minusElements, baseElements));
    }
    return new RegionConfig(regions, keysToExclude);
}

export function buildColorConfigProvider(ck3Save: Ck3Save, ck3: CK3) {
    const key2color = new Map<string, number>();
    ck3Save.getLandedTitles().filter((title: AbstractLandedTitle) => title.getKey().startsWith("c_")).forEach((title: AbstractLandedTitle) => {
        let liegeTitleKey = ck3.getDeJureLiegeTitle(title.getKey())!
        liegeTitleKey = ck3.getDeJureLiegeTitle(liegeTitleKey)!;
        const deFactoTopLiege = title.getUltimateLiegeTitle();
        key2color.set(title.getKey(), deFactoTopLiege.getColor().toNumber());
    });
    return new ColorConfigProvider(key2color);    
}