// indicators.ts
// EMA sesuai TradingView
export function calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    let ema: number[] = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            ema.push(NaN);
        } else if (i === period - 1) {
            // EMA pertama = SMA
            const sma = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
            ema.push(sma);
        } else {
            ema.push((prices[i] - ema[i - 1]) * k + ema[i - 1]);
        }
    }
    return ema;
}

// RSI sesuai TradingView (Wilder's Smoothing)
export function calculateRSI(prices: number[], period: number): number[] {
    let rsi: number[] = Array(prices.length).fill(NaN);
    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
        const change = prices[i] - prices[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    if (avgLoss === 0) {
        rsi[period] = 100;
    } else {
        const rs = avgGain / avgLoss;
        rsi[period] = 100 - 100 / (1 + rs);
    }

    for (let i = period + 1; i < prices.length; i++) {
        const change = prices[i] - prices[i - 1];
        let gain = change > 0 ? change : 0;
        let loss = change < 0 ? -change : 0;

        avgGain = (avgGain * (period - 1) + gain) / period;
        avgLoss = (avgLoss * (period - 1) + loss) / period;

        if (avgLoss === 0) {
            rsi[i] = 100;
        } else {
            const rs = avgGain / avgLoss;
            rsi[i] = 100 - 100 / (1 + rs);
        }
    }
    return rsi;
}

// ATR sesuai TradingView (butuh high, low, close)
export function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number[] {
    let tr: number[] = [NaN];
    for (let i = 1; i < highs.length; i++) {
        const high = highs[i];
        const low = lows[i];
        const prevClose = closes[i - 1];
        const trueRange = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );
        tr.push(trueRange);
    }

    let atr: number[] = [];
    for (let i = 0; i < tr.length; i++) {
        if (i < period || isNaN(tr[i])) {
            atr.push(NaN);
        } else if (i === period) {
            const avg = tr.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
            atr.push(avg);
        } else {
            atr.push((atr[atr.length - 1] * (period - 1) + tr[i]) / period);
        }
    }
    return atr;
}
