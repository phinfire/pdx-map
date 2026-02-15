import { Region } from "./Region";

export class RegionConfig {
    constructor(public readonly regions: Region[],
        public readonly topLevelKeysToInclude: string[]) { }
}