import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class SideNavContentProvider {

    private actions: Map<string, () => void> = new Map();

    constructor() {
        this.actions.set("Toggle Color", () => {
            document.body.classList.toggle("light-mode");
        });
    }
    
    getActions(): { label: string, action: () => void }[] {
        return Array.from(this.actions.entries()).map(([label, action]) => ({ label, action }));
    }

}