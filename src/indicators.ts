// indicators.ts
export function calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    let ema: number[] = [];
    prices.forEach((price, i) => {
        if (i < period - 1) {
            ema.push(NaN);
        } else if (i === period - 1) {
            const sma = prices.slice(0, period).reduce((a, b) => a + b) / period;
            ema.push(sma);
        } else {
            ema.push(price * k + ema[ema.length - 1] * (1 - k));
        }
    });
    return ema;
}

export function calculateRSI(prices: number[], period: number): number[] {
    let rsi: number[] = [];
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;
    rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) - change) / period;
        }
        rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }

    // Isi NaN untuk data awal yang belum cukup period
    for (let i = 0; i < period; i++) rsi[i] = NaN;

    return rsi;
}

export function calculateATR(prices: number[], period: number): number[] {
    let tr: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        tr.push(Math.abs(prices[i] - prices[i - 1]));
    }

    let atr: number[] = [];
    for (let i = 0; i < tr.length; i++) {
        if (i < period) {
            atr.push(NaN);
        } else if (i === period) {
            const avg = tr.slice(0, period).reduce((a, b) => a + b) / period;
            atr.push(avg);
        } else {
            atr.push((atr[atr.length - 1] * (period - 1) + tr[i]) / period);
        }
    }

    // Isi NaN untuk data awal yang belum cukup period+1
    atr.unshift(NaN);

    return atr;
}
