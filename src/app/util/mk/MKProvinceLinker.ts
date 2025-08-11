import { LandedTitle } from "../../model/ck3/title/LandedTitle";
import { OwnershipChange } from "../../model/common/OwnershipChange";
import { Eu4SaveProvince } from "../../model/eu4/Eu4Save";

export class MKProvinceLinker {

    private readonly CK3_TO_EU4_URL = "https://github.com/ParadoxGameConverters/EU4ToVic3/raw/refs/heads/master/EU4ToVic3/Data_Files/configurables/et_province_mappings.txt";
    private readonly EU4_TO_VIC3_URL = "https://github.com/ParadoxGameConverters/EU4ToVic3/raw/refs/heads/master/EU4ToVic3/Data_Files/configurables/et_province_mappings.txt";

    private ck3Provinces2eu4Provinces: Map<string[], string[]> = new Map<string[], string[]>(); 

    constructor() {
        
    }

    getCombinedProvinceOwnershipChanges<T>(inCk3: OwnershipChange<LandedTitle,T>[], eu4Changes: OwnershipChange<Eu4SaveProvince,T>[]) {

    }
    
}