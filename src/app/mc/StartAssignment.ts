import { DiscordUser } from '../../model/social/DiscordUser';

/**
 * Backend Assignment - maps a user to an assigned region
 */
export interface Assignment {
    userId: string;
    regionKey: string;
    megaCampaignId: number;
}

/**
 * Backend MegaStartPosition - stores a user's selected start position and uploaded data
 */
export interface MegaStartPosition {
    userId: string;
    startKey: string | null;
    startData: any; // The ruler file content or other start data
    megaCampaignId: number;
}

/**
 * Combined view for the start selection component
 * Contains both assignment (region) and start position (county + ruler) data
 */
export interface StartAssignment {
    user: DiscordUser;
    regionKey: string;
    startKey: string | null;
    startData: string | null;
}