import { fetchAndStoreLatestBTCData } from './fetcher';
import { analyze } from './analyzer';
import { setupSignalTable, isSignalSent, saveSignal, clearOldSignals, getAllCandles } from './db';
import dayjs from 'dayjs';

async function runBot() {
    try {
        await setupSignalTable();
        await clearOldSignals();
        await fetchAndStoreLatestBTCData();

        const result = await analyze();

        if (result?.signal && result.signal !== 'HOLD' && !result.error && typeof result.time === 'string') {
            const signalTime = result.time.slice(0, 13); // YYYY-MM-DDTHH
            const alreadySent = await isSignalSent(result.signal, result.close, signalTime);

            if (!alreadySent) {
                console.log(formatSignalMsg(result));
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

function formatSignalMsg(result: any) {
    return `
=== SINYAL TRADING BARU ===
Sinyal   : ${result.signal}
Waktu    : ${result.time}
Open     : $${result.open?.toFixed(2)}
High     : $${result.high?.toFixed(2)}
Low      : $${result.low?.toFixed(2)}
Close    : $${result.close?.toFixed(2)}
Volume   : ${result.volume}
EMA50    : ${result.ema50?.toFixed(2)}
EMA200   : ${result.ema200?.toFixed(2)}
RSI      : ${result.rsi?.toFixed(2)}
==========================
    `.trim();
}

async function showLastCandle() {
    const candles = await getAllCandles();
    if (candles.length === 0) return console.log('Tidak ada data candle.');
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

runBot();
scheduleRunBot();

setInterval(() => {
    process.stdout.write('\r🕒 ' + dayjs().format('HH:mm:ss'));
}, 1000);
