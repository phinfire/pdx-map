export class SimplifiedDate {
    
    public static fromYearMonthDayDotSeparated(dateString: string) {
        const parts = dateString.split(".");
        if (parts.length !== 3) {
            console.error(`Invalid date format: ${dateString}`);
            throw new Error("Invalid date format, expected 'YYYY.MM.DD'");
        }
        const [yearStr, monthStr, dayStr] = parts;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);
        return new SimplifiedDate(year, month, day);
    }
    
    constructor(public readonly year: number, public readonly month: number, public readonly day: number) {
        if (year < 0 || month < 1 || month > 12 || day < 1 || day > 30) {
            throw new Error("Invalid date values: " + year + "-" + month + "-" + day);
        }
    }
}