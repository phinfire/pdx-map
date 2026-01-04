import { Injectable } from '@angular/core';
import { CountryShell } from './CountryShell';
import { ImmutableCountryShell } from './ImmutableCountryShell';
import { MegaModderE2VService } from '../../app/modding/mega-modder/MegaModderE2VService';

@Injectable({
    providedIn: 'root'
})
export class CountryShellBuilderService {
    constructor(private megaModderService: MegaModderE2VService) {}

    buildCountryShells(
        eu4ToVic3Mapping: Map<string, string>,
        vic3PopByTag: Map<string, number>,
        vic3Vassals: Map<string, string[]>
    ): Map<string, CountryShell> {
        const countryShells = new Map<string, CountryShell>();
        const vassalShells = new Map<string, CountryShell[]>();


        for (const [eu4Tag, vic3Tag] of eu4ToVic3Mapping.entries()) {
            const population = vic3PopByTag.get(vic3Tag) || 0;
            const shell = new ImmutableCountryShell(eu4Tag, population);
            countryShells.set(eu4Tag, shell);
        }
        for (const [vic3Tag, vassalTags] of vic3Vassals.entries()) {
            const overlordTag = this.findEu4TagByVic3Tag(eu4ToVic3Mapping, vic3Tag);
            if (overlordTag && countryShells.has(overlordTag)) {
                const vassalShellList: CountryShell[] = [];
                for (const vassalVic3Tag of vassalTags) {
                    const vassalEu4Tag = this.findEu4TagByVic3Tag(eu4ToVic3Mapping, vassalVic3Tag);
                    if (vassalEu4Tag && countryShells.has(vassalEu4Tag)) {
                        vassalShellList.push(countryShells.get(vassalEu4Tag)!);
                    }
                }
                vassalShells.set(overlordTag, vassalShellList);
            }
        }

        const finalCountryShells = new Map<string, CountryShell>();
        for (const [eu4Tag, shell] of countryShells.entries()) {
            const vassals = vassalShells.get(eu4Tag) || [];
            const finalShell = new ImmutableCountryShell(eu4Tag, shell.getPopulation(), vassals);
            finalCountryShells.set(eu4Tag, finalShell);
        }

        return finalCountryShells;
    }

    private findEu4TagByVic3Tag(eu4ToVic3Mapping: Map<string, string>, vic3Tag: string): string | null {
        for (const [eu4Tag, mappedVic3Tag] of eu4ToVic3Mapping.entries()) {
            if (mappedVic3Tag === vic3Tag) {
                return eu4Tag;
            }
        }
        return null;
    }
}
