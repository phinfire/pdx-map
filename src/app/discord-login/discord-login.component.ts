
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';

const DISCORD_LOGO = `
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="white" class="bi bi-discord" viewBox="0 0 16 16">
  <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/>
</svg>
`;

@Component({
    selector: 'app-discord-login',
    templateUrl: './discord-login.component.html',
    styleUrls: ['./discord-login.component.scss'],
    imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule, MatTooltipModule]
})
export class DiscordLoginComponent {

    isApiOnline$: Observable<boolean>;

    constructor(private discordAuth: DiscordAuthenticationService) {
        const iconRegistry = inject(MatIconRegistry);
        const sanitizer = inject(DomSanitizer);
        iconRegistry.addSvgIconLiteral('discord-logo', sanitizer.bypassSecurityTrustHtml(DISCORD_LOGO));
        
        this.isApiOnline$ = this.discordAuth.isOnline$;
    }

    loginWithDiscord() {
        console.log("Starting Discord login flow...", this.discordAuth.getRedirectUrl());
        this.discordAuth.loginOnDiscord(this.discordAuth.getRedirectUrl());
    }
    
    isLoggedIn(): boolean {
        return this.discordAuth.getLoggedInUser() !== null;
    }
}