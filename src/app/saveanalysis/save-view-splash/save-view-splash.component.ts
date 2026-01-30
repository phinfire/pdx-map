import { Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, firstValueFrom } from 'rxjs';
import { SimplifiedDate } from '../../../model/common/SimplifiedDate';
import { Eu4Save } from '../../../model/games/eu4/Eu4Save';
import { SaveFileType } from '../../../model/common/SaveFileType';
import { Vic3Save } from '../../../model/vic/Vic3Save';
import { CK3Service } from '../../../services/gamedata/CK3Service';
import { PdxFileService } from '../../../services/pdx-file.service';
import { SideNavContentProvider } from '../../../ui/SideNavContentProvider';
import { SaveSaverService } from '../../save-saver.service';
import { SaveViewComponent } from '../save-view/save-view.component';
import { Ck3SaveViewComponent } from '../ck3-save-view/ck3-save-view.component';
import { Ck3Save } from '../../../model/ck3/Ck3Save';
import { Eu4SaveViewComponent } from '../eu4-save-view/eu4-save-view.component';

@Component({
    selector: 'app-save-view-splash',
    imports: [Ck3SaveViewComponent, Eu4SaveViewComponent, SaveViewComponent, MatButtonModule, MatProgressSpinnerModule, Ck3SaveViewComponent, MatIconModule],
    templateUrl: './save-view-splash.component.html',
    styleUrl: './save-view-splash.component.scss'
})
export class SaveViewSplashComponent implements OnDestroy {

