import { Injectable } from "@angular/core";

@Injectable({
    providedIn: 'root'
})
export class SideNavContentProvider {

    private handleCounter = 0;
    private actions: Map<string, () => void> = new Map();
    private toolbarActions: Array<{ id: string, icon: string, tooltip: string, action: () => void, positionFloatWeight: number }> = [];
    private toolbarLabel: string | null = null;

    constructor() {
    }
    
    getActions(): { label: string, action: () => void }[] {
        return Array.from(this.actions.entries()).map(([label, action]) => ({ label, action }));
    }

    getToolbarActions(): Array<{ id: string, icon: string, tooltip: string, action: () => void, positionFloatWeight: number }> {
        return this.toolbarActions;
    }

    addToolbarAction(icon: string, tooltip: string, action: () => void, positionFloatWeight: number = 0) {
        const id = `action-${this.handleCounter++}`;
        this.toolbarActions.push({ id, icon, tooltip, action , positionFloatWeight });
        this.toolbarActions.sort((a, b) => a.positionFloatWeight - b.positionFloatWeight);
        return id;
    }

    removeToolbarAction(handle: string) {
        this.toolbarActions = this.toolbarActions.filter(item => item.id !== handle);
    }

    clearToolbarActions() {
        this.toolbarActions = [];
    }

    getToolbarLabel(): string | null {
        return this.toolbarLabel;
    }

    setToolbarLabel(text: string) {
        this.toolbarLabel = text;
    }

    clearToolbarLabel() {
        this.toolbarLabel = null;
    }
}