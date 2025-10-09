import { Component, ElementRef, inject, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange } from '@angular/material/select';
import { SaveViewComponent } from '../save-view/save-view.component';
import { Ck3SaveViewComponent } from '../saveana/ck3-save-view/ck3-save-view.component';
import { CK3Service } from '../../services/gamedata/CK3Service';
import { Ck3Save } from '../../model/Ck3Save';
import { Vic3Save } from '../../model/vic/Vic3Save';
import { Eu4Save } from '../../model/eu4/Eu4Save';
import { PdxFileService } from '../../services/pdx-file.service';
import { SideNavContentProvider } from '../SideNavContentProvider';
import { SimplifiedDate } from '../../model/common/SimplifiedDate';

enum FileType {
    CK3 = 'ck3',
    VIC3 = 'v3',
    EU4 = 'eu4',
    JSON = 'json',
    UNSUPPORTED = 'unsupported'
}

@Component({
    selector: 'app-save-view-splash',
    imports: [SaveViewComponent, CommonModule, MatButtonModule, MatProgressSpinnerModule, Ck3SaveViewComponent, MatSelectModule, MatFormFieldModule],
    templateUrl: './save-view-splash.component.html',
    styleUrl: './save-view-splash.component.scss'
})
export class SaveViewSplashComponent {

    ck3Service = inject(CK3Service);
    sideNavContentProvider = inject(SideNavContentProvider);

    activeSave?: any;
    activeSaveRawData?: any;
    isProcessing = false;
    private clearSaveActionHandle?: string;
    private downloadSaveActionHandle?: string;

    referenceSaves = [
        {
            url: "http://localhost:5500/public/King_Friedrich_of_Niederlothringen_1139_01_01.ck3",
            gamename: 'Crusader Kings 3', label: 'King Friedrich of Niederlothringen', type: FileType.CK3
        },
        {
            url: 'http://localhost:5500/public/Duke_Friedrich_II_of_Lower_Lotharingia_1107_07_25.ck3',
            gamename: 'Crusader Kings 3', label: 'Duke Friedrich II of Lower Lotharingia', type: FileType.CK3
        },
        {
            url: 'http://localhost:5500/public/MY Emperor_Havel_of_Greater_Elbia_1208_03_24.ck3',
            gamename: 'Crusader Kings 3', label: 'Emperor Havel of Greater Elbia', type: FileType.CK3
        },
        {
            url: 'http://localhost:5500/public/greater elbia_1898_07_06.v3',
            gamename: 'Victoria 3', label: 'Greater Elbia 1898', type: FileType.VIC3
        },
        {
            url: 'http://localhost:5500/public/mp_Greater_Elbia1705_05_28.eu4',
            gamename: 'Europa Universalis IV', label: 'MP Greater Elbia 1705', type: FileType.EU4
        }
    ];

    @ViewChild('chute') chuteDiv!: ElementRef<HTMLDivElement>;
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    constructor(private fileService: PdxFileService, private elementRef: ElementRef, http: HttpClient) {
        const firstExample = this.referenceSaves[0];
        if (firstExample) {
            this.startProcessing();
            this.loadReferenceSave(firstExample.url, firstExample.type)
                .then(result => this.handleSuccess(result.save, result.rawData))
                .catch(error => this.handleError(this.getErrorMessage(error, firstExample.type)));
        }
    }

    activeSaveIsVic3() {
        return this.activeSave instanceof Vic3Save;
    }

    activeSaveIsCk3() {
        return this.activeSave instanceof Ck3Save;
    }

