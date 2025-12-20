import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";

export interface LineViewerData {

    getLineableEntities(): LineableEntity[];

    getOptions(): Map<string, LineAccessor>;

}