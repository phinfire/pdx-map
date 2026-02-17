import { NgZone } from '@angular/core';
import * as THREE from 'three';

export class CameraMovementManager {
    private readonly EDGE_SCROLL_THRESHOLD = 50;
    private readonly KEYBOARD_PAN_SPEED = 0.0125;
    private readonly EDGE_SCROLL_SPEED = 2;
    private isMouseDragging = false;
    private lastMousePos: { x: number, y: number } | null = null;
    private isEdgeScrolling = false;
    private edgeScrollAnimationId: number | null = null;
    private currentScrollX = 0;
    private currentScrollY = 0;
    private pressedKeys = new Set<string>();
    private keyboardAnimationId: number | null = null;
    public zoomToCursor = true;
    public cameraHeight = 400;
    
    private shouldIgnoreWheelEvent: (event: WheelEvent) => boolean = () => false;
    private shouldIgnoreMouseEvent: (event: MouseEvent) => boolean = () => false;

    constructor(
        private camera: THREE.PerspectiveCamera,
        private containerElement: HTMLElement,
        public mouseDragEnabled: boolean,
        public mouseWheelZoomEnabled: boolean,
        public keyboardControlsEnabled: boolean,
        public edgeScrollingEnabled: boolean,
        private ngZone: NgZone
    ) {
        this.setupEventListeners();
    }

    public setShouldIgnoreWheelEvent(predicate: (event: WheelEvent) => boolean) {
        this.shouldIgnoreWheelEvent = predicate;
    }

    public setShouldIgnoreMouseEvent(predicate: (event: MouseEvent) => boolean) {
        this.shouldIgnoreMouseEvent = predicate;
    }
    
    private setupEventListeners() {
        this.ngZone.runOutsideAngular(() => {
            // Spatial events - scoped to container
            this.containerElement.addEventListener('mousemove', this.onMouseMove);
            this.containerElement.addEventListener('mousedown', this.onMouseDown);
            this.containerElement.addEventListener('mouseup', this.onMouseUp);
            this.containerElement.addEventListener('wheel', this.onWheel, { passive: false });
            this.containerElement.addEventListener('mouseleave', this.onMouseLeave);
            
            // Global keyboard events
            window.addEventListener('keydown', this.onKeyDown);
            window.addEventListener('keyup', this.onKeyUp);
        });
    }
    
    public destroy() {
        // Spatial events - remove from container
        this.containerElement.removeEventListener('mousemove', this.onMouseMove);
        this.containerElement.removeEventListener('mousedown', this.onMouseDown);
        this.containerElement.removeEventListener('mouseup', this.onMouseUp);
        this.containerElement.removeEventListener('wheel', this.onWheel);
        this.containerElement.removeEventListener('mouseleave', this.onMouseLeave);
        
        // Global keyboard events
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        
        if (this.edgeScrollAnimationId) {
            cancelAnimationFrame(this.edgeScrollAnimationId);
        }
        if (this.keyboardAnimationId) {
            cancelAnimationFrame(this.keyboardAnimationId);
        }
    }
    
    private onMouseMove = (event: MouseEvent) => {
        if (this.mouseDragEnabled && this.isMouseDragging && this.lastMousePos) {
            const dx = event.clientX - this.lastMousePos.x;
            const dy = event.clientY - this.lastMousePos.y;
            const speed = 0.2 * (this.camera.position.z / this.cameraHeight);
            this.camera.position.x -= dx * speed;
            this.camera.position.y += dy * speed;
            this.lastMousePos = { x: event.clientX, y: event.clientY };
        }

        if (this.edgeScrollingEnabled && this.containerElement.contains(event.target as Node)) {
            const rect = this.containerElement.getBoundingClientRect();
            this.checkEdgeScrolling(event, rect);
        }
    };
    
    private onMouseDown = (event: MouseEvent) => {
        if (this.mouseDragEnabled && !this.shouldIgnoreMouseEvent(event) && (event.button === 0 || event.button === 1 || event.button === 2)) { // Left, Middle, or Right mouse button
            this.isMouseDragging = true;
            this.lastMousePos = { x: event.clientX, y: event.clientY };
            event.preventDefault();
        }
    };
    
