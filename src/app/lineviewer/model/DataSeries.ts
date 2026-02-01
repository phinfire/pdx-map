import { Point2D } from "../../../util/Point2D";

export interface DataSeries {
    name: string;
    color: string;
    values: Point2D<number>[];
}