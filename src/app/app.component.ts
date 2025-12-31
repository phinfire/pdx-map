import { Component, inject } from '@angular/core';
import { ParadoxComponent } from './paradox/paradox.component';
import { RouterOutlet } from '@angular/router';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {

    private readonly matIconRegistry = inject(MatIconRegistry);
    private readonly sanitizer = inject(DomSanitizer);


    constructor() {
        this.matIconRegistry.registerFontClassAlias(
            'material-symbols-outlined',
            'material-symbols-outlined'
        );
    }
}