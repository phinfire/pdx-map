import { Component, ElementRef, ViewChild } from '@angular/core';
import { Vic3Save } from '../model/Vic3Save';
import { PdxFileService } from '../pdx-file.service';
import { CommonModule } from '@angular/common';
import { SaveViewComponent } from '../save-view/save-view.component';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-save-view-splash',
    imports: [SaveViewComponent, CommonModule],
    templateUrl: './save-view-splash.component.html',
    styleUrl: './save-view-splash.component.scss'
})
export class SaveViewSplashComponent {
    hasBeenInitialized = false;
    activeSave?: Vic3Save;

    @ViewChild('chute') chuteDiv!: ElementRef<HTMLDivElement>;

    constructor(private fileService: PdxFileService, private elementRef: ElementRef, http: HttpClient) {
        /*
        http.get("http://localhost:5500/public/testsave.v3", { responseType: 'text' }).subscribe(data => {
            fileService.importFile([new File([data], "abc.v3")], (name, json) => {
                const save = Vic3Save.makeSaveFromRawData(json);
                this.activeSave = save;
                this.hasBeenInitialized = true;
                this.showHoverActiveIndicator(false);
            });
        });
        */
    }

    onDrop(event: DragEvent) {
        event.preventDefault();
        if (event.dataTransfer && event.dataTransfer.files.length > 0) {
            const files = Array.from(event.dataTransfer.files);
            this.fileService.importFile(files, (name, json) => {
                const save = Vic3Save.makeSaveFromRawData(json);
                this.activeSave = save;
                this.hasBeenInitialized = true;
                this.showHoverActiveIndicator(false);
            }, (error, message) => {
                this.chuteDiv.nativeElement.firstChild!.textContent = `Error: ${message}`;
                this.showHoverActiveIndicator(false);
            });
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
}
