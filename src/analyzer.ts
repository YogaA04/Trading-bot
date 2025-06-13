import { getAllCandles } from './db';
import { calculateEMA, calculateRSI } from './indicators';
import regression from 'regression';

const EMA_FAST = 50;
const EMA_SLOW = 200;
const RSI_PERIOD = 14;
const LOOKBACK_LOW_HIGH = 100;
const TREND_SAMPLE = 100;

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

// Ambil titik swing low/high sederhana untuk trendline
function getTrendlinePoints(candles: any[], type: 'low' | 'high', sample = TREND_SAMPLE) {
    const data: [number, number][] = [];
    const sliced = candles.slice(-sample);
    for (let i = 1; i < sliced.length - 1; i++) {
        const prev = sliced[i - 1];
        const curr = sliced[i];
        const next = sliced[i + 1];
        if (type === 'low' && curr.low < prev.low && curr.low < next.low) {
            data.push([i, curr.low]);
        } else if (type === 'high' && curr.high > prev.high && curr.high > next.high) {
            data.push([i, curr.high]);
        }
    }
    return data;
}

// Fungsi utama analisa trading
export async function analyze(candlesParam?: any[]) {
    const candles = candlesParam || await getAllCandles();
    const n = candles.length;
    const i = n - 1;

    // Validasi data cukup
    if (
        n < EMA_SLOW + 2 ||
        n < RSI_PERIOD + 2 ||
        n < LOOKBACK_LOW_HIGH ||
        n < TREND_SAMPLE
    ) {
        return {
            error: 'Data belum cukup untuk analisa.',
            time: undefined, open: undefined, high: undefined, low: undefined, close: undefined, volume: undefined,
            ema50: undefined, ema200: undefined, rsi: undefined, lowestLow: undefined, highestHigh: undefined,
            supportLine: undefined, resistanceLine: undefined, signal: 'HOLD'
        };
    }

    const closes = candles.map(c => c.close);
    const ema50 = calculateEMA(closes, EMA_FAST);
    const ema200 = calculateEMA(closes, EMA_SLOW);
    const rsiArr = calculateRSI(closes, RSI_PERIOD);
    const latest = candles[i];
    const latestEma50 = ema50[i], latestEma200 = ema200[i], latestRSI = rsiArr[i];

    // Hindari akses rsiArr[i-1] jika i < 1
    const prevRSI = i > 0 ? rsiArr[i - 1] : latestRSI;

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

    // Trendline regression
    let supportLine, resistanceLine, supportY, resistanceY;
    let trendlineSignal: 'BUY' | 'SELL' | null = null;
    const lows = getTrendlinePoints(candles, 'low');
    const highs = getTrendlinePoints(candles, 'high');
    if (lows.length >= 2 && highs.length >= 2) {
        supportLine = regression.linear(lows);
        resistanceLine = regression.linear(highs);
        // Gunakan index terakhir dari sample, bukan TREND_SAMPLE-1 jika jumlah candle < TREND_SAMPLE
        const latestIndex = lows.length > 0 ? lows[lows.length - 1][0] : TREND_SAMPLE - 1;
        supportY = supportLine.predict(latestIndex)[1];
        resistanceY = resistanceLine.predict(latestIndex)[1];

        // Breakout ke atas resistance trendline → BUY
        if (
            latest.close > resistanceY &&
            uptrend &&
            latestRSI > 50
        ) {
            trendlineSignal = 'BUY';
        }
        // Breakout ke bawah support trendline → SELL
        else if (
            latest.close < supportY &&
            downtrend &&
            latestRSI < 50
        ) {
            trendlineSignal = 'SELL';
        }
    }

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
        latestRSI < 35 && prevRSI < 35 && latestRSI > prevRSI &&
        bullishEngulf && highVol
    ) {
        signal = 'BUY';
    }
    else if (
        downtrend && !sideways && inPullbackZone &&
        latestRSI > 65 && prevRSI > 65 && latestRSI < prevRSI &&
        bearishEngulf && highVol
    ) {
        signal = 'SELL';
    }
    // Sinyal dari trendline regression
    else if (trendlineSignal) {
        signal = trendlineSignal;
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
        supportLine: supportLine ? `y = ${supportLine.equation[0].toFixed(2)}x + ${supportLine.equation[1].toFixed(2)}` : undefined,
        resistanceLine: resistanceLine ? `y = ${resistanceLine.equation[0].toFixed(2)}x + ${resistanceLine.equation[1].toFixed(2)}` : undefined,
        signal
    };
}
