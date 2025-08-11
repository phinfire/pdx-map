import { Injectable } from "@angular/core";


@Injectable({
    providedIn: 'root'
})
export class PersistenceService {
  
    key2Value = new Map<string, string>();

    storeValue(key: string, value: string) {
        this.key2Value.set(key, value);
        localStorage.setItem(key, value);
    }

    getValue(key: string): string | null {
        if (this.key2Value.has(key)) {
            return this.key2Value.get(key) || null;
        }
        const value = localStorage.getItem(key);
        if (value !== null) {
            this.key2Value.set(key, value);
        }
        return value;
    }
}