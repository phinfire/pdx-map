import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { map } from 'rxjs/operators';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';

@Component({
    selector: 'app-discord-field',
    templateUrl: './discord-field.component.html',
    styleUrls: ['./discord-field.component.scss'],
    imports: [CommonModule, MatButtonModule, MatIconModule]
})
export class DiscordFieldComponent {

    private discordAuthService: DiscordAuthenticationService = inject(DiscordAuthenticationService);

    isLoggedIn$ = this.discordAuthService.isLoggedIn$();
    
    avatarUrl$ = this.discordAuthService.loggedInUser$.pipe(
        map(user => user?.getAvatarImageUrl() || null)
    );
    
    userName$ = this.discordAuthService.loggedInUser$.pipe(
        map(user => user?.global_name || '-')
    );

    logOut() {
        this.discordAuthService.logOut();
    }
}