    ck3Service = inject(CK3Service);
    sideNavContentProvider = inject(SideNavContentProvider);
    saveSaverService = inject(SaveSaverService);
    private fileService = inject(PdxFileService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    activeSave?: any;
    activeSaveRawData?: any;
    isProcessing = false;
    isFromDatabase = false;
    private clearSaveActionHandle?: string;
    private downloadSaveActionHandle?: string;
    private downloadProcessedSaveActionHandle?: string;

    @ViewChild('chute') chuteDiv!: ElementRef<HTMLDivElement>;
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    constructor(private elementRef: ElementRef) {
    }

    ngOnInit() {
        combineLatest([
            this.saveSaverService.getAvailableSavesAndMetadata(),
            this.route.params
        ]).subscribe(([saves, params]) => {
            const gameFromURL = params['game'];
            const saveIdFromURL = params['saveId'];
            if (saveIdFromURL) {
                this.startProcessing();
                const fileType = this.getFileTypeFromGame(gameFromURL);
                if (saveIdFromURL === "latest") {
                    const latestSave = saves[saves.length - 1];
                    if (latestSave) {
                        const game = gameFromURL || this.saveSaverService.getGameFromSaveMetadata(latestSave);
                        const id = latestSave.id;
                        if (game && id) {
                            this.router.navigate(['/save', game, id], { skipLocationChange: true });
                        }
                    }
                    this.finishProcessing();
                } else if (saveIdFromURL === "dev") {
                    if (fileType) {
                        let localUrl = "";
                        if (gameFromURL == "eu4") {
                            localUrl = "http://localhost:5500/public/saves/mp_Palatinate1705_10_30.eu4";
                        } else if (gameFromURL == "ck3") {
                            localUrl = "http://localhost:5500/public/Pope_Udalrich_of_die_The_Misanthropy_1262_04_18.ck3";
                        } else if (gameFromURL == "vic3") {
                            localUrl = "http://localhost:5500/public/saves/palatinate_1897_08_22.v3";
                        }
                        this.loadReferenceSave(localUrl, fileType)
                            .then(result => this.handleSuccess(result.save, result.rawData))
                            .catch(error => this.handleError(this.getErrorMessage(error, fileType)));
                    }
                } else {
                    this.isFromDatabase = true;
                    this.saveSaverService.getSaveFileByIdentifier(saveIdFromURL).subscribe(save => {
                        this.handleSuccess(save, null);
                    });
                }
            }
        });
    }


    private getFileTypeFromGame(game?: string): SaveFileType | undefined {
        switch (game?.toLowerCase()) {
            case 'ck3':
                return SaveFileType.CK3;
            case 'vic3':
                return SaveFileType.VIC3;
            case 'eu4':
                return SaveFileType.EU4;
            default:
                return undefined;
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
        if (fileType === SaveFileType.UNSUPPORTED) {
            this.handleError('Unsupported file type. Please select a .ck3, .v3, .eu4, or .json save file.');
            return;
        }
        this.startProcessing();
        this.isFromDatabase = false;
        this.processFileByType(file, files, fileType)
            .then(result => this.handleSuccess(result.save, result.rawData))
            .catch(error => this.handleError(this.getErrorMessage(error, fileType)));
    }

    private getFileType(file: File): SaveFileType {
        if (file.name.endsWith('.ck3')) return SaveFileType.CK3;
        if (file.name.endsWith('.v3')) return SaveFileType.VIC3;
        if (file.name.endsWith('.eu4')) return SaveFileType.EU4;
        if (file.name.endsWith('.json')) return SaveFileType.JSON;
        return SaveFileType.UNSUPPORTED;
    }

    private async processFileByType(file: File, files: File[], fileType: SaveFileType): Promise<{ save: any, rawData: any }> {
        switch (fileType) {
            case SaveFileType.CK3:
                return this.processCk3File(file);
            case SaveFileType.VIC3:
                return this.processVic3File(files);
            case SaveFileType.EU4:
                return this.processEu4File(files);
            case SaveFileType.JSON:
                return this.processJsonFile(files);
            default:
                throw new Error('Unsupported file type');
        }
    }

    private async processCk3File(file: File): Promise<{ save: Ck3Save, rawData: any }> {
        const result = await this.ck3Service.importFilePromise(file, true);
        const ck3 = await firstValueFrom(this.ck3Service.initializeCK3());
        const save = Ck3Save.fromRawData(result.json, ck3);
        return { save, rawData: result.json };
    }

    private async processVic3File(files: File[]): Promise<{ save: Vic3Save, rawData: any }> {
        const namesAndJsons = await this.fileService.importFilesPromise(files);
        const first = namesAndJsons[0];
        const save = Vic3Save.makeSaveFromRawData(first.json);
        return { save, rawData: first.json };
    }

    private async processEu4File(files: File[]): Promise<{ save: Eu4Save, rawData: any }> {
        const namesAndJsons = await this.fileService.importFilesPromise(files);
        const first = namesAndJsons[0];
        console.log('EU4 Save JSON:', first.json);
        const save = Eu4Save.makeSaveFromRawData(first.json);
        return { save, rawData: first.json };
    }

    private async processJsonFile(files: File[]): Promise<never> {
        throw new Error('TODO: Implement JSON file processing');
    }

    private startProcessing(): void {
        this.isProcessing = true;
    }

    private handleSuccess(save: any, rawData?: any | null): void {
        this.activeSave = save;
        this.activeSaveRawData = rawData;
        this.addDownloadJSONAction();
        this.addDownloadProcessedJSONAction();
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

    private getErrorMessage(error: any, fileType: SaveFileType): string {
        const baseMessage = error.message || error.error || 'Unknown error';
        const fileTypeNames: Record<SaveFileType, string> = {
            [SaveFileType.CK3]: 'CK3',
            [SaveFileType.VIC3]: 'Victoria 3',
            [SaveFileType.EU4]: 'EU4',
            [SaveFileType.JSON]: 'JSON',
            [SaveFileType.UNSUPPORTED]: 'unsupported'
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

    goToLatestSave() {
        this.router.navigate(['/save', 'latest']);
    }

    private async loadReferenceSave(url: string, fileType: SaveFileType): Promise<{ save: any, rawData: any }> {
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
        if (this.activeSaveRawData) {
            this.downloadSaveActionHandle = this.sideNavContentProvider.addToolbarAction(
                'file_save',
                'Download JSON',
                () => {
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
    }

    private addDownloadProcessedJSONAction(): void {
        if (this.downloadProcessedSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.downloadProcessedSaveActionHandle);
        }
        if (this.activeSave && typeof this.activeSave.toJSON === 'function') {
            this.downloadProcessedSaveActionHandle = this.sideNavContentProvider.addToolbarAction(
                'download',
                'Download Processed JSON',
                () => {
                    const processed = this.activeSave.toJSON();
                    const jsonStr = JSON.stringify(processed, null, 2);
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'save-processed.json';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            );
        }
    }

    private addClearSaveAction(): void {
        if (this.clearSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.clearSaveActionHandle);
        }

        this.clearSaveActionHandle = this.sideNavContentProvider.addToolbarAction(
            'close',
            'Clear current save',
            () => this.clearSave(),
            Number.MAX_VALUE
        );
        const saveName = this.getSaveDisplayName();
    }

    private clearSave(): void {
        this.activeSave = undefined;
        this.activeSaveRawData = undefined;
        if (this.clearSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.clearSaveActionHandle);
            this.clearSaveActionHandle = undefined;
        }
        if (this.downloadSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.downloadSaveActionHandle);
            this.downloadSaveActionHandle = undefined;
        }
        if (this.downloadProcessedSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.downloadProcessedSaveActionHandle);
            this.downloadProcessedSaveActionHandle = undefined;
        }
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

    ngOnDestroy(): void {
        if (this.clearSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.clearSaveActionHandle);
            this.clearSaveActionHandle = undefined;
        }
        if (this.downloadSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.downloadSaveActionHandle);
            this.downloadSaveActionHandle = undefined;
        }
        if (this.downloadProcessedSaveActionHandle) {
            this.sideNavContentProvider.removeToolbarAction(this.downloadProcessedSaveActionHandle);
            this.downloadProcessedSaveActionHandle = undefined;
        }
    }
}
