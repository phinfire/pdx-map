import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";

export interface LineViewerData<T> {

    getLineableEntities(): LineableEntity[];

    getOptions(): Map<string, LineAccessor<T>>;
}