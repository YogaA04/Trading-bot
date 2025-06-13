// File: runSimulation.ts
import { analyze } from './analyzer';
import { getAllCandles, saveTrade, setupTradeTable } from './db';

const INITIAL_BALANCE = 100;
const LEVERAGE = 25;
const RISK_PER_TRADE = 0.02;
const RRR = 2;

const MIN_NOTIONAL = 5;    // Minimal nilai order (USDT)
const MIN_QTY = 0.001;     // Minimal qty BTCUSDT (cek di Binance Exchange Info)
const FEE_RATE = 0.0004;   // 0.04% per transaksi (taker fee Binance Futures)

function calcPositionSize(entryPrice: number, balance: number) {
    const margin = balance * RISK_PER_TRADE;
    let size = (margin * LEVERAGE) / entryPrice;

    // Cek minimum notional (size * entryPrice >= MIN_NOTIONAL)
    if (size * entryPrice < MIN_NOTIONAL) {
        size = MIN_NOTIONAL / entryPrice;
    }
    // Cek minimum quantity
    if (size < MIN_QTY) {
        size = MIN_QTY;
    }
    // Pembulatan ke 3 desimal (BTCUSDT biasanya 0.001)
    size = Math.floor(size * 1000) / 1000;
    return size;
}

// Hitung fee dua arah (buka & tutup posisi)
function calcFee(entryPrice: number, exitPrice: number, size: number) {
    return ((entryPrice + exitPrice) * size) * FEE_RATE;
}

function calcPNL(entryPrice: number, exitPrice: number, size: number, type: 'BUY' | 'SELL') {
    const gross = type === 'BUY'
        ? (exitPrice - entryPrice) * size
        : (entryPrice - exitPrice) * size;
    const fee = calcFee(entryPrice, exitPrice, size);
    return gross - fee;
}

// Liquidation price sederhana (tanpa maintenance margin, hanya ilustrasi)
function calcLiquidationPrice(entryPrice: number, type: 'BUY' | 'SELL') {
    // Rumus sederhana: likuidasi terjadi jika harga bergerak ~100% margin
    // (margin = entry/leverage, likuidasi = margin habis)
    const marginPerc = 1 / LEVERAGE;
    if (type === 'BUY') {
        return entryPrice * (1 - marginPerc);
    } else {
        return entryPrice * (1 + marginPerc);
    }
}

