
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';
import { IconRegistryService } from '../../services/icon-registry.service';

@Component({
    selector: 'app-discord-login',
    templateUrl: './discord-login.component.html',
    styleUrls: ['./discord-login.component.scss'],
    imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule, MatTooltipModule]
})
export class DiscordLoginComponent {

    isApiOnline$: Observable<boolean>;
    isLoggedIn$: Observable<boolean>;

    constructor(private discordAuth: DiscordAuthenticationService, iconRegistry: IconRegistryService) {
        iconRegistry.registerIcons();
        this.isApiOnline$ = this.discordAuth.isOnline$;
        this.isLoggedIn$ = this.discordAuth.isLoggedIn$();
    }

    loginWithDiscord() {
        this.discordAuth.loginOnDiscord();
    }
}