import { Component } from '@angular/core';
import { DiscordAuthService, DiscordUser } from '../services/discord-auth.service';

import { CommonModule } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-discord-login',
    templateUrl: './discord-login.component.html',
    styleUrls: ['./discord-login.component.scss'],
    imports: [CommonModule, MatProgressSpinnerModule, MatButtonModule, MatIconModule]
})
export class DiscordLoginComponent {
    user: DiscordUser | null = null;
    loading = false;

    constructor(private discordAuth: DiscordAuthService) {
        this.checkLogin();
    }

    loginWithDiscord() {
        this.discordAuth.login();
    }

    async checkLogin() {
        this.loading = true;
        this.user = await this.discordAuth.getUser();
        this.loading = false;
    }

    getAvatarUrl() {
        return this.user ? `https://cdn.discordapp.com/avatars/${this.user.id}/${this.user.avatar}.png` : '';
    }

    getUserName() {
        return this.user ? `${this.user.username}#${this.user.discriminator}` : 'Not logged in';
    }
    
    hasUserSet(): boolean {
        return !!this.user;
    }
}