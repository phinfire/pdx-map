import { CountryShell } from './CountryShell';

/**
 * Immutable implementation of CountryShell.
 * Represents a country with its tag, vassals, and population.
 */
export class ImmutableCountryShell implements CountryShell {
    private readonly tag: string;
    private readonly vassals: readonly CountryShell[];
    private readonly population: number;

    constructor(tag: string, population: number, vassals: CountryShell[] = []) {
        this.tag = tag;
        this.population = population;
        this.vassals = Object.freeze([...vassals]);
    }

    getTag(): string {
        return this.tag;
    }

    getVassals(): CountryShell[] {
        return [...this.vassals];
    }

    getPopulation(): number {
        return this.population;
    }

    /**
     * Calculate total population including all vassals recursively
     */
    getTotalPopulationWithVassals(): number {
        let total = this.population;
        for (const vassal of this.vassals) {
            total += vassal.getPopulation();
        }
        return total;
    }
}
