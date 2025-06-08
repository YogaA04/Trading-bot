import { fetchAndStoreLatestBTCData } from './fetcher';
import { analyze } from './analyzer';
import { setupSignalTable, isSignalSent, saveSignal, clearOldSignals, getAllCandles } from './db';
import dayjs from 'dayjs';
import { runSimulation } from './simulator';
import { sendTelegramMessage } from './notifier';

type SignalResult = {
    signal: string;
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    ema50: number;
    ema200: number;
    rsi: number;
    error?: string;
};

type Trade = {
    action: 'OPEN' | 'CLOSE';
    type: string;
    entryPrice: number;
    closePrice?: number;
    size: number;
    sl: number;
    tp: number;
    pnl?: number;
    result?: string;
    balance: number;
    time: string;
    closeTime?: string;
};

async function runBot() {
    try {
        await setupSignalTable();
        await clearOldSignals();
        await fetchAndStoreLatestBTCData();

        const result = await analyze() as SignalResult | undefined;

        if (result?.signal && result.signal !== 'HOLD' && !result.error && typeof result.time === 'string') {
            const signalTime = result.time.slice(0, 13); // YYYY-MM-DDTHH
            const alreadySent = await isSignalSent(result.signal, result.close, signalTime);

            if (!alreadySent) {
                const msg = formatSignalMsg(result);
                console.log(msg);
                await saveSignal(result.signal, result.close, signalTime);
                console.log('📤 Sinyal dicatat ke database:', signalTime);
            } else {
                console.log('Sinyal sudah pernah dicatat untuk jam ini, tidak dicatat ulang.');
            }
        } else if (result?.signal === 'HOLD') {
            console.log('Tidak ada sinyal trading baru.');
        } else if (result?.error) {
            console.log(result.error);
        }

        await showLastCandle();
    } catch (err) {
        console.error('❌ Error di runBot:', err);
    }
}

function formatSignalMsg(result: SignalResult) {
    return [
        '=== SINYAL TRADING BARU ===',
        `Sinyal   : ${result.signal}`,
        `Waktu    : ${result.time}`,
        `Open     : $${result.open?.toFixed(2)}`,
        `High     : $${result.high?.toFixed(2)}`,
        `Low      : $${result.low?.toFixed(2)}`,
        `Close    : $${result.close?.toFixed(2)}`,
        `Volume   : ${result.volume}`,
        `EMA50    : ${result.ema50?.toFixed(2)}`,
        `EMA200   : ${result.ema200?.toFixed(2)}`,
        `RSI      : ${result.rsi?.toFixed(2)}`,
        '=========================='
    ].join('\n');
}

async function showLastCandle() {
    const candles = await getAllCandles();
    if (!candles.length) return console.log('Tidak ada data candle.');
    const c = candles.at(-1)!;
    const openTime = dayjs(c.open_time).add(7, 'hour').toISOString();
    const closeTime = dayjs(c.close_time).add(7, 'hour').toISOString();
    console.log(
        `Open Time: ${openTime} | Close Time: ${closeTime} | Open: ${c.open} | High: ${c.high} | Low: ${c.low} | Close: ${c.close} | Volume: ${c.volume}`
    );
}

function scheduleRunBot() {
    const now = dayjs();
    const waitMs = ((59 - now.minute()) * 60 + (60 - now.second())) * 1000;

    setTimeout(() => {
        runBot();
        setInterval(runBot, 60 * 60 * 1000); // 1 jam
    }, waitMs);

    console.log(`🕒 Bot dijadwalkan mulai dalam ${Math.round(waitMs / 1000)} detik (pada menit 00)...`);
}

function formatTradeMsg(trade: Trade): string {
    if (trade.action === 'OPEN') {
        return [
            '=== OPEN POSISI ===',
            `Tipe     : ${trade.type}`,
            `Entry    : $${trade.entryPrice.toFixed(2)}`,
            `Size     : ${trade.size.toFixed(4)}`,
            `SL       : $${trade.sl.toFixed(2)}`,
            `TP       : $${trade.tp.toFixed(2)}`,
            `Waktu    : ${trade.time}`,
            `Balance  : $${trade.balance.toFixed(2)}`,
            '==================='
        ].join('\n');
    } else if (trade.action === 'CLOSE') {
        return [
            '=== CLOSE POSISI ===',
            `Tipe     : ${trade.type}`,
            `Entry    : $${trade.entryPrice.toFixed(2)}`,
            `Exit     : $${trade.closePrice?.toFixed(2)}`,
            `Size     : ${trade.size.toFixed(4)}`,
            `PnL      : $${trade.pnl?.toFixed(2)}`,
            `Result   : ${trade.result}`,
            `Balance  : $${trade.balance.toFixed(2)}`,
            `Waktu    : ${trade.closeTime}`,
            '===================='
        ].join('\n');
    }
    return '';
}

async function main() {
    await runSimulation(async (trade: Trade) => {
        const msg = formatTradeMsg(trade);
        try {
            await sendTelegramMessage(msg);
            console.log('Pesan Telegram terkirim:', msg);
        } catch (err) {
            console.error('Gagal kirim Telegram:', err);
        }
    });
}

scheduleRunBot();
main();

//setInterval(() => {
//    process.stdout.write('\r🕒 ' + dayjs().format('HH:mm:ss'));}, 1000);
