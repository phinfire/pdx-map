import { Game } from "../Game";
import { RGB } from "../../util/RGB";

export interface MapClaimCountryData {
    name: string;
    color: RGB;
}

export class MapClaimSession {

    private cachedProvincesPerCountry: Map<string, Set<string>> = new Map();

    constructor(
        public id: number | null,
        public creatorId: string | null,
        public name: string,
        public game: Game,
        public countries: Map<string, MapClaimCountryData>,
        public ownership: Map<string, string>,
        public isPublic: boolean
    ) {
        this.cachedProvincesPerCountry = new Map();
        for (const [provinceId, ownerId] of ownership) {
            if (!this.cachedProvincesPerCountry.has(ownerId)) {
                this.cachedProvincesPerCountry.set(ownerId, new Set());
            }
            this.cachedProvincesPerCountry.get(ownerId)!.add(provinceId);
        }
    }

    createNewCountryWithProvince(name: string, color: RGB, provinceId: string) {
        const newCountryId = (Array.from(this.countries.keys()).length + 1).toString();
        const newCountryData = { name, color };
        this.countries.set(newCountryId, newCountryData);
        this.setOwnership(provinceId, newCountryId);
        return newCountryId;
    }

    setOwnership(provinceId: string, ownerId: string) {
        if (this.ownership.has(provinceId)) {
            const oldOwnerId = this.ownership.get(provinceId)!;
            this.cachedProvincesPerCountry.get(oldOwnerId)?.delete(provinceId);
        }
        this.ownership.set(provinceId, ownerId);
        if (!this.cachedProvincesPerCountry.has(ownerId)) {
            this.cachedProvincesPerCountry.set(ownerId, new Set());
        }
        this.cachedProvincesPerCountry.get(ownerId)!.add(provinceId);
    }

    removeOwnership(provinceId: string) {
        if (this.ownership.has(provinceId)) {
            const oldOwnerId = this.ownership.get(provinceId)!;
            this.cachedProvincesPerCountry.get(oldOwnerId)?.delete(provinceId);
            this.ownership.delete(provinceId);
        }
    }

    getOwner(provinceId: string) {
        const ownerId = this.ownership.get(provinceId);
        return ownerId ? this.countries.get(ownerId) : null;
    }

    getACountryId() {
        const entry = this.countries.entries().next().value;
        return entry ? entry[0] : null;
    }

    getCountry(countryId: string) {
        return this.countries.get(countryId) || null;
    }

    getCountries() {
        return this.countries;
    }

    getProvincesOfCountry(countryId: string): Set<string> {
        return this.cachedProvincesPerCountry.get(countryId) || new Set();
    }

    removeCountry(countryId: string) {
        this.countries.delete(countryId);
        this.cachedProvincesPerCountry.delete(countryId);
    }

    isOnline(): boolean {
        return this.id !== null;
    }

    isEmpty(): boolean {
        return this.ownership.size === 0;
    }

    canEdit(userId: string) {
        return this.creatorId === userId;
    }
}