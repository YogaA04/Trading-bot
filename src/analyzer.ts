import { getAllCandles } from './db';
import { calculateEMA, calculateRSI } from './indicators';

const EMA_FAST = 50;
const EMA_SLOW = 200;
const RSI_PERIOD = 14;
const LOOKBACK_LOW_HIGH = 100;

// Deteksi pola bullish engulfing
function isBullishEngulfing(candles: any[], i: number): boolean {
    if (i < 1) return false;
    const prev = candles[i - 1], curr = candles[i];
    return prev.close < prev.open && curr.close > curr.open &&
        curr.close > prev.open && curr.open < prev.close;
}

// Deteksi pola bearish engulfing
function isBearishEngulfing(candles: any[], i: number): boolean {
    if (i < 1) return false;
    const prev = candles[i - 1], curr = candles[i];
    return prev.close > prev.open && curr.close < curr.open &&
        curr.open > prev.close && curr.close < prev.open;
}

// Deteksi volume tinggi
function isHighVolume(candles: any[], i: number, lookback = 20): boolean {
    if (i < lookback) return false;
    const avgVol = candles.slice(i - lookback, i)
        .reduce((sum, c) => sum + c.volume, 0) / lookback;
    return candles[i].volume > avgVol;
}

// Fungsi utama analisa trading
export async function analyze(candlesParam?: any[]) {
    const candles = candlesParam || await getAllCandles();
    const i = candles.length - 1;

    if (candles.length < EMA_SLOW + 2 || candles.length < RSI_PERIOD + 2 || candles.length < LOOKBACK_LOW_HIGH)
        return { error: 'Data belum cukup untuk analisa.' };

    const closes = candles.map(c => c.close);
    const ema50 = calculateEMA(closes, EMA_FAST);
    const ema200 = calculateEMA(closes, EMA_SLOW);
    const rsiArr = calculateRSI(closes, RSI_PERIOD);
    const latest = candles[i];
    const latestEma50 = ema50[i], latestEma200 = ema200[i], latestRSI = rsiArr[i];

    const uptrend = latestEma50 > latestEma200 && ema50[i - 1] > ema200[i - 1];
    const downtrend = latestEma50 < latestEma200 && ema50[i - 1] < ema200[i - 1];
    const sideways = Math.abs(latestEma50 - latestEma200) / latest.close < 0.002;
    const inPullbackZone = (latest.close < latestEma50 && latest.close > latestEma200) ||
        (latest.close > latestEma50 && latest.close < latestEma200);

    const bullishEngulf = isBullishEngulfing(candles, i);
    const bearishEngulf = isBearishEngulfing(candles, i);
    const highVol = isHighVolume(candles, i);

    // Algoritma support/resistance breakout dari 100 candle terakhir
    const lookbackCandles = candles.slice(-LOOKBACK_LOW_HIGH);
    const lowestLow = Math.min(...lookbackCandles.map(c => c.low));
    const highestHigh = Math.max(...lookbackCandles.map(c => c.high));

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Sinyal breakout ke bawah (SELL)
    if (
        downtrend &&
        latest.close < lowestLow
    ) {
        signal = 'SELL';
    }

    // Sinyal breakout ke atas (BUY)
    else if (
        uptrend &&
        latest.close > highestHigh
    ) {
        signal = 'BUY';
    }

    // Sinyal tambahan berdasarkan pola dan RSI
    else if (
        uptrend && !sideways && inPullbackZone &&
        latestRSI < 35 && rsiArr[i - 1] < 35 && latestRSI > rsiArr[i - 1] &&
        bullishEngulf && highVol
    ) {
        signal = 'BUY';
    }
    else if (
        downtrend && !sideways && inPullbackZone &&
        latestRSI > 65 && rsiArr[i - 1] > 65 && latestRSI < rsiArr[i - 1] &&
        bearishEngulf && highVol
    ) {
        signal = 'SELL';
    }

    return {
        time: new Date(latest.open_time).toISOString(),
        open: latest.open,
        high: latest.high,
        low: latest.low,
        close: latest.close,
        volume: latest.volume,
        ema50: latestEma50,
        ema200: latestEma200,
        rsi: latestRSI,
        lowestLow,
        highestHigh,
        signal
    };
}
