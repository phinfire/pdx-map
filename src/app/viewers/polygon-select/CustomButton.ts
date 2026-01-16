export interface CustomButton {
    icon: string;
    isImage: boolean;
    title: string;
    action: () => void;
    active?: boolean
    canBeToggled: boolean;
    isToggled: boolean;
}