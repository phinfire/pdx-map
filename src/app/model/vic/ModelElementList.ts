export class ModelElementList<T> {

    private cachedTotal: Map<string, number> = new Map();

    private cachedTotalExplaination: Map<string, Map<any, number>> = new Map();

    constructor(private elements: T[]) {

    }

    getInternalElements(): T[] {
        return this.elements;
    }

    getCount(): number {
        return this.elements.length;
    }

    getTotal(cacheKey: string, predicate: (element: T) => boolean, valueAccessor: (element: T) => number): number {
        if (!this.cachedTotal.has(cacheKey)) {
            const total = this.elements.filter(predicate).reduce((sum, element) => sum + valueAccessor(element), 0);
            this.cachedTotal.set(cacheKey, total);
        }
        return this.cachedTotal.get(cacheKey)!;
    }

    getTotalExplanation<R>(cacheKey: string, predicate: (element: T) => boolean, valueAccessor: (element: T) => number, keyFunction: (element: T) => R) {
        if (true || !this.cachedTotalExplaination.has(cacheKey)) {
            const element2Value = new Map<R, number>();
            this.elements.filter(predicate).forEach(element => {
                const key = keyFunction(element);
                const value = valueAccessor(element);
                element2Value.set(key, (element2Value.get(key) || 0) + value);
            });
            const result =  new Map(Array.from(element2Value.entries()).sort((a, b) => b[1] - a[1]));
            this.cachedTotalExplaination.set(cacheKey, result);
        }
        return this.cachedTotalExplaination.get(cacheKey)!;
    }
}