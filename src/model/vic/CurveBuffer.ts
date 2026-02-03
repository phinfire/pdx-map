export class CurveBuffer {

    public static readonly EMPTY = new CurveBuffer([], 0, new Date(0));

    values: number[];
    sampleRate: number;
    lastSampledDate: Date;

    static fromRawData(rawData: any) {
        console.log("Raw CurveBuffer data:", rawData);
        const sampleRate = rawData.sample_rate;
        if (!rawData.channels || Object.keys(rawData.channels).length === 0) {
            return CurveBuffer.EMPTY;
        }
        const channelKey = Object.keys(rawData.channels)[0];
        const channel = rawData.channels[channelKey];

        const dateStr = channel.date;
        const [year, month, day] = dateStr.split('.').map(Number);
        const lastSampledDate = new Date(year, month - 1, day);
        const ringbufferIndex = channel.index;
        const rotatedValues = [
            ...channel.values.slice(ringbufferIndex),
            ...channel.values.slice(0, ringbufferIndex)
        ];
        return new CurveBuffer(rotatedValues, sampleRate, lastSampledDate);
    }

    static fromJSON(json: any): CurveBuffer {
        const values = json.values;
        const sampleRate = json.sample_rate;
        const lastSampledDate = new Date(json.last_sampled_date);
        return new CurveBuffer(values, sampleRate, lastSampledDate);
    }

    constructor(values: number[], sampleRate: number, lastSampledDate: Date) {
        this.values = values;
        this.sampleRate = sampleRate;
        this.lastSampledDate = lastSampledDate;
    }

    toJSON(): any {
        return {
            values: this.values,
            sample_rate: this.sampleRate,
            last_sampled_date: this.lastSampledDate.toISOString()
        };
    }

    getDateValuePairs(): { date: Date; value: number }[] {
        const pairs: { date: Date; value: number }[] = [];
        const totalSamples = this.values.length;
        for (let i = 0; i < totalSamples; i++) {
            const sampleIndex = (totalSamples + i - 1) % totalSamples;
            const daysAgo = (totalSamples - 1 - sampleIndex) * this.sampleRate / 4
            const sampleDate = new Date(this.lastSampledDate);
            sampleDate.setDate(sampleDate.getDate() - daysAgo);
            pairs.push({ date: sampleDate, value: this.values[sampleIndex] });
        }
        // TODO: remove. this is sadly necessary until all the saves have been refreshed
        return pairs.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
}