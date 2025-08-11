import { Component, ElementRef, ViewChild } from '@angular/core';
import { PdxFileService } from '../services/pdx-file.service';
import { CommonModule } from '@angular/common';
import { SaveViewComponent } from '../save-view/save-view.component';
import { HttpClient } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { Vic3Save } from '../model/vic/Vic3Save';

@Component({
    selector: 'app-save-view-splash',
    imports: [SaveViewComponent, CommonModule, MatButtonModule],
    templateUrl: './save-view-splash.component.html',
    styleUrl: './save-view-splash.component.scss'
})
export class SaveViewSplashComponent {
    hasBeenInitialized = false;
    activeSave?: Vic3Save;

    @ViewChild('chute') chuteDiv!: ElementRef<HTMLDivElement>;
    @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

    constructor(private fileService: PdxFileService, private elementRef: ElementRef, http: HttpClient) {
        
        http.get("http://localhost:5500/public/greater elbia_1887_03_29.v3", { responseType: 'text' }).subscribe(data => {
            this.processFiles([new File([data], "testsave.v3")]);
        });
        
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
            const files = Array.from(event.dataTransfer.files);
            this.processFiles(files);
        }
    }

    private processFiles(files: File[]) {
        this.fileService.importFilesPromise(files).then(namesAndJsons => {
            const first = namesAndJsons[0];
            this.activeSave = Vic3Save.makeSaveFromRawData(first.json);
            this.hasBeenInitialized = true;
            this.showHoverActiveIndicator(false);
        }).catch(error => {
            this.showError(`Error: ${error.message}`);
            this.showHoverActiveIndicator(false);
        });
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
}
