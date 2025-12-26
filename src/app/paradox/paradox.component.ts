import { Component, inject, Renderer2, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SideNavContentProvider } from '../SideNavContentProvider';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { trigger, state, style, transition, animate, keyframes } from '@angular/animations';

@Component({
    selector: 'app-paradox',
    imports: [MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, MatDividerModule, MatTooltipModule, RouterModule],
    templateUrl: './paradox.component.html',
    styleUrl: './paradox.component.scss',
    animations: [
        trigger('newActionAlert', [
            state('normal', style({
                transform: 'scale(1)',
                backgroundColor: 'transparent',
                boxShadow: 'none'
            })),
            state('flashing', style({
                transform: 'scale(1.1)',
                backgroundColor: 'rgba(255, 215, 0, 0.6)',
                boxShadow: '0 0 8px rgba(255, 215, 0, 0.8)'
            })),
            state('pulsing', style({
                transform: 'scale(1)',
                backgroundColor: 'transparent',
                boxShadow: '0 0 0 2px rgba(255, 215, 0, 0.5)'
            })),
            transition('normal => flashing', [
                animate('300ms ease-in', keyframes([
                    style({ transform: 'scale(1)', backgroundColor: 'transparent', offset: 0 }),
                    style({ transform: 'scale(1.05)', backgroundColor: 'rgba(255, 215, 0, 0.3)', offset: 0.5 }),
                    style({ transform: 'scale(1.1)', backgroundColor: 'rgba(255, 215, 0, 0.6)', offset: 1 })
                ]))
            ]),
            transition('flashing => pulsing', [
                animate('500ms ease-out', style({
                    transform: 'scale(1)',
                    backgroundColor: 'transparent',
                    boxShadow: '0 0 0 2px rgba(255, 215, 0, 0.5)'
                }))
            ]),
            transition('pulsing => normal', [
                animate('800ms ease-out', style({
                    transform: 'scale(1)',
                    backgroundColor: 'transparent',
                    boxShadow: 'none'
                }))
            ]),
            transition('* => normal', [
                animate('300ms ease-out', style({
                    transform: 'scale(1)',
                    backgroundColor: 'transparent',
                    boxShadow: 'none'
                }))
            ])
        ])
    ]
})
export class ParadoxComponent implements OnDestroy {
    isDarkMode = true;
    currentTheme: 'day' | 'night' = this.isDarkMode ? 'night' : 'day';

    protected sideNavContentProvider = inject(SideNavContentProvider);
    protected renderer = inject(Renderer2);
    protected router = inject(Router);
    protected activatedRoute = inject(ActivatedRoute);

    currentRoute: string = '';

    constructor() {
        this.router.events.subscribe(() => {
            this.currentRoute = this.router.url.split('?')[0] || '';
        });
    }

    setTheme(darkMode: boolean) {
        this.isDarkMode = darkMode;
        if (this.isDarkMode) {
            this.renderer.removeClass(document.body, 'light-theme');
        } else {
            this.renderer.addClass(document.body, 'light-theme');
        }
    }

    toggleAnimation(theme: 'day' | 'night'): void {
        this.currentTheme = theme;
    }

    private actionAnimationStates = new Map<string, 'normal' | 'flashing' | 'pulsing'>();
    private seenActionIds = new Set<string>();
    private animationTimeouts = new Map<string, any>();

    getToolbarActionsArray() {
        const actions = Array.from(this.sideNavContentProvider.getToolbarActions().entries())
            .map(([id, action]) => ({ ...action, id }));
        actions.forEach(action => {
            if (!this.hasSeenAction(action.id)) {
                this.triggerNewActionAnimation(action.id);
                this.markActionAsSeen(action.id);
            }
        });
        return actions;
    }

    getToolbarLabel(): string | null {
        return this.sideNavContentProvider.getToolbarLabel();
    }

    trackByActionId(index: number, action: any): string {
        return action.id;
    }

    getAnimationState(actionId: string): string {
        return this.actionAnimationStates.get(actionId) || 'normal';
    }

    onActionClick(action: any): void {
        action.action();
        this.setAnimationState(action.id, 'normal');
        this.clearAnimationTimeout(action.id);
    }

    onAnimationDone(event: any, actionId: string): void {
        const currentState = this.actionAnimationStates.get(actionId);
        if (currentState === 'flashing') {
            this.setAnimationState(actionId, 'pulsing');
            this.setAnimationTimeout(actionId, () => {
                this.setAnimationState(actionId, 'normal');
            }, 3000);
        }
    }

    private triggerNewActionAnimation(actionId: string): void {
        this.setAnimationState(actionId, 'flashing');
    }

    private setAnimationState(actionId: string, state: 'normal' | 'flashing' | 'pulsing'): void {
        this.actionAnimationStates.set(actionId, state);
    }

    private setAnimationTimeout(actionId: string, callback: () => void, delay: number): void {
        this.clearAnimationTimeout(actionId);
        const timeout = setTimeout(callback, delay);
        this.animationTimeouts.set(actionId, timeout);
    }

    private clearAnimationTimeout(actionId: string): void {
        const timeout = this.animationTimeouts.get(actionId);
        if (timeout) {
            clearTimeout(timeout);
            this.animationTimeouts.delete(actionId);
        }
    }

    private hasSeenAction(actionId: string): boolean {
        return this.seenActionIds.has(actionId);
    }

    private markActionAsSeen(actionId: string): void {
        this.seenActionIds.add(actionId);
    }

    ngOnDestroy(): void {
        this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this.animationTimeouts.clear();
    }

    // Navigation methods
    navigate(path: string): void {
        this.router.navigate([path]);
    }

    isActiveRoute(path: string): boolean {
        return this.currentRoute === '/' + path || this.currentRoute === path;
    }
}