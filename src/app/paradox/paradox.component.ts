import { animate, keyframes, state, style, transition, trigger } from '@angular/animations';
import { AsyncPipe } from '@angular/common';
import { AfterViewInit, Component, inject, OnDestroy, Renderer2, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { map } from 'rxjs';
import { DiscordAuthenticationService } from '../../services/discord-auth.service';
import { SideNavContentProvider } from '../../ui/SideNavContentProvider';
import { DiscordLoginComponent } from '../discord-login/discord-login.component';

@Component({
    selector: 'app-paradox',
    imports: [AsyncPipe, MatToolbarModule, MatButtonModule, MatIconModule, MatSidenavModule, MatDividerModule, MatTooltipModule, MatMenuModule, RouterModule, DiscordLoginComponent],
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
export class ParadoxComponent implements OnDestroy, AfterViewInit {
    @ViewChild('drawer') drawer!: MatDrawer;

    isDarkMode = true;
    currentTheme: 'day' | 'night' = this.isDarkMode ? 'night' : 'day';

    protected sideNavContentProvider = inject(SideNavContentProvider);
    protected renderer = inject(Renderer2);
    protected router = inject(Router);
    protected activatedRoute = inject(ActivatedRoute);
    protected authService = inject(DiscordAuthenticationService);
    
    currentRoute: string = '';

    navMenus = [
        {
            label: 'Save',
            items: [
                { label: 'Analyzer', path: 'save', icon: 'file_open' },
            ]
        },
        {
            label: 'Campaigns',
            items: [
                { label: 'Overview', path: 'mc', icon: 'menu_book' },
                { label: 'Power Bloc Helper', path: 'bloc', icon: 'diversity_3' },
                { label: 'Stonks', path: 'stonks', icon: 'insights' },
                { label: 'Administration', path: 'mc/admin', icon: 'admin_panel_settings' },
                { label: 'Modding', path: 'mc/modder', icon: 'build_circle' },
            ]
        },
        {
            label: 'Tools',
            items: [
                { label: 'Vic3 Resource Map', path: 'map', icon: 'map' },
                { label: 'Parser Kiosk', path: 'jomini', icon: 'data_object' },
                { label: 'File Administration', path: 'db', icon: 'database' }
            ]
        }
    ];

    constructor() {
        this.router.events.subscribe(() => {
            this.currentRoute = this.router.url.split('?')[0] || '';
        });
    }

    ngAfterViewInit(): void {
        
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

    toolbarActionsArray$ = this.sideNavContentProvider.toolbarActions$.pipe(
        map(actions => {
            actions.forEach(action => {
                if (!this.hasSeenAction(action.id)) {
                    this.triggerNewActionAnimation(action.id);
                    this.markActionAsSeen(action.id);
                }
            });
            return actions;
        })
    );

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

    openGitHubRepository(): void {
        window.open('https://github.com/phinfire/pdx-map', '_blank');
    }

    openDiscordServer(): void {
        window.open('https://discord.gg/38Y8pPxBmD', '_blank');
    }

    ngOnDestroy(): void {
        this.animationTimeouts.forEach(timeout => clearTimeout(timeout));
        this.animationTimeouts.clear();
    }

    navigate(path: string): void {
        this.router.navigate([path], { relativeTo: this.activatedRoute });
    }

    isActiveRoute(path: string): boolean {
        return this.currentRoute === '/' + path || this.currentRoute === path;
    }
}