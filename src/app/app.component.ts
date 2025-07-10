import { Component } from '@angular/core';
import { ParadoxComponent } from './paradox/paradox.component';

@Component({
    selector: 'app-root',
    imports: [ParadoxComponent],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
}