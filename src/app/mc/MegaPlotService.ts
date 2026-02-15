import { Injectable, inject } from "@angular/core";
import { StartAssignment } from "./StartAssignment";
import { CK3Service } from "../../services/gamedata/CK3Service";
import { PdxFileService } from "../../services/pdx-file.service";
import { Trait } from "../../model/ck3/Trait";
import { Plotable } from "../plot-view/Plotable";
import { RGB } from "../../util/RGB";
import { TraitType } from "../../model/ck3/enum/TraitType";
import { CK3 } from "../../model/ck3/game/CK3";

@Injectable({
    providedIn: 'root'
})
export class MegaPlotService {

    ck3Service = inject(CK3Service);
    fileService = inject(PdxFileService);

    generatePlotData(ck3: CK3, assignments: StartAssignment[]) {
        const traitType2Color = new Map<string, RGB>();
        traitType2Color.set(TraitType.PERSONALITY, new RGB(102, 153, 204));
        traitType2Color.set(TraitType.INHERITABLE, new RGB(102, 0, 0));
        traitType2Color.set(TraitType.EDUCATION, new RGB(230, 230, 210));
        traitType2Color.set(TraitType.COMMANDER, new RGB(100, 100, 100));
        traitType2Color.set(TraitType.LIFESTYLE, new RGB(128, 0, 128));
        traitType2Color.set(TraitType.FAME, new RGB(135, 206, 250));
        traitType2Color.set(TraitType.HEALTH, new RGB(235, 83, 83));
        traitType2Color.set(TraitType.PHYSICAL, new RGB(0, 128, 128));
        traitType2Color.set(TraitType.FALLBACK, new RGB(128, 128, 128));
        return countTraits(assignments, this.ck3Service, ck3, this.fileService).then(trait2Count => {
            return Array.from(trait2Count.entries()).map(([trait, count]) => {
                if (traitType2Color.has(trait.getTraitType()) === false) {
                    console.warn(`No color defined for trait type ${trait.getTraitType()}`);
                    traitType2Color.set(trait.getTraitType(), new RGB(0, 0, 0));
                }
                return new Plotable(
                    trait.getName(),
                    count,
                    (traitType2Color.get(trait.getTraitType()) || new RGB(0, 0, 0)).toHexString(),
                    trait.getTraitIconUrl()
                );
            }).sort((a, b) => a.value == b.value ? (a.label < b.label ? -1 : 1) : b.value - a.value);
        });
    }
}

async function countTraits(
    assignments: StartAssignment[],
    ck3Service: CK3Service,
    ck3: CK3,
    fileService: PdxFileService
): Promise<Map<Trait, number>> {
    const trait2Count: Map<Trait, number> = new Map();
    return new Promise((resolve) => {
        const promises = assignments.map(async (assignment) => {
            if (assignment.start_key && assignment.start_data) {
                const json = await fileService.parseContentToJsonPromise((assignment.start_data as { ruler: string }).ruler);
                const character = ck3Service.parseCustomCharacter(json, ck3);
                if (character) {
                    for (const trait of character.traits) {
                        trait2Count.set(trait, (trait2Count.get(trait) || 0) + 1);
                    }
                    if (character.educationTrait) {
                        trait2Count.set(character.educationTrait, (trait2Count.get(character.educationTrait) || 0) + 1);
                    }
                }
            }
        });
        Promise.all(promises).then(() => {
            resolve(trait2Count);
        });
    });
}