    private onMouseUp = (event: MouseEvent) => {
        if (this.mouseDragEnabled && (event.button === 0 || event.button === 1 || event.button === 2)) { // Left, Middle, or Right mouse button
            this.isMouseDragging = false;
            this.lastMousePos = null;
            event.preventDefault();
        }
    };
    
    private onMouseLeave = () => {
        this.stopEdgeScrolling();
    };

    private onWheel = (event: WheelEvent) => {
        if (this.mouseWheelZoomEnabled && this.containerElement.contains(event.target as Node) && !this.shouldIgnoreWheelEvent(event)) {
            const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
            const oldZ = this.camera.position.z;
            const newZ = Math.max(10, Math.min(1000, oldZ * zoomFactor));

            if (this.zoomToCursor) {
                const rect = this.containerElement.getBoundingClientRect();
                const mouseX = ((event.clientX - rect.left) / this.containerElement.clientWidth) * 2 - 1;
                const mouseY = -((event.clientY - rect.top) / this.containerElement.clientHeight) * 2 + 1;
                const fov = this.camera.fov * (Math.PI / 180);
                const aspect = this.containerElement.clientWidth / this.containerElement.clientHeight;
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
    
    private onKeyDown = (event: KeyboardEvent) => {
        if (!this.keyboardControlsEnabled) return;
        // Only respond to keyboard when container is relevant (optional focus check)
        if (!this.containerElement.contains(document.activeElement) && document.activeElement !== document.body) {
            return;
        }
        
        const key = event.key.toLowerCase();
        if (['w', 's', 'a', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', '+', '=', '-'].includes(key)) {
            event.preventDefault();
            this.pressedKeys.add(key);
            if (!this.keyboardAnimationId) {
                this.startKeyboardAnimation();
            }
        }
    };

    private onKeyUp = (event: KeyboardEvent) => {
        if (!this.keyboardControlsEnabled) return;
        
        const key = event.key.toLowerCase();
        this.pressedKeys.delete(key);
        if (this.pressedKeys.size === 0 && this.keyboardAnimationId) {
            cancelAnimationFrame(this.keyboardAnimationId);
            this.keyboardAnimationId = null;
        }
    };

    private startKeyboardAnimation = () => {
        this.keyboardAnimationId = requestAnimationFrame(() => {
            this.processKeyboardInput();
            if (this.pressedKeys.size > 0) {
                this.startKeyboardAnimation();
            } else {
                this.keyboardAnimationId = null;
            }
        });
    };

    private processKeyboardInput() {
        if (!this.camera) return;
        
        const speed = this.KEYBOARD_PAN_SPEED * this.camera.position.z

        if (this.pressedKeys.has('w') || this.pressedKeys.has('arrowup')) {
            this.camera.position.y += speed;
        }
        if (this.pressedKeys.has('s') || this.pressedKeys.has('arrowdown')) {
            this.camera.position.y -= speed;
        }
        if (this.pressedKeys.has('a') || this.pressedKeys.has('arrowleft')) {
            this.camera.position.x -= speed;
        }
        if (this.pressedKeys.has('d') || this.pressedKeys.has('arrowright')) {
            this.camera.position.x += speed;
        }
        
        if (this.pressedKeys.has('+') || this.pressedKeys.has('=')) {
            const newZ = Math.max(10, this.camera.position.z * 0.98);
            this.camera.position.z = newZ;
        }
        if (this.pressedKeys.has('-')) {
            const newZ = Math.min(1000, this.camera.position.z * 1.02);
            this.camera.position.z = newZ;
        }
    }
    
    // Edge scrolling
    private checkEdgeScrolling(event: MouseEvent, rect: DOMRect) {
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        const shouldScroll = 
            mouseX < this.EDGE_SCROLL_THRESHOLD ||
            mouseX > rect.width - this.EDGE_SCROLL_THRESHOLD ||
            mouseY < this.EDGE_SCROLL_THRESHOLD ||
            mouseY > rect.height - this.EDGE_SCROLL_THRESHOLD;
        
        if (shouldScroll && !this.isEdgeScrolling) {
            this.startEdgeScrolling(mouseX, mouseY, rect.width, rect.height);
        } else if (!shouldScroll && this.isEdgeScrolling) {
            this.stopEdgeScrolling();
        } else if (shouldScroll && this.isEdgeScrolling) {
            // Update scroll direction if already scrolling
            this.updateEdgeScrollDirection(mouseX, mouseY, rect.width, rect.height);
        }
    }

    private updateEdgeScrollDirection(mouseX: number, mouseY: number, width: number, height: number) {
        this.currentScrollX = 0;
        this.currentScrollY = 0;
        
        if (mouseX < this.EDGE_SCROLL_THRESHOLD) {
            this.currentScrollX = -1;
        } else if (mouseX > width - this.EDGE_SCROLL_THRESHOLD) {
            this.currentScrollX = 1;
        }
        
        if (mouseY < this.EDGE_SCROLL_THRESHOLD) {
            this.currentScrollY = 1;
        } else if (mouseY > height - this.EDGE_SCROLL_THRESHOLD) {
            this.currentScrollY = -1;
        }
    }

    private startEdgeScrolling(mouseX: number, mouseY: number, width: number, height: number) {
        this.isEdgeScrolling = true;
        this.updateEdgeScrollDirection(mouseX, mouseY, width, height);
        this.edgeScrollLoop();
    }

    private stopEdgeScrolling() {
        this.isEdgeScrolling = false;
        if (this.edgeScrollAnimationId) {
            cancelAnimationFrame(this.edgeScrollAnimationId);
            this.edgeScrollAnimationId = null;
        }
        this.currentScrollX = 0;
        this.currentScrollY = 0;
    }

    private edgeScrollLoop = () => {
        if (!this.isEdgeScrolling || !this.camera) return;
        
        const speed = this.EDGE_SCROLL_SPEED * (this.camera.position.z / this.cameraHeight);
        
        this.camera.position.x += this.currentScrollX * speed;
        this.camera.position.y += this.currentScrollY * speed;
        
        this.edgeScrollAnimationId = requestAnimationFrame(this.edgeScrollLoop);
    };

    public fitCameraToBox(box: THREE.Box3, margin: number = 0.1) {
        if (box.isEmpty()) return;
        
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const aspect = this.containerElement.clientWidth / this.containerElement.clientHeight;
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
    
    public updateCamera(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
    }
    
    // Movement control toggles
    public setMouseDragEnabled(enabled: boolean) {
        this.mouseDragEnabled = enabled;
        if (!enabled) {
            // Stop any ongoing drag
            this.isMouseDragging = false;
            this.lastMousePos = null;
        }
    }
    
    public setMouseWheelZoomEnabled(enabled: boolean) {
        this.mouseWheelZoomEnabled = enabled;
    }
    
    public setKeyboardControlsEnabled(enabled: boolean) {
        this.keyboardControlsEnabled = enabled;
        if (!enabled) {
            // Stop any ongoing keyboard movement
            this.pressedKeys.clear();
            if (this.keyboardAnimationId) {
                cancelAnimationFrame(this.keyboardAnimationId);
                this.keyboardAnimationId = null;
            }
        }
    }
    
    public setEdgeScrollingEnabled(enabled: boolean) {
        this.edgeScrollingEnabled = enabled;
        if (!enabled) {
            this.stopEdgeScrolling();
        }
    }
    
    public setAllMovementEnabled(enabled: boolean) {
        this.setMouseDragEnabled(enabled);
        this.setMouseWheelZoomEnabled(enabled);
        this.setKeyboardControlsEnabled(enabled);
        this.setEdgeScrollingEnabled(enabled);
    }
    
    // Getters for movement states
    public isMouseDragEnabled(): boolean {
        return this.mouseDragEnabled;
    }
    
    public isMouseWheelZoomEnabled(): boolean {
        return this.mouseWheelZoomEnabled;
    }
    
    public isKeyboardControlsEnabled(): boolean {
        return this.keyboardControlsEnabled;
    }
    
    public isEdgeScrollingEnabled(): boolean {
        return this.edgeScrollingEnabled;
    }
    
    // Getters for configuration
    public get edgeScrollThreshold(): number {
        return this.EDGE_SCROLL_THRESHOLD;
    }
    
    public get keyboardPanSpeed(): number {
        return this.KEYBOARD_PAN_SPEED;
    }
    
    public get edgeScrollSpeed(): number {
        return this.EDGE_SCROLL_SPEED;
    }
}