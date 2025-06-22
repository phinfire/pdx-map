import { Component } from '@angular/core';
import { SaveViewSplashComponent } from './save-view-splash/save-view-splash.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { SideNavContentProvider } from './SideNavContentProvider';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-root',
    imports: [SaveViewSplashComponent, MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, CommonModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
    showFiller = true;
    title = 'pdx-map';

    constructor(public sideNavContentProvider: SideNavContentProvider) {

    }
}