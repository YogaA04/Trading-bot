import { setupDb } from './db';
import { calculateEMA, calculateRSI, calculateATR } from './indicators';

const EMA_FAST = 10;
const EMA_SLOW = 30;
const ATR_PERIOD = 14;
const RSI_PERIOD = 14;
const BREAKOUT_LOOKBACK = 24; // 24 jam terakhir

export async function analyze() {
    const db = await setupDb();
    const candles = await db.all(`
        SELECT timestamp, price
        FROM price_history
        ORDER BY timestamp ASC
    `);

    if (
        candles.length < EMA_SLOW ||
        candles.length < ATR_PERIOD ||
        candles.length < RSI_PERIOD ||
        candles.length < EMA_SLOW ||
        candles.length < BREAKOUT_LOOKBACK
    ) {
        return { error: 'Data belum cukup untuk analisa.' };
    }

    const prices = candles.map(c => c.price);
    const timestamps = candles.map(c => c.timestamp);

    // Hitung indikator
    const emaFast = calculateEMA(prices, EMA_FAST);
    const emaSlow = calculateEMA(prices, EMA_SLOW);
    const atr = calculateATR(prices, ATR_PERIOD);
    const rsiArr = calculateRSI(prices, RSI_PERIOD);

    // Ambil data terakhir dan sebelumnya
    const len = prices.length;
    const latestPrice = prices[len - 1];
    const latestATR = atr[len - 1];
    const latestRSI = rsiArr[len - 1];

    // Data tambahan
    const latestEmaFast = emaFast[len - 1];
    const latestEmaSlow = emaSlow[len - 1];
    const prevEmaFast = emaFast[len - 2];
    const prevEmaSlow = emaSlow[len - 2];
    const highest24 = Math.max(...prices.slice(-BREAKOUT_LOOKBACK));
    const entryBreakout = latestPrice > highest24;
    const uptrend = latestEmaFast > latestEmaSlow;
    const notOverbought = latestRSI < 70;

    let signal: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // --- Risk Management ---
    const modal = 100; // USD
    const leverage = 25;
    const riskPercent = 0.01; // 1%
    const rewardPercent = 0.02; // 2%
    const riskDollar = modal * riskPercent; // $1
    const rewardDollar = modal * rewardPercent; // $2

    // Asumsi 1 lot = 1 USD/poin, position size = modal * leverage / latestPrice
    // Jika ingin lebih presisi, sesuaikan dengan aturan broker/instrumen Anda
    const positionSize = (modal * leverage) / latestPrice;

    let sl: number | null = null;
    let tp: number | null = null;

    // --- Logika Sinyal ---
    if (
        prevEmaFast < prevEmaSlow &&
        latestEmaFast > latestEmaSlow &&
        latestPrice > latestEmaFast &&
        latestPrice > latestEmaSlow &&
        latestRSI > 50
    ) {
        signal = 'BUY';
        sl = latestPrice - (riskDollar / positionSize);
        tp = latestPrice + (rewardDollar / positionSize);
    }
    else if (
        prevEmaFast > prevEmaSlow &&
        latestEmaFast < latestEmaSlow &&
        latestPrice < latestEmaFast &&
        latestPrice < latestEmaSlow &&
        latestRSI < 50
    ) {
        signal = 'SELL';
        sl = latestPrice + (riskDollar / positionSize);
        tp = latestPrice - (rewardDollar / positionSize);
    }

    if (uptrend && notOverbought && entryBreakout) {
        signal = 'BUY';
        sl = latestPrice - (riskDollar / positionSize);
        tp = latestPrice + (rewardDollar / positionSize);
    }
    else if (latestEmaFast < latestEmaSlow) {
        signal = 'SELL';
        sl = latestPrice + (riskDollar / positionSize);
        tp = latestPrice - (rewardDollar / positionSize);
    }

    return {
        time: timestamps[len - 1],
        price: latestPrice,
        emaFast: latestEmaFast,
        emaSlow: latestEmaSlow,
        atr: latestATR,
        rsi: latestRSI,
        highest24,
        signal,
        tp,
        sl,
        rrr: `${riskPercent * 100}% : ${rewardPercent * 100}%`,
        positionSize,
        riskDollar,
        rewardDollar
    };
}
