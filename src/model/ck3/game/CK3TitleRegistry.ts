import { RGB } from "../../../util/RGB";

export interface CK3TitleRegistry {
    getCountyBaronies(countyName: string): string[];
    getBaronyProvinceIndex(barony: string): number;
    getBaronyKeyFromProvinceIndex(provinceIndex: number): string;
    getVanillaTitleColor(titleKey: string): RGB;
    getAllCountyTitleKeys(): string[];
    getDeJureLiegeTitle(titleKey: string): string | null;
}