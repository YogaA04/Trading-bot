// File: runSimulation.ts
import { analyze } from './analyzer';
import { getAllCandles, saveTrade, setupTradeTable } from './db';

const INITIAL_BALANCE = 100;
const LEVERAGE = 25;
const RISK_PER_TRADE = 0.02;
const RRR = 2;

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
    volume: number
} = null;

function calcPositionSize(entryPrice: number) {
    const margin = balance * RISK_PER_TRADE;
    return (margin * LEVERAGE) / entryPrice;
}

function calcPNL(entryPrice: number, exitPrice: number, size: number, type: 'BUY' | 'SELL') {
    return type === 'BUY'
        ? (exitPrice - entryPrice) * size
        : (entryPrice - exitPrice) * size;
}

export async function runSimulation() {
    await setupTradeTable();
    const candles = await getAllCandles();
    for (let i = 201; i < candles.length; i++) {
        const window = candles.slice(0, i + 1);
        const signalResult = await analyze(window);
        const lastCandle = window[window.length - 1];
        const price = lastCandle.close;
        const time = new Date(lastCandle.open_time).toISOString();

        if (!openPosition && (signalResult.signal === 'BUY' || signalResult.signal === 'SELL')) {
            const entryType = signalResult.signal;
            const entryPrice = price;
            const margin = balance * RISK_PER_TRADE;
            const size = (margin * LEVERAGE) / entryPrice;
            const risk = entryPrice * 0.005;
            const sl = entryType === 'BUY' ? entryPrice - risk : entryPrice + risk;
            const tp = entryType === 'BUY' ? entryPrice + risk * RRR : entryPrice - risk * RRR;

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
                volume: lastCandle.volume
            };
            await logTrade({ action: 'OPEN', ...openPosition, balance, time });
        }

        while (openPosition && i < candles.length - 1) {
            const nextCandle = candles[++i];
            let closed = false;
            let closePrice = 0;
            let result = '';

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

            if (closed) {
                const pnl = calcPNL(openPosition.entryPrice, closePrice, openPosition.size, openPosition.type);
                balance += pnl;
                await logTrade({
                    action: 'CLOSE',
                    ...openPosition,
                    closePrice,
                    pnl,
                    result,
                    balance,
                    closeTime: new Date(nextCandle.open_time).toISOString()
                });
                openPosition = null;
            }
        }
    }
    console.log(`Simulasi selesai. Sisa balance: $${balance.toFixed(2)}`);
}

async function logTrade(trade: any) {
    await saveTrade(trade);
}
