import { LineableEntity } from "./LineableEntity";
import { DataSeries } from "../LinePlotterService";
import { Observable } from "rxjs";

export interface LineAccessor {
    (): Observable<Map<LineableEntity, DataSeries>>;
}