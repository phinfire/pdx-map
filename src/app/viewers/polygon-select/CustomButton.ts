export interface CustomButton {
    categoryLabel: string | null;
    icon: string;
    isImage: boolean;
    title: string;
    action: () => void;
    active?: boolean
    canBeToggled: boolean;
    isToggled: boolean;
}