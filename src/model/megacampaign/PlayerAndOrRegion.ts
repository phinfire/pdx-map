import { DiscordUser } from "../social/DiscordUser";

export class PlayerAndOrRegion {

    public readonly user: DiscordUser | null;
    public readonly regionServer: string | null;
    public regionClient: string | null;
    public readonly preferences: string[];

    constructor(user: DiscordUser | null, regionServer: string | null, regionClient: string | null, preferences: string[]) {
        this.user = user;
        this.regionServer = regionServer;
        this.regionClient = regionClient;
        this.preferences = preferences;
    }

    getPick(pickNumber: number): string {
        if (pickNumber < 0 || !this.preferences || this.preferences.length <= pickNumber) {
            return "-";
        }
        return this.preferences[pickNumber];
    }

    getPickNumber(): string {
        if (!this.preferences || !this.regionClient) {
            return '';
        }
        const index = this.preferences.indexOf(this.regionClient);
        return index !== -1 ? (index + 1).toString() : '';
    }

    isHappy(): boolean {
        if (!this.preferences || !this.regionClient) {
            return false;
        }
        return this.preferences.indexOf(this.regionClient) !== -1;
    }

    getDisplayName(): string {
        if (!this.user) {
            return 'Unknown';
        }
        return this.user.global_name || this.user.username || 'Unknown';
    }

    getId(): string {
        return this.user?.id || '';
    }
}