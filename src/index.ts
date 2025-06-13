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

                // Kirim pesan ke Telegram jika ada sinyal baru
                try {
                    await sendTelegramMessage(msg);
                    console.log('📤 Sinyal trading dikirim ke Telegram');
                } catch (err) {
                    console.error('❌ Gagal kirim sinyal ke Telegram:', err);
                }
            } else {
                console.log('Sinyal sudah pernah dicatat untuk jam ini, tidak dicatat ulang.');
            }
        } else if (result?.signal === 'HOLD') {
            console.log('Tidak ada sinyal trading baru.');
        } else if (result?.error) {
            console.log('❌ Error analisa:', result.error);
        } else {
            // Log detail validasi gagal
            console.error('❌ Validasi sinyal gagal:', {
                signal: result?.signal,
                error: result?.error,
                time: result?.time,
                result
            });
        }

        await showLastCandle();
    } catch (err) {
        console.error('❌ Error di runBot:', err);
    }
}

function formatSignalMsg(result: SignalResult) {
    return [
        '=== SINYAL TRADING BARU ===',
        `Sinyal   : ${result.signal ?? '-'}`,
        `Waktu    : ${result.time ?? '-'}`,
        `Open     : $${result.open !== undefined ? result.open.toFixed(2) : '-'}`,
        `High     : $${result.high !== undefined ? result.high.toFixed(2) : '-'}`,
        `Low      : $${result.low !== undefined ? result.low.toFixed(2) : '-'}`,
        `Close    : $${result.close !== undefined ? result.close.toFixed(2) : '-'}`,
        `Volume   : ${result.volume ?? '-'}`,
        `EMA50    : ${result.ema50 !== undefined ? result.ema50.toFixed(2) : '-'}`,
        `EMA200   : ${result.ema200 !== undefined ? result.ema200.toFixed(2) : '-'}`,
        `RSI      : ${result.rsi !== undefined ? result.rsi.toFixed(2) : '-'}`,
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
    const minute = now.minute();
    const second = now.second();
    const nextRunMinute = minute < 30 ? 30 : 60;
    const waitMs = ((nextRunMinute - minute - 1) * 60 + (60 - second)) * 1000;

    setTimeout(() => {  
        console.log('\n⏰ Menjalankan bot trading...');  
        runBot();  
        setInterval(() => {  
            console.log('\n⏰ Menjalankan bot trading...');  
            runBot();  
        }, 30 * 60 * 1000);  
    }, waitMs);
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
            `Exit     : $${trade.closePrice !== undefined ? trade.closePrice.toFixed(2) : '-'}`,
            `Size     : ${trade.size.toFixed(4)}`,
            `PnL      : $${trade.pnl !== undefined ? trade.pnl.toFixed(2) : '-'}`,
            `Result   : ${trade.result ?? '-'}`,
            `Balance  : $${trade.balance.toFixed(2)}`,
            `Waktu    : ${trade.closeTime ?? '-'}`,
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
    }, true); // <--- hanya proses candle terbaru
}

runBot();
// Jalankan hanya jika memang ingin simulasi berjalan paralel dengan bot sinyal
scheduleRunBot();
main();