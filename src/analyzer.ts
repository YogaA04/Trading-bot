import { getAllCandles } from './db';
import { calculateEMA, calculateRSI } from './indicators';

const EMA_FAST = 50;
const EMA_SLOW = 200;
const RSI_PERIOD = 14;

// Helper: deteksi bullish engulfing dari OHLC
function isBullishEngulfing(candles: any[], i: number) {
    if (i < 1) return false;
    const prev = candles[i - 1];
    const curr = candles[i];
    return (
        prev.close < prev.open && // candle sebelumnya bearish
        curr.close > curr.open && // candle sekarang bullish
        curr.close > prev.open &&
        curr.open < prev.close
    );
}

// Helper: deteksi bearish engulfing dari OHLC
function isBearishEngulfing(candles: any[], i: number) {
    if (i < 1) return false;
    const prev = candles[i - 1];
    const curr = candles[i];
    return (
        prev.close > prev.open && // candle sebelumnya bullish
        curr.close < curr.open && // candle sekarang bearish
        curr.open > prev.close &&
        curr.close < prev.open
    );
}

// Helper: cek volume di atas rata-rata N candle terakhir
function isHighVolume(candles: any[], i: number, lookback = 20) {
    if (i < lookback) return false;
    const avgVol = candles.slice(i - lookback, i)
        .reduce((sum, c) => sum + c.volume, 0) / lookback;
    return candles[i].volume > avgVol;
}

// Algoritma utama
export async function analyze(candlesParam?: any[]) {
    // Ambil data lengkap (OHLCV)
    const candles = candlesParam || await getAllCandles();

    if (candles.length < EMA_SLOW + 2 || candles.length < RSI_PERIOD + 2) {
        return { error: 'Data belum cukup untuk analisa.' };
    }

    // Ambil array harga close, high, low, dsb
    const closes = candles.map((c: any) => c.close);
    const highs = candles.map((c: any) => c.high);
    const lows = candles.map((c: any) => c.low);
    const volumes = candles.map((c: any) => c.volume);
    const timestamps = candles.map((c: any) => c.open_time);

    // Indikator
    const ema50 = calculateEMA(closes, EMA_FAST);
    const ema200 = calculateEMA(closes, EMA_SLOW);
    const rsiArr = calculateRSI(closes, RSI_PERIOD);

    const len = candles.length;
    const i = len - 1;
    const latest = candles[i];
    const latestEma50 = ema50[i];
    const latestEma200 = ema200[i];
    const latestRSI = rsiArr[i];

    // Trend filter
    const uptrend = latestEma50 > latestEma200 && ema50[i - 1] > ema200[i - 1];
    const downtrend = latestEma50 < latestEma200 && ema50[i - 1] < ema200[i - 1];

    // Sideways filter: EMA50 dan EMA200 sangat dekat (hindari entry)
    const sideways = Math.abs(latestEma50 - latestEma200) / latest.close < 0.002;

    // Pullback: harga close di antara EMA50 dan EMA200
    const inPullbackZone = (latest.close < latestEma50 && latest.close > latestEma200) ||
        (latest.close > latestEma50 && latest.close < latestEma200);

    // Price action: engulfing pattern
    const bullishEngulf = isBullishEngulfing(candles, i);
    const bearishEngulf = isBearishEngulfing(candles, i);

    // Volume filter
    const highVol = isHighVolume(candles, i);

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // BUY setup
    if (
        uptrend &&
        !sideways &&
        inPullbackZone &&
        latestRSI < 35 && rsiArr[i - 1] < 35 && latestRSI > rsiArr[i - 1] &&
        bullishEngulf &&
        highVol
    ) {
        signal = 'BUY';
    }
    // SELL setup
    else if (
        downtrend &&
        !sideways &&
        inPullbackZone &&
        latestRSI > 65 && rsiArr[i - 1] > 65 && latestRSI < rsiArr[i - 1] &&
        bearishEngulf &&
        highVol
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
        signal
    };
}