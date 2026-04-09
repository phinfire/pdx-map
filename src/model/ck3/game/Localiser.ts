export interface Localiser {
    hasLocalisation(key: string): boolean;
    localise(key: string): string;
}