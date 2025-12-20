import { Component, inject } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PdxFileService } from '../../services/pdx-file.service';

interface ParsedFile {
    name: string;
    json: any;
}

@Component({
    selector: 'app-jomini-kiosk',
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './jomini-kiosk.component.html',
    styleUrl: './jomini-kiosk.component.scss',
})
export class JominiKioskComponent {
    private fileService = inject(PdxFileService);
    parsedFiles: ParsedFile[] = [];
    isDragging = false;
    downloadedFiles = new Set<string>();

    onDragOver(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = true;
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        event.stopPropagation();
        this.isDragging = false;

        const files = event.dataTransfer?.files;
        if (files) {
            this.handleFiles(Array.from(files));
        }
    }

    private handleFiles(files: File[]) {
        this.fileService.importFilesPromise(files).then(
            (results) => {
                results.forEach((result) => {
                    // Only add non-JSON files (JSON files are not parsed, they're already JSON)
                    if (!result.name.endsWith('.json')) {
                        this.parsedFiles.push(result);
                    }
                });
            },
            (error) => {
                console.error('Error parsing files:', error);
            }
        );
    }

    downloadJson(parsedFile: ParsedFile) {
        const filename = parsedFile.name.split('.')[0] + '.json';
        this.fileService.downloadJson(parsedFile.json, filename);
        this.markAsDownloaded(parsedFile.name);
    }

    downloadAll() {
        const combined: any = {};
        this.parsedFiles.forEach(file => {
            const key = file.name.split('.')[0];
            combined[key] = file.json;
        });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        this.fileService.downloadJson(combined, `${timestamp}_jomini_parsed.json`);
    }

    private markAsDownloaded(fileName: string) {
        this.downloadedFiles.add(fileName);
        setTimeout(() => {
            this.downloadedFiles.delete(fileName);
        }, 2000);
    }

    isDownloaded(fileName: string): boolean {
        return this.downloadedFiles.has(fileName);
    }

    removeParsedFile(fileName: string) {
        this.parsedFiles = this.parsedFiles.filter(f => f.name !== fileName);
    }

    clearAll() {
        this.parsedFiles = [];
    }
}