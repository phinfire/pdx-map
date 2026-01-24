import { Injectable } from "@angular/core";
import { BehaviorSubject, Subject } from "rxjs";

@Injectable({
    providedIn: 'root'
})
export class SideNavContentProvider {

    private handleCounter = 0;
    private actionsSubject = new BehaviorSubject<{ label: string, action: () => void }[]>([]);
    actions$ = this.actionsSubject.asObservable();
    
    private toolbarActionsSubject = new BehaviorSubject<Array<{ id: string, icon: string, tooltip: string, action: () => void, positionFloatWeight: number }>>([]);
    toolbarActions$ = this.toolbarActionsSubject.asObservable();
    
    private toolbarLabel: string | null = null;

    constructor() {
    }
    
    addAction(label: string, action: () => void) {
        const currentActions = this.actionsSubject.value;
        const newActions = [...currentActions, { label, action }];
        this.actionsSubject.next(newActions);
    }

    removeAction(label: string) {
        const currentActions = this.actionsSubject.value;
        const newActions = currentActions.filter(item => item.label !== label);
        this.actionsSubject.next(newActions);
    }

    clearActions() {
        this.actionsSubject.next([]);
    }

    addToolbarAction(icon: string, tooltip: string, action: () => void, positionFloatWeight: number = 0) {
        const id = `action-${this.handleCounter++}`;
        const currentActions = this.toolbarActionsSubject.value;
        const newActions = [...currentActions, { id, icon, tooltip, action, positionFloatWeight }];
        newActions.sort((a, b) => a.positionFloatWeight - b.positionFloatWeight);
        this.toolbarActionsSubject.next(newActions);
        return id;
    }

    removeToolbarAction(handle: string) {
        const currentActions = this.toolbarActionsSubject.value;
        const newActions = currentActions.filter(item => item.id !== handle);
        this.toolbarActionsSubject.next(newActions);
    }

    clearToolbarActions() {
        this.toolbarActionsSubject.next([]);
    }

}