export async function runSimulation(onTrade?: (trade: any) => Promise<void>, onlyLatest = false) {
    await setupTradeTable();
    let balance = INITIAL_BALANCE;
    let openPosition: null | {
        type: 'BUY' | 'SELL',
        entryPrice: number,
        size: number,
        sl: number,
        tp: number,
        time: string,
        open: number,
        high: number,
        low: number,
        close: number,
        volume: number,
        liquidationPrice: number
    } = null;

    const candles = await getAllCandles();

    // Jika onlyLatest, proses hanya candle terbaru
    if (onlyLatest) {
        const i = candles.length - 1;
        const window = candles.slice(0, i + 1);
        const signalResult = await analyze(window);
        const lastCandle = window[window.length - 1];
        const price = lastCandle.close;
        const time = new Date(lastCandle.open_time).toISOString();

        if (!openPosition && (signalResult.signal === 'BUY' || signalResult.signal === 'SELL')) {
            const entryType = signalResult.signal;
            const entryPrice = price;
            const size = calcPositionSize(entryPrice, balance);
            const risk = entryPrice * 0.005;
            const sl = entryType === 'BUY' ? entryPrice - risk : entryPrice + risk;
            const tp = entryType === 'BUY' ? entryPrice + risk * RRR : entryPrice - risk * RRR;
            const liquidationPrice = calcLiquidationPrice(entryPrice, entryType);

            openPosition = {
                type: entryType,
                entryPrice,
                size,
                sl,
                tp,
                time,
                open: lastCandle.open,
                high: lastCandle.high,
                low: lastCandle.low,
                close: lastCandle.close,
                volume: lastCandle.volume,
                liquidationPrice
            };
            await logTrade({ action: 'OPEN', ...openPosition, balance, time });
            if (onTrade) await onTrade({ action: 'OPEN', ...openPosition, balance, time });
        }
        // Cek close posisi pada candle berikutnya jika ada (opsional)
    } else {
        // Backtest mode: proses semua candle
        for (let i = 201; i < candles.length; i++) {
            const window = candles.slice(0, i + 1);
            const signalResult = await analyze(window);
            const lastCandle = window[window.length - 1];
            const price = lastCandle.close;
            const time = new Date(lastCandle.open_time).toISOString();

            // Buka posisi jika ada sinyal dan belum ada posisi terbuka
            if (!openPosition && (signalResult.signal === 'BUY' || signalResult.signal === 'SELL')) {
                const entryType = signalResult.signal;
                const entryPrice = price;
                const size = calcPositionSize(entryPrice, balance);
                const risk = entryPrice * 0.005;
                const sl = entryType === 'BUY' ? entryPrice - risk : entryPrice + risk;
                const tp = entryType === 'BUY' ? entryPrice + risk * RRR : entryPrice - risk * RRR;
                const liquidationPrice = calcLiquidationPrice(entryPrice, entryType);

                openPosition = {
                    type: entryType,
                    entryPrice,
                    size,
                    sl,
                    tp,
                    time,
                    open: lastCandle.open,
                    high: lastCandle.high,
                    low: lastCandle.low,
                    close: lastCandle.close,
                    volume: lastCandle.volume,
                    liquidationPrice
                };
                await logTrade({ action: 'OPEN', ...openPosition, balance, time });
                if (onTrade) await onTrade({ action: 'OPEN', ...openPosition, balance, time });
            }

            // Cek posisi terbuka pada candle berikutnya
            if (openPosition && i < candles.length - 1) {
                const nextCandle = candles[i + 1];
                let closed = false;
                let closePrice = 0;
                let result = '';

                // Cek likuidasi
                let isLiquidated = false;
                if (openPosition.type === 'BUY' && nextCandle.low <= openPosition.liquidationPrice) {
                    closePrice = openPosition.liquidationPrice;
                    result = 'LIQUIDATED';
                    closed = true;
                    isLiquidated = true;
                } else if (openPosition.type === 'SELL' && nextCandle.high >= openPosition.liquidationPrice) {
                    closePrice = openPosition.liquidationPrice;
                    result = 'LIQUIDATED';
                    closed = true;
                    isLiquidated = true;
                }

                if (!isLiquidated) {
                    if (openPosition.type === 'BUY') {
                        const hitSL = nextCandle.low <= openPosition.sl;
                        const hitTP = nextCandle.high >= openPosition.tp;

                        if (hitSL && hitTP) {
                            const distToSL = Math.abs(openPosition.entryPrice - openPosition.sl);
                            const distToTP = Math.abs(openPosition.tp - openPosition.entryPrice);
                            if (distToSL <= distToTP) {
                                closePrice = openPosition.sl;
                                result = 'LOSS';
                            } else {
                                closePrice = openPosition.tp;
                                result = 'WIN';
                            }
                            closed = true;
                        } else if (hitSL) {
                            closePrice = openPosition.sl;
                            result = 'LOSS';
                            closed = true;
                        } else if (hitTP) {
                            closePrice = openPosition.tp;
                            result = 'WIN';
                            closed = true;
                        }
                    } else {
                        const hitSL = nextCandle.high >= openPosition.sl;
                        const hitTP = nextCandle.low <= openPosition.tp;

                        if (hitSL && hitTP) {
                            const distToSL = Math.abs(openPosition.sl - openPosition.entryPrice);
                            const distToTP = Math.abs(openPosition.entryPrice - openPosition.tp);
                            if (distToSL <= distToTP) {
                                closePrice = openPosition.sl;
                                result = 'LOSS';
                            } else {
                                closePrice = openPosition.tp;
                                result = 'WIN';
                            }
                            closed = true;
                        } else if (hitSL) {
                            closePrice = openPosition.sl;
                            result = 'LOSS';
                            closed = true;
                        } else if (hitTP) {
                            closePrice = openPosition.tp;
                            result = 'WIN';
                            closed = true;
                        }
                    }
                }

                if (closed) {
                    const pnl = calcPNL(openPosition.entryPrice, closePrice, openPosition.size, openPosition.type);
                    balance += pnl;
                    const closeTime = new Date(nextCandle.open_time).toISOString();
                    await logTrade({
                        action: 'CLOSE',
                        ...openPosition,
                        closePrice,
                        pnl,
                        result,
                        balance,
                        closeTime
                    });
                    if (onTrade) await onTrade({
                        action: 'CLOSE',
                        ...openPosition,
                        closePrice,
                        pnl,
                        result,
                        balance,
                        closeTime
                    });
                    openPosition = null;
                    // Lewati candle berikutnya karena posisi sudah close di candle ini
                    i++;
                }
            }
        }
    }
    console.log(`Simulasi selesai. Sisa balance: $${balance.toFixed(2)}`);
}

async function logTrade(trade: any) {
    await saveTrade(trade);
}
