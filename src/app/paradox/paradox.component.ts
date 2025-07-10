import { Component, Renderer2 } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { CommonModule } from '@angular/common';
import { MatDividerModule } from '@angular/material/divider';
import { SaveViewSplashComponent } from '../save-view-splash/save-view-splash.component';
import { SideNavContentProvider } from '../SideNavContentProvider';


@Component({
    selector: 'app-paradox',
    imports: [SaveViewSplashComponent, MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, CommonModule, MatDividerModule],
    templateUrl: './paradox.component.html',
    styleUrl: './paradox.component.scss'
})
export class ParadoxComponent {
    isDarkMode = true;
    currentTheme: 'day' | 'night' = this.isDarkMode ? 'night' : 'day';

    constructor(public sideNavContentProvider: SideNavContentProvider, private renderer: Renderer2) {

    }

    setTheme(darkMode: boolean) {
        this.isDarkMode = darkMode;
        if (this.isDarkMode) {
            this.renderer.removeClass(document.body, 'light-theme');
        } else {
            this.renderer.addClass(document.body, 'light-theme');
        }
    }

    toggleAnimation(theme: 'day' | 'night'): void {
        this.currentTheme = theme;
    }
}