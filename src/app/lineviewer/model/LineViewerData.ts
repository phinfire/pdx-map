import { LineableEntity } from "./LineableEntity";
import { LineAccessor } from "./LineAccessor";

export interface LineViewerData {

    getEntities(): LineableEntity[];

    getOptions(): Map<string, LineAccessor>;

}