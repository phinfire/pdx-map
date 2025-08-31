import { Component, ElementRef, Input, SimpleChanges, ViewChild, NgZone, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RendererConfigProvider } from './RendererConfigProvider';

@Component({
    selector: 'app-polygon-select',
    imports: [MatIconModule, MatProgressSpinnerModule],
    templateUrl: './polygon-select.component.html',
    styleUrl: './polygon-select.component.scss'
})
export class PolygonSelectComponent implements AfterViewInit {

    private static readonly TOOLTIP_MODE_LOCAL_STORAGE_KEY = 'tooltipMode';

    @ViewChild('rendererContainer', { static: true }) containerRef!: ElementRef;

    @Input() rendererConfigProvider: RendererConfigProvider | null = null;
    @Input() selectionCallback: (key: string, locked: boolean) => void = (key: string, locked: boolean) => {
        console.log("No callback provided");
    };
    @Input() meshBuddiesProvider: (key: string) => string[] = (key: string) => [key];
    @Input() tooltipProvider: (key: string) => string = (key: string) => key;

    private readonly ALLOW_DRAG_SELECTION = false;
    private readonly LIGHT_INTENSITY = 3;
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private isMiddleMouseDown = false;
    private isLeftMouseDown = false;
    private lastMousePos: { x: number, y: number } | null = null;
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
    private pendingMeshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[] = [];

    public tooltipVisible = false;
    public tooltipText = '';
    public tooltipX = 0;
    public tooltipY = 0;
    private currentMouseX = 0;
    private currentMouseY = 0;
    public tooltipEnabled = true;
    public tooltipAbove = false;

    public cameraHeight = 400;
    public zoomToCursor = true;
    private readonly LOCKED_HEIGHT = 2;
    private readonly LIFT_HEIGHT = 0.75 * this.LOCKED_HEIGHT;
    private readonly LOCKED_HOVER_HEIGHT = 0.75 * this.LOCKED_HEIGHT;
    private readonly LIFT_SPEED = 0.5;

    constructor(private ngZone: NgZone) {
        this.tooltipEnabled = !(localStorage.getItem(PolygonSelectComponent.TOOLTIP_MODE_LOCAL_STORAGE_KEY) == 'false');
    }

    public forceResize() {
        this.handleResize();
    }

    public reinitialize() {
        this.isRendererInitialized = false;
        this.pendingMeshes = [];
        this.initScene();
    }

    public fitCameraToPolygons(margin: number) {
        if (!this.polygons.size) return;
        const box = new THREE.Box3();
        this.polygons.forEach(poly => box.expandByObject(poly));
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const container = this.containerRef.nativeElement;
        const aspect = container.clientWidth / container.clientHeight;
        const fov = this.camera.fov * (Math.PI / 180);
        const width = size.x * (1 + margin);
        const height = size.y * (1 + margin);
        const depth = size.z * (1 + margin);
        const rotatedHeight = Math.sqrt(height * height + depth * depth);
        const distanceForHeight = rotatedHeight / (2 * Math.tan(fov / 2));
        const distanceForWidth = width / (2 * Math.tan(fov / 2) * aspect);
        const distance = Math.max(distanceForHeight, distanceForWidth) * 1.1;
        this.camera.position.set(center.x, center.y - distance * 0.1, distance + center.z);
        this.camera.lookAt(center.x, center.y, center.z);
        this.camera.updateProjectionMatrix();
    }

