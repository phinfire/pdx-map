import { DataSeries } from "./DataSeries";
import { LineableEntity } from "./LineableEntity";
import { Observable } from "rxjs";

export interface LineAccessor {
    (): Observable<Map<LineableEntity, DataSeries>>;
}