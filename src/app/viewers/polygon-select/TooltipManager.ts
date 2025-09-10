export class TooltipManager {

    private tooltipEnabled: boolean = true;
    private tooltipVisible: boolean = false;
    private tooltipContent: string = '';
    private tooltipX: number = 0;
    private tooltipY: number = 0;
    private tooltipAbove: boolean = false
    private currentMouseX: number = 0;
    private currentMouseY: number = 0;

    public updateMousePosition(mouseX: number, mouseY: number) {
        this.currentMouseX = mouseX;
        this.currentMouseY = mouseY;
    }

    public updateTooltipPosition() {
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

    public setTooltipVisibility(visible: boolean) {
        this.tooltipVisible = visible;
    }

    public setTooltipContent(content: string) {
        this.tooltipContent = content;
    }

    public isTooltipVisible(): boolean {
        return this.tooltipVisible;
    }

    public getTooltipContent(): string {
        return this.tooltipContent;
    }

    public getTooltipPosition(): { x: number; y: number; above: boolean } {
        return { x: this.tooltipX, y: this.tooltipY, above: this.tooltipAbove };
    }

    public toggleTooltipEnabled() {
        this.tooltipEnabled = !this.tooltipEnabled;
    }

    public isTooltipEnabled(): boolean {
        return this.tooltipEnabled;
    }
}