    storeCurrentLockSelectionToFile() {
        const lockedPolygons = Array.from(this.polygons.values()).filter(poly => poly.locked);
        if (lockedPolygons.length === 0) {
            alert('No polygons are currently locked to save.');
            return;
        }

        const filename = prompt('Enter a filename for the selection:', 'locked_polygons');
        if (filename === null) {
            return;
        }

        const finalFilename = filename.trim() || 'locked_polygons';
        const data = JSON.stringify(lockedPolygons.map(poly => poly.key));
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${finalFilename}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    loadSelectionFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.onchange = (e: any) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event: ProgressEvent<FileReader>) => {
                try {
                    const keys = JSON.parse(event.target?.result as string);
                    this.setLockedStates(keys, true);
                } catch (err) {
                    console.error('Failed to parse JSON:', err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    exportMapImage() {
        if (!this.renderer || !this.scene || !this.camera) {
            alert('Renderer not initialized. Please wait for the map to load.');
            return;
        }
        const filename = prompt('Enter filename for map export:', 'map-export');
        if (filename === null) {
            return;
        }
        const finalFilename = filename.trim() || 'map-export';
        this.renderer.render(this.scene, this.camera);
        this.renderer.domElement.toBlob((blob) => {
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
        if (changes['rendererConfigProvider']) {
            for (const poly of this.polygons.values()) {
                this.refreshPolyColor(poly);
            }
        }
    }

    public setMeshes(meshes: (THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string })[]) {
        if (!this.isRendererInitialized || !this.scene) {
            this.pendingMeshes = [...meshes];
            return;
        }

        this.scene.add(...meshes);
        meshes.forEach(mesh => {
            this.polygons.set(mesh.key, mesh);
        });
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
        window.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mousedown', this.onMouseDown);
        window.addEventListener('mouseup', this.onMouseUp);
        window.addEventListener('wheel', this.onWheel, { passive: false });
        window.addEventListener('click', this.onClick);
        this.animate();
    }

    ngAfterViewInit(): void {
        this.ngZone.runOutsideAngular(() => {
            setTimeout(() => {
                this.initScene();
            }, 0);
        });
    }

    ngOnDestroy(): void {
        window.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mousedown', this.onMouseDown);
        window.removeEventListener('mouseup', this.onMouseUp);
        window.removeEventListener('wheel', this.onWheel);
        window.removeEventListener('click', this.onClick);
        cancelAnimationFrame(this.animationId);

        this.hideTooltip();

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
        this.renderer.setClearColor(this.rendererConfigProvider!.getClearColor());
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        const light = new THREE.DirectionalLight(0xffffff, this.LIGHT_INTENSITY);
        light.position.set(50, 50, 100);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        this.scene.rotation.x = -0.5;
        this.isRendererInitialized = true;

        if (this.pendingMeshes.length > 0) {
            this.scene.add(...this.pendingMeshes);
            this.pendingMeshes.forEach(mesh => {
                this.polygons.set(mesh.key, mesh);
            });
            this.pendingMeshes = [];
        }
    }

    private setupResizeObserver() {
        if (typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    this.handleResize();
                }
            });
            this.resizeObserver.observe(this.containerRef.nativeElement);
        }
    }

    private handleResize() {
        const container = this.containerRef.nativeElement;
        if (this.renderer && this.camera && container.clientWidth > 0 && container.clientHeight > 0) {
            this.camera.aspect = container.clientWidth / container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(container.clientWidth, container.clientHeight);
        } else if (!this.isRendererInitialized && container.clientWidth > 0 && container.clientHeight > 0) {
            this.initScene();
        }
    }

    private onMouseMove = (event: MouseEvent) => {
        const container = this.containerRef.nativeElement;

        this.currentMouseX = event.clientX;
        this.currentMouseY = event.clientY;

        if (this.isMiddleMouseDown && this.lastMousePos) {
            const dx = event.clientX - this.lastMousePos.x;
            const dy = event.clientY - this.lastMousePos.y;
            const speed = 0.2 * (this.camera.position.z / this.cameraHeight);
            this.camera.position.x -= dx * speed;
            this.camera.position.y += dy * speed;
            this.lastMousePos = { x: event.clientX, y: event.clientY };
        }
        if (container.contains(event.target as Node)) {
            const rect = container.getBoundingClientRect();
            const newMouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
            const newMouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

            this.updateTooltipPosition();

            if (Math.abs(this.mouse.x - newMouseX) > 0.001 || Math.abs(this.mouse.y - newMouseY) > 0.001) {
                this.mouse.x = newMouseX;
                this.mouse.y = newMouseY;
                this.needsRaycast = true;
            }
            if (this.ALLOW_DRAG_SELECTION) {
                if (this.isLeftMouseDown) {
                    this.raycaster.setFromCamera(this.mouse, this.camera);
                    const intersects = this.raycaster.intersectObjects(Array.from(this.polygons.values()));
                    if (intersects.length > 0) {
                        const polygon = intersects[0].object as THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string };
                        if (!polygon.locked && polygon.interactive) {
                            polygon.locked = true;
                            polygon.targetZ = this.LOCKED_HEIGHT;
                            this.refreshPolyColor(polygon);
                            this.selectionCallback(polygon.key, true);
                        }
                    }
                }
            }
        }
    };

    private onMouseDown = (event: MouseEvent) => {
        if (event.button === 1) {
            this.isMiddleMouseDown = true;
            this.lastMousePos = { x: event.clientX, y: event.clientY };
            event.preventDefault();
        }
        if (event.button === 0) {
            this.isLeftMouseDown = true;
        }
    };

    private onMouseUp = (event: MouseEvent) => {
        if (event.button === 1) {
            this.isMiddleMouseDown = false;
            this.lastMousePos = null;
            event.preventDefault();
        }
        if (event.button === 0) {
            this.isLeftMouseDown = false;
        }
    };

