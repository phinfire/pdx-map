export interface CountryShell {

    getTag(): string;

    getVassals(): CountryShell[];

    getPopulation(): number;
}