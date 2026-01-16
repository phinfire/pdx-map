import { Component, ElementRef, EventEmitter, Input, NgZone, Output, SimpleChanges, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as THREE from 'three';
import { BehaviorConfigProvider } from './BehaviorConfigProvider';
import { CameraMovementManager } from './CameraMovementManager';
import { ColorConfigProvider } from './ColorConfigProvider';
import { CustomButton } from './CustomButton';
import { TooltipManager } from './TooltipManager';

@Component({
    selector: 'app-polygon-select',
    imports: [MatIconModule, MatProgressSpinnerModule],
    templateUrl: './polygon-select.component.html',
    styleUrl: './polygon-select.component.scss'
})
export class PolygonSelectComponent {

    @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef;

    @Input() clearColor = 0x000000;
    @Input() colorConfigProviders: ColorConfigProvider[] = [];
    colorConfigProvider: ColorConfigProvider | null = null;
    @Input() selectionCallback: (key: string, locked: boolean) => void = (key: string, locked: boolean) => {
        console.log("No callback provided");
    };
    @Input() meshBuddiesProvider: (key: string) => string[] = (key: string) => [key];
    @Input() tooltipProvider: (key: string) => string = (key: string) => key;
    @Input() customButtons: CustomButton[] = [];
    @Output() buttonClicked = new EventEmitter<CustomButton>();

    private readonly LIGHT_INTENSITY = 3;
    private readonly RAYCAST_THROTTLE_MS = 16;
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private lastRaycastTime = 0;
    private isLeftMouseDown = false;
    private lastHoveredMesh: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string }) | null = null;
    private lastHoveredBuddies: Set<string> = new Set();
    private needsRaycast = false;

    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private animationId!: number;
    private polygons: Map<string, THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string }> = new Map();
    private resizeObserver!: ResizeObserver;
    private isRendererInitialized = false;
    private isLaunched = false;
    private pendingMeshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[] = [];
    private resizeTimeout: number | null = null;

    protected tooltipManager = new TooltipManager();
    private cameraMovementManager: CameraMovementManager | null = null;

    public cameraHeight = 400;
    public zoomToCursor = true;
    private liftConfig = new BehaviorConfigProvider(2);

    private colorConfigProviderIndex: number = 0;
    private lockedKeysWaitingForMeshes: Set<string> = new Set();

    constructor(private ngZone: NgZone) {
        this.tooltipManager.toggleTooltipEnabled();
    }

    public fitCameraToPolygons(margin: number) {
        if (!this.polygons.size || !this.cameraMovementManager) return;
        const box = new THREE.Box3();
        this.polygons.forEach(poly => box.expandByObject(poly));
        this.cameraMovementManager.fitCameraToBox(box, margin);
    }

    exportMapImage() {
        if (!this.renderer || !this.scene || !this.camera) {
            alert('Renderer not initialized. Please wait for the map to load.');
            return;
        }
        const url = window.location.pathname || window.location.href;
        const sanitizedUrl = url.replace(/[^a-zA-Z0-9-_]/g, '_');
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const finalFilename = `screenshot_${sanitizedUrl}_${timestamp}`;
        let multiplierStr = prompt('Enter resolution multiplier (e.g. 2 for 2x, 4 for 4x):', '2');
        if (multiplierStr === null) {
            return;
        }
        let multiplier = parseInt(multiplierStr, 10);
        if (isNaN(multiplier) || multiplier < 1) {
            return;
        }
        const container = this.containerRef.nativeElement;
        const origWidth = container.clientWidth;
        const origHeight = container.clientHeight;
        this.renderer.setSize(origWidth * multiplier, origHeight * multiplier, false);
        this.camera.aspect = (origWidth * multiplier) / (origHeight * multiplier);
        this.camera.updateProjectionMatrix();
        this.renderer.render(this.scene, this.camera);
        this.renderer.domElement.toBlob((blob) => {
            this.renderer.setSize(origWidth, origHeight, false);
            this.camera.aspect = origWidth / origHeight;
            this.camera.updateProjectionMatrix();
            if (blob) {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `${finalFilename}.png`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            } else {
                alert('Failed to export image. Please try again.');
            }
        }, 'image/png');
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['colorConfigProviders']) {
            this.colorConfigProvider = this.colorConfigProviders[0];
            for (const poly of this.polygons.values()) {
                this.refreshPolyColor(poly);
            }
        }
        if (changes['clearColor'] && this.renderer) {
            this.renderer.setClearColor(this.clearColor);
        }
    }

    public launch(meshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[], colorConfigProviders: ColorConfigProvider[], liftConfig: BehaviorConfigProvider = this.liftConfig) {
        if (this.isLaunched) {
            return;
        }
        this.liftConfig = liftConfig;
        this.isLaunched = true;
        if (colorConfigProviders.length > 0) {
            this.colorConfigProviders = colorConfigProviders;
            this.colorConfigProvider = colorConfigProviders[0];
        }
        if (!this.isRendererInitialized) {
            this.initScene();
        }
        this.setMeshes(meshes);
        setTimeout(() => {
            this.handleResize();
            this.fitCameraToPolygons(0.1);
        }, 100);
        setTimeout(() => {
            this.handleResize();
        }, 500);
    }

    public isReady(): boolean {
        return this.isLaunched && this.isRendererInitialized && this.polygons.size > 0;
    }

    public setMeshes(meshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[]) {
        if (!this.isLaunched) {
            this.pendingMeshes = [...meshes];
            return;
        }
        if (this.polygons.size !== 0) {
            return;
        }
        if (!this.isRendererInitialized || !this.scene) {
            this.pendingMeshes = [...meshes];
            return;
        }

        this.scene.add(...meshes);
        meshes.forEach(mesh => {
            if (mesh.interactive === undefined) {
                mesh.interactive = true;
            }
            mesh.locked = false;
            mesh.targetZ = 0;
            this.polygons.set(mesh.key, mesh);
            this.refreshPolyColor(mesh);
        });
        const waitingKeys = Array.from(this.lockedKeysWaitingForMeshes);
        this.lockedKeysWaitingForMeshes.clear();
        for (const key of waitingKeys) {
            this.setLockedState(key, true, false);
        }
    }

    public removeMesh(key: string) {
        const mesh = this.polygons.get(key);
        if (mesh) {
            this.scene.remove(mesh);
            this.polygons.delete(key);
            if (this.lastHoveredMesh === mesh) {
                this.lastHoveredMesh = null;
            }
        }
    }

    public clearMeshes() {
        this.polygons.forEach(mesh => {
            this.scene.remove(mesh);
        });
        this.polygons.clear();
        this.lastHoveredMesh = null;
        this.lastHoveredBuddies.clear();
        this.pendingMeshes = [];
    }

    ngOnInit(): void {
        this.setupResizeObserver();
        window.addEventListener('click', this.onClick);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        this.containerRef.nativeElement.addEventListener('mousemove', this.onMouseMoveForRaycasting);
        this.containerRef.nativeElement.addEventListener('mouseleave', () => {
            this.tooltipManager.setTooltipVisibility(false);
        });
        this.animate();
    }

    ngOnDestroy(): void {
        window.removeEventListener('click', this.onClick);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.containerRef.nativeElement.removeEventListener('mousemove', this.onMouseMoveForRaycasting);
        cancelAnimationFrame(this.animationId);
        if (this.cameraMovementManager) {
            this.cameraMovementManager.destroy();
        }
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }

    private initScene() {
        const container = this.containerRef.nativeElement;
        if (container.clientWidth === 0 || container.clientHeight === 0) {
            this.ngZone.runOutsideAngular(() => {
                setTimeout(() => this.initScene(), 100);
            });
            return;
        }
        if (this.isRendererInitialized) {
            return;
        }

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 0.1, 1500);
        this.camera.position.set(0, -5, this.cameraHeight);
        this.camera.lookAt(0, 0, 0);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setClearColor(this.clearColor);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        const light = new THREE.DirectionalLight(0xffffff, this.LIGHT_INTENSITY);
        light.position.set(50, 50, 100);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        this.scene.rotation.x = -0.5;
        this.isRendererInitialized = true;

        // Initialize camera movement manager
        this.cameraMovementManager = new CameraMovementManager(this.camera, container, true, true, true, false);
        this.cameraMovementManager.zoomToCursor = this.zoomToCursor;
        this.cameraMovementManager.cameraHeight = this.cameraHeight;

        if (this.pendingMeshes.length > 0) {
            this.scene.add(...this.pendingMeshes);
            this.pendingMeshes.forEach(mesh => {
                this.polygons.set(mesh.key, mesh);
            });
            this.pendingMeshes = [];
        }
    }

    public toggleColorConfigProvider() {
        if (this.colorConfigProviders.length <= 1) return;
        this.colorConfigProviderIndex = (this.colorConfigProviderIndex + 1) % this.colorConfigProviders.length;
        this.colorConfigProvider = this.colorConfigProviders[this.colorConfigProviderIndex];
        for (const poly of this.polygons.values()) {
            this.refreshPolyColor(poly);
        }
    }

    // TODO: highly suspicious vibecode
    private setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver((entries) => {
                if (this.resizeTimeout) {
                    clearTimeout(this.resizeTimeout);
                }
                this.resizeTimeout = window.setTimeout(() => {
                    requestAnimationFrame(() => {
                        for (const entry of entries) {
                            this.handleResize();
                        }
                        this.resizeTimeout = null;
                    });
                }, 16);
            });
            this.resizeObserver.observe(this.containerRef.nativeElement);
        }
    }

    public handleResize() {
        const container = this.containerRef.nativeElement;
        if (this.renderer && this.camera && container.clientWidth > 0 && container.clientHeight > 0) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        } else if (!this.isRendererInitialized && container.clientWidth > 0 && container.clientHeight > 0) {
            this.initScene();
        }
    }

    private onMouseMoveForRaycasting = (event: MouseEvent) => {
        const container = this.containerRef.nativeElement;
        this.tooltipManager.updateMousePosition(event.clientX, event.clientY);
        const isOverButton = (event.target as Element).closest('.button-group, .corner-button');
        if (isOverButton) {
            this.tooltipManager.setTooltipVisibility(false);
            return;
        }

        this.tooltipManager.updateTooltipPosition();

        const rect = container.getBoundingClientRect();
        const newMouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        const newMouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

        if (Math.abs(this.mouse.x - newMouseX) > 0.001 || Math.abs(this.mouse.y - newMouseY) > 0.001) {
            this.mouse.x = newMouseX;
            this.mouse.y = newMouseY;
            const now = performance.now();
            if (now - this.lastRaycastTime >= this.RAYCAST_THROTTLE_MS) {
                this.needsRaycast = true;
                this.lastRaycastTime = now;
            }
        }
    };

    private onMouseDown = (event: MouseEvent) => {
        if (event.button === 0) {
            this.isLeftMouseDown = true;
        }
    };

    private onMouseUp = (event: MouseEvent) => {
        if (event.button === 0) {
            this.isLeftMouseDown = false;
        }
    };

    private onClick = (event: MouseEvent) => {
        const container = this.containerRef.nativeElement;
        if (!container.contains(event.target as Node)) {
            return;
        }
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(Array.from(this.polygons.values()));
        if (intersects.length > 0) {
            const polygon = intersects[0].object as THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string };
            if (polygon.interactive) {
                this.setLockedState(polygon.key, !polygon.locked, true);
                this.needsRaycast = true;
            }
        }
    };

    private animate = () => {
        this.animationId = requestAnimationFrame(this.animate);
        if (this.needsRaycast && this.camera) {
            this.needsRaycast = false;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(Array.from(this.polygons.values()));
            if (intersects.length > 0) {
                const polygon = intersects[0].object as THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string };
                if (polygon.interactive && this.lastHoveredMesh !== polygon) {
                    this.setHovered(polygon);
                } else if (!polygon.interactive && this.lastHoveredMesh) {
                    this.setHovered(null);
                }
            } else if (this.lastHoveredMesh) {
                this.setHovered(null);
            }
        }
        this.polygons.forEach(poly => {
            if (poly.targetZ !== undefined) {
                poly.position.z += (poly.targetZ - poly.position.z) * this.liftConfig.getLiftSpeed();
            }
        });

        if (this.isRendererInitialized && this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    };

    refreshButtonClicked() {
        this.polygons.forEach(poly => {
            this.applyLockedEffects(poly, false);
            this.selectionCallback(poly.key, false);
        });
    }

    private applyLockedEffects(mesh: THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string }, isLocked: boolean) {
        if (!mesh.interactive) return;
        mesh.locked = isLocked;
        mesh.targetZ = this.liftConfig.getTargetZ(isLocked, false);
        this.refreshPolyColor(mesh);
    }

    private applyHoverEffects(mesh: THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string }, isHovered: boolean) {
        if (!mesh.interactive) return;
        mesh.targetZ = this.liftConfig.getTargetZ(mesh.locked ?? false, isHovered);
        this.refreshPolyColor(mesh);
    }

    setHovered(currentlyHovered: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string }) | null) {
        const localLastHoveredMesh = this.lastHoveredMesh;
        const localLastHoveredBuddies = new Set(this.lastHoveredBuddies);

        this.lastHoveredMesh = currentlyHovered;
        this.lastHoveredBuddies.clear();

        if (localLastHoveredMesh != null) {
            this.applyHoverEffects(localLastHoveredMesh, false);
        }
        localLastHoveredBuddies.forEach(buddyKey => {
            const buddyMesh = this.polygons.get(buddyKey);
            if (buddyMesh && buddyMesh !== localLastHoveredMesh) {
                this.applyHoverEffects(buddyMesh, false);
            }
        });

        if (currentlyHovered != null) {
            this.applyHoverEffects(currentlyHovered, true);

            const buddyKeys = this.meshBuddiesProvider(currentlyHovered.key);
            buddyKeys.forEach(buddyKey => {
                if (buddyKey !== currentlyHovered.key) {
                    this.lastHoveredBuddies.add(buddyKey);
                    const buddyMesh = this.polygons.get(buddyKey);
                    if (buddyMesh) {
                        this.applyHoverEffects(buddyMesh, true);
                    }
                }
            });
        }

        if (currentlyHovered && currentlyHovered.interactive) {
            this.showTooltip(currentlyHovered.key);
        } else {
            this.hideTooltip();
        }
    }

    private showTooltip(key: string) {
        const content = this.tooltipProvider(key);
        this.tooltipManager.setTooltipContent(content);
        this.tooltipManager.setTooltipVisibility(true);
    }

    private hideTooltip() {
        this.tooltipManager.setTooltipVisibility(false);
    }

    public toggleTooltips() {
        this.tooltipManager.toggleTooltipEnabled();
    }


    refreshAllColors() {
        this.polygons.forEach(polygon => {
            this.refreshPolyColor(polygon);
        });
    }

    refreshPolyColor(polygon: THREE.Mesh & { key: string, interactive?: boolean, locked?: boolean }) {
        if (this.colorConfigProvider) {
            const interactive = polygon.interactive ?? false;
            const hover = this.lastHoveredMesh === polygon || this.lastHoveredBuddies.has(polygon.key);
            const locked = polygon.locked ?? false;
            const color = this.colorConfigProvider.getColor(polygon.key, interactive, hover, locked);
            (polygon.material as THREE.MeshPhongMaterial).color.set(color);
        }
    }

    public setLockedStates(keys: string[], locked: boolean, triggerCallback: boolean = true) {
        keys.forEach(key => {
            this.setLockedState(key, locked, triggerCallback);
        });
    }

    public setLockedState(key: string, locked: boolean, triggerCallback: boolean) {
        const poly = this.polygons.get(key);
        if (!poly) {
            console.warn(`No polygon found for key ${key}. Storing locked state for later.`);
            this.lockedKeysWaitingForMeshes.add(key);
            return;
        }
        this.applyLockedEffects(poly, locked);
        const buddyKeys = this.meshBuddiesProvider(key);
        buddyKeys.forEach(buddyKey => {
            if (buddyKey !== key) {
                const buddyMesh = this.polygons.get(buddyKey);
                if (buddyMesh) {
                    this.applyLockedEffects(buddyMesh, locked);
                    if (triggerCallback) {
                        this.selectionCallback(buddyMesh.key, locked);
                    }
                }
            }
        });
        if (triggerCallback) {
            this.selectionCallback(poly.key, locked);
        }
    }
}