export interface LineableEntity {
    getName(): string;
    getColor(): string;
    isVisible(): boolean;
    setVisible(visible: boolean): void;
}