    private onWheel = (event: WheelEvent) => {
        const container = this.containerRef.nativeElement;
        if (container.contains(event.target as Node)) {
            const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
            const oldZ = this.camera.position.z;
            const newZ = Math.max(10, Math.min(1000, oldZ * zoomFactor));

            if (this.zoomToCursor) {
                const rect = container.getBoundingClientRect();
                const mouseX = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
                const mouseY = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
                const fov = this.camera.fov * (Math.PI / 180);
                const aspect = container.clientWidth / container.clientHeight;
                const height = 2 * Math.tan(fov / 2) * oldZ;
                const width = height * aspect;
                const worldMouseX = mouseX * width / 2;
                const worldMouseY = mouseY * height / 2;
                const zoomRatio = (oldZ - newZ) / oldZ;
                this.camera.position.x += worldMouseX * zoomRatio;
                this.camera.position.y += worldMouseY * zoomRatio;
            }

            this.camera.position.z = newZ;
            event.preventDefault();
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
                poly.position.z += (poly.targetZ - poly.position.z) * this.LIFT_SPEED;
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

        if (isLocked) {
            if (this.lastHoveredMesh === mesh || this.lastHoveredBuddies.has(mesh.key)) {
                mesh.targetZ = this.LOCKED_HOVER_HEIGHT;
            } else {
                mesh.targetZ = this.LOCKED_HEIGHT;
            }
        } else {
            if (this.lastHoveredMesh === mesh || this.lastHoveredBuddies.has(mesh.key)) {
                mesh.targetZ = this.LIFT_HEIGHT;
            } else {
                mesh.targetZ = 0;
            }
        }

        this.refreshPolyColor(mesh);
    }

    private applyHoverEffects(mesh: THREE.Mesh & { targetZ?: number, locked?: boolean, interactive?: boolean, key: string }, isHovered: boolean) {
        if (!mesh.interactive) return;

        if (isHovered) {
            if (!mesh.locked) {
                mesh.targetZ = this.LIFT_HEIGHT;
            } else {
                mesh.targetZ = this.LOCKED_HOVER_HEIGHT;
            }
        } else {
            if (!mesh.locked) {
                mesh.targetZ = 0;
            } else {
                mesh.targetZ = this.LOCKED_HEIGHT;
            }
        }

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
        if (!this.tooltipEnabled) return;

        this.tooltipText = this.tooltipProvider(key);
        this.tooltipVisible = true;
        this.updateTooltipPosition();
    }

    private hideTooltip() {
        this.tooltipVisible = false;
    }

    public toggleTooltips() {
        this.tooltipEnabled = !this.tooltipEnabled;
        localStorage.setItem(PolygonSelectComponent.TOOLTIP_MODE_LOCAL_STORAGE_KEY, this.tooltipEnabled ? 'true' : 'false');
        if (!this.tooltipEnabled) {
            this.hideTooltip();
        }
    }

    private updateTooltipPosition() {
        if (this.tooltipVisible) {
            const arrowSize = 4;
            const arrowOffset = 10;
            this.tooltipX = this.currentMouseX - arrowOffset;
            this.tooltipY = this.currentMouseY + 10;
            this.tooltipAbove = false;
            const tooltipElement = document.querySelector('.mesh-tooltip') as HTMLElement;
            if (tooltipElement) {
                const rect = tooltipElement.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                if (this.tooltipX + rect.width > viewportWidth) {
                    this.tooltipX = this.currentMouseX - rect.width + arrowOffset;
                }
                if (this.tooltipY + rect.height + arrowSize > viewportHeight) {
                    this.tooltipY = this.currentMouseY - rect.height - arrowSize - 5;
                    this.tooltipAbove = true;
                }
                this.tooltipX = Math.max(5, this.tooltipX);
                this.tooltipY = Math.max(5, this.tooltipY);
                const minTooltipX = this.currentMouseX - rect.width + 15;
                const maxTooltipX = this.currentMouseX - 5;
                this.tooltipX = Math.max(minTooltipX, Math.min(maxTooltipX, this.tooltipX));
            }
        }
    }

    refreshPolyColor(polygon: THREE.Mesh & { key: string, interactive?: boolean, locked?: boolean }) {
        if (this.rendererConfigProvider) {
            const interactive = polygon.interactive ?? false;
            const hover = this.lastHoveredMesh === polygon || this.lastHoveredBuddies.has(polygon.key);
            const locked = polygon.locked ?? false;
            const color = this.rendererConfigProvider.getColor(polygon.key, interactive, hover, locked);
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
        if (!poly) return;

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