export interface OwnershipChange<D,P,T> {

    date: D;
    province: P;
    oldOwner: T | null;
    newOwner: T;
}