import { Eu4Save } from "../model/eu4/Eu4Save";

export interface IHasKey {
    getKey(): string;
}

class HasKey implements IHasKey {
    private key: string;
    constructor(key: string) {
        this.key = key;
    }
    getKey(): string {
        return this.key;
    }
}

interface IValueMapMode {
    iconUrl: string;
    tooltip: string;
    valueGetter: (county: IHasKey) => number;
}

interface ICategoryMapMode {
    iconUrl: string;
    tooltip: string;
    valueGetter: (county: IHasKey) => string;
    colorGetter: (county: IHasKey) => string;
}

export class MapDataProvider {

    constructor(private activeSave: Eu4Save | null) {

    }

    setActiveSave(save: Eu4Save) {
        this.activeSave = save;
    }

    getAvailableValueModes(): IValueMapMode[] {
        return [
            {
                iconUrl: "https://codingafterdark.de/ck3/gfx/interface/icons/development.webp",
                tooltip: "Province Development",
                valueGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getDevelopment().reduce((a, b) => a + b, 0)
            },

            {
                iconUrl: "https://codingafterdark.de/mc/ideas/icon_powers_administrative.webp",
                tooltip: "Province Base Tax Development",
                valueGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getDevelopment()[0]
            },
            {
                iconUrl: "https://codingafterdark.de/mc/ideas/icon_powers_diplomatic.webp",
                tooltip: "Province Base Production Development",
                valueGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getDevelopment()[1]
            },
            {
                iconUrl: "https://codingafterdark.de/mc/ideas/icon_powers_military.webp",
                tooltip: "Province Base Manpower Development",
                valueGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getDevelopment()[2]
            },

            {
                iconUrl: "https://codingafterdark.de/ck3/gfx/interface/icons/message_feed/building.webp",
                tooltip: "Province Buildings",
                valueGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getBuildings().length
            },
            {
                iconUrl: 'https://codingafterdark.de/ck3/gfx/interface/icons/icon_gold.webp',
                tooltip: 'Total Trade Power',
                valueGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getTradePower()
            }
        ];
    }

    getAvailableCategoryModes(): ICategoryMapMode[] {
        return [
            {
                iconUrl: 'https://codingafterdark.de/ck3/gfx/interface/icons/message_feed/banner.webp',
                tooltip: 'Province Owner',
                valueGetter: (arg: IHasKey) => {
                    const ownerCountry = this.activeSave!.getProvinces().get(arg.getKey())!.getOwner();
                    return ownerCountry ? ownerCountry.getTag() : "none";
                },
                colorGetter: (arg: IHasKey) => {
                    const ownerCountry = this.activeSave!.getProvinces().get(arg.getKey())!.getOwner();
                    return ownerCountry ? ("rgb(" + ownerCountry.getColor().map((color) => color.toString()).join(',') + ")") : 'none';
                }
            }
        ]
    }

    private getProvincesHasBuildingModes(): ICategoryMapMode[] {
        if (!this.activeSave) {
            throw new Error('No active save found');
        }
        const buildingTypes = new Set<string>();
        const provinces = this.activeSave.getProvinces().forEach((province) => {
            province.getBuildings().forEach((building) => {
                buildingTypes.add(building);
            });
        });
        /*
        return Array.from(buildingTypes).map((building) => {
            return {
                iconUrl: `https://codingafterdark.de/ck3/gfx/interface/icons/message_feed/building.webp`,
                tooltip: building,
                valueGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getBuildings().includes(building) ? building : "none",
                colorGetter: (arg: IHasKey) => this.activeSave!.getProvinces().get(arg.getKey())!.getBuildings().includes(building) ? "lightgreen" : "darkgrey",
            }
        });*/
        return [];
    }

    getName(element: IHasKey): string {
        if (this.activeSave) {
            return this.activeSave.getProvinces().get(element.getKey())!.getName();
        }
        throw new Error('No active save found');
    }

    getAllElements(): IHasKey[] {
        if (this.activeSave) {
            return Array.from(this.activeSave.getProvinces().keys()).map((key) => {
                return new HasKey(key);
            });
        }
        throw new Error('No active save found');
    }
}