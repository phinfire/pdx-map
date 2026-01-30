export class CurveBuffer {
    values: number[];
    sampleRate: number;
    lastSampledDate: Date;

    static fromRawData(rawData: any) {
        const sampleRate = rawData.sample_rate;
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
            const daysAgo = (totalSamples - 1 - sampleIndex) * this.sampleRate;
            const sampleDate = new Date(this.lastSampledDate);
            sampleDate.setDate(sampleDate.getDate() - daysAgo);
            pairs.push({ date: sampleDate, value: this.values[sampleIndex] });
        }
        return pairs;
    }
}