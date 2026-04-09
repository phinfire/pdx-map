import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, shareReplay } from 'rxjs';

@Injectable({
    providedIn: 'root',
})
export class Ck3ToEu4ConverterServiceService {

    http = inject(HttpClient);

    getProvinceMapping$() {
        return this.http.get("https://codingafterdark.de/pdx/data/converter/c2e/province_mappings.txt", { responseType: 'text' }).pipe(
            map((response) => this.parseMappingFile(response)),
            shareReplay(1)
        );
    }

    private parseMappingFile(fileContent: string): { ck3BaronyIndices: string[], eu4ProvinceIds: string[] }[] {
        const mapping: { ck3BaronyIndices: string[], eu4ProvinceIds: string[] }[] = [];
        for (const line of fileContent.split('\n')) {
            const indexOfCommentStart = line.indexOf('#');
            const lineWithoutComment = indexOfCommentStart >= 0 ? line.substring(0, indexOfCommentStart) : line;
            const trimmedLine = lineWithoutComment.trim();
            if (!trimmedLine) continue;

            const ck3Matches = Array.from(trimmedLine.matchAll(/ck3\s*=\s*(\d+)/g));
            const eu4Matches = Array.from(trimmedLine.matchAll(/eu4\s*=\s*(\d+)/g));

            if (ck3Matches.length > 0 && eu4Matches.length > 0) {
                const ck3BaronyIndices = ck3Matches.map(match => match[1]);
                const eu4ProvinceIds = eu4Matches.map(match => match[1]);
                mapping.push({ ck3BaronyIndices, eu4ProvinceIds });
            }
        }
        return mapping;
    }
}
