import { fetchAndStoreLatestBTCData } from './fetcher';
import { analyze } from './analyzer';
import { sendTelegramMessage } from './notifier';
import cron from 'node-cron';

async function runBot() {
    try {
        // 1. Fetch data harga terbaru dan update DB
        await fetchAndStoreLatestBTCData();

        // 2. Analisa sinyal trading
        const result = await analyze();

        // 3. Jika ada sinyal BUY/SELL, kirim ke Telegram
        if (result && !result.error && result.signal !== 'HOLD') {
            const msg = `
Sinyal: ${result.signal}
Waktu: ${result.time}
Harga: $${result.price?.toFixed(2)}
emaFast: ${result.emaFast?.toFixed(2)}
emaSlow: ${result.emaSlow?.toFixed(2)}
RSI: ${result.rsi?.toFixed(2)}
ATR: ${result.atr?.toFixed(2)}
Highest 24h: $${result.highest24?.toFixed(2)}
TP: $${result.tp?.toFixed(2)}
SL: $${result.sl?.toFixed(2)}
RRR: ${result.rrr}
Position Size: ${result.positionSize?.toFixed(4)}
Risk per Trade: $${result.riskDollar?.toFixed(2)}
Reward per Trade: $${result.rewardDollar?.toFixed(2)}
            `.trim();
            await sendTelegramMessage(msg);
            console.log('📤 Sinyal dikirim ke Telegram:', msg);
        } else if (result && result.signal === 'HOLD') {
            console.log('Tidak ada sinyal trading baru.');
        } else if (result && result.error) {
            console.log(result.error);
        }
    } catch (err) {
        console.error('❌ Error di runBot:', err);
    }
}

// Jalankan pertama kali saat app start
runBot();

// Jalankan otomatis setiap 1 jam (setiap menit ke-0)
cron.schedule('0 * * * *', () => {
    runBot();
});