    activeSaveIsEu4() {
        return this.activeSave instanceof Eu4Save;
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
            const files = Array.from(event.dataTransfer.files);
            this.processFiles(files);
        }
    }

    private processFiles(files: File[]) {
        const file = files[0];
        if (!file) return;
        const fileType = this.getFileType(file);
        if (fileType === FileType.UNSUPPORTED) {
            this.handleError('Unsupported file type. Please select a .ck3, .v3, .eu4, or .json save file.');
            return;
        }
        this.startProcessing();
        this.processFileByType(file, files, fileType)
            .then(result => this.handleSuccess(result.save, result.rawData))
            .catch(error => this.handleError(this.getErrorMessage(error, fileType)));
    }

    private getFileType(file: File): FileType {
        if (file.name.endsWith('.ck3')) return FileType.CK3;
        if (file.name.endsWith('.v3')) return FileType.VIC3;
        if (file.name.endsWith('.eu4')) return FileType.EU4;
        if (file.name.endsWith('.json')) return FileType.JSON;
        return FileType.UNSUPPORTED;
    }

    private async processFileByType(file: File, files: File[], fileType: FileType): Promise<{save: any, rawData: any}> {
        switch (fileType) {
            case FileType.CK3:
                return this.processCk3File(file);
            case FileType.VIC3:
                return this.processVic3File(files);
            case FileType.EU4:
                return this.processEu4File(files);
            case FileType.JSON:
                return this.processJsonFile(files);
            default:
                throw new Error('Unsupported file type');
        }
    }

    private async processCk3File(file: File): Promise<{save: Ck3Save, rawData: any}> {
        const result = await this.ck3Service.importFilePromise(file, true);
        const ck3 = await firstValueFrom(this.ck3Service.initializeCK3());
        console.log("Imported CK3 file", result.name, result.json);
        const save = Ck3Save.fromRawData(result.json, ck3);
        return { save, rawData: result.json };
    }

    private async processVic3File(files: File[]): Promise<{save: Vic3Save, rawData: any}> {
        const namesAndJsons = await this.fileService.importFilesPromise(files);
        const first = namesAndJsons[0];
        console.log("Imported Victoria 3 file", first.name, first.json);
        const save = Vic3Save.makeSaveFromRawData(first.json);
        return { save, rawData: first.json };
    }

    private async processEu4File(files: File[]): Promise<{save: Eu4Save, rawData: any}> {
        const namesAndJsons = await this.fileService.importFilesPromise(files);
        const first = namesAndJsons[0];
        console.log("Imported EU4 file", first.name, first.json);
        const save = new Eu4Save(first.json);
        return { save, rawData: first.json };
    }

    private async processJsonFile(files: File[]): Promise<never> {
        throw new Error('TODO: Implement JSON file processing');
    }

    private startProcessing(): void {
        this.isProcessing = true;
    }

    private handleSuccess(save: any, rawData?: any): void {
        this.activeSave = save;
        this.activeSaveRawData = rawData;
        this.addDownloadJSONAction();
        this.addClearSaveAction();
        this.finishProcessing();
    }

    private handleError(message: string): void {
        console.error('Error processing file:', message);
        this.showError(message);
        this.finishProcessing();
    }

    private finishProcessing(): void {
        this.showHoverActiveIndicator(false);
        this.isProcessing = false;
    }

    private getErrorMessage(error: any, fileType: FileType): string {
        const baseMessage = error.message || error.error || 'Unknown error';
        const fileTypeNames: Record<FileType, string> = {
            [FileType.CK3]: 'CK3',
            [FileType.VIC3]: 'Victoria 3',
            [FileType.EU4]: 'EU4',
            [FileType.JSON]: 'JSON',
            [FileType.UNSUPPORTED]: 'unsupported'
        };
        return `Error processing ${fileTypeNames[fileType] || ''} file: ${baseMessage}`;
    }

    private showError(message: string) {
        if (this.chuteDiv?.nativeElement?.firstChild) {
            this.chuteDiv.nativeElement.firstChild!.textContent = message;
        }
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
        this.showHoverActiveIndicator(true);
    }

    onDragLeave(event: DragEvent) {
        event.preventDefault();
        this.showHoverActiveIndicator(false);
    }

    onDragEnd(event: DragEvent) {
        event.preventDefault();
        this.showHoverActiveIndicator(false);
    }

    showHoverActiveIndicator(hatch: boolean) {
        if (!this.chuteDiv) return;
        this.chuteDiv.nativeElement.classList.toggle('chute-active', hatch);
        this.elementRef.nativeElement.style.backgroundImage = hatch ? 'repeating-linear-gradient(45deg, #000 0, #000 10px, transparent 10px, transparent 20px)' : 'none';

    }

    openFileDialog() {
        this.fileInput.nativeElement.click();
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const files = Array.from(input.files);
            this.processFiles(files);
        }
    }

    onReferenceSaveSelected(event: MatSelectChange) {
        const selectedUrl = event.value;
        const selectedSave = this.referenceSaves.find(save => save.url === selectedUrl);

        if (selectedSave) {
            this.startProcessing();
            this.loadReferenceSave(selectedSave.url, selectedSave.type)
                .then(result => this.handleSuccess(result.save, result.rawData))
                .catch(error => this.handleError(this.getErrorMessage(error, selectedSave.type)));
        }
    }

    getUniqueGameNames(): string[] {
        const gameOrder = ['Crusader Kings 3', 'Europa Universalis IV', 'Victoria 3'];
        const availableGames = [...new Set(this.referenceSaves.map(save => save.gamename))];
        return gameOrder.filter(game => availableGames.includes(game));
    }

    getReferenceSavesByGame(gamename: string) {
        return this.referenceSaves.filter(save => save.gamename === gamename);
    }

    private async loadReferenceSave(url: string, fileType: FileType): Promise<{save: any, rawData: any}> {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const file = new File([blob], url.split('/').pop() || 'reference-save');

            return this.processFileByType(file, [file], fileType);
        } catch (error) {
            throw new Error(`Failed to load reference save: ${error}`);
        }
    }

    private addDownloadJSONAction(): void {
        if (this.downloadSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.downloadSaveActionHandle);
        }
        this.downloadSaveActionHandle = this.sideNavContentProvider.addToolbarAction(
            'download',
            'Download JSON',
            () => {
                if (!this.activeSaveRawData) return;
                const jsonStr = JSON.stringify(this.activeSaveRawData, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'save.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        );
    }

    private addClearSaveAction(): void {
        if (this.clearSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.clearSaveActionHandle);
        }

        this.clearSaveActionHandle = this.sideNavContentProvider.addToolbarAction(
            'close',
            'Clear current save',
            () => this.clearSave()
        );
        const saveName = this.getSaveDisplayName();
        this.sideNavContentProvider.setToolbarLabel(saveName);
    }

    private clearSave(): void {
        this.activeSave = undefined;
        this.activeSaveRawData = undefined;
        if (this.clearSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.clearSaveActionHandle);
            this.clearSaveActionHandle = undefined;
        }
        this.sideNavContentProvider.clearToolbarLabel();
    }

    private getSaveDisplayName(): string {
        if (!this.activeSave) return '';
        if (this.activeSaveIsCk3()) {
            const asCk3Save = this.activeSave as Ck3Save;
            const date = SimplifiedDate.fromDate(asCk3Save.getIngameDate());
            return date.getDateWithShortenedMonthName();
        }

        if (this.activeSaveIsVic3()) {
            const country = this.activeSave.country_name || this.activeSave.tag;
            const date = this.activeSave.date;
            if (country && date) return `${country} (${date})`;
            if (country) return country;
        }

        if (this.activeSaveIsEu4()) {
            const country = this.activeSave.country || this.activeSave.tag;
            const date = this.activeSave.date;
            if (country && date) return `${country} (${date})`;
            if (country) return country;
        }

        return 'Loaded Save';
    }
}
