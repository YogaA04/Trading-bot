import axios from 'axios';
import { setupDb } from './db';

const DAY_CHUNK = 90;
const MAX_DAYS = 365; // Batas maksimal CoinGecko API gratis
const CURRENCY = 'usd';

function getUnixTimestampDaysAgo(daysAgo: number): number {
    const now = Math.floor(Date.now() / 1000);
    return now - daysAgo * 86400;
}

async function fetchChunk(from: number, to: number): Promise<[number, number][]> {
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=${CURRENCY}&from=${from}&to=${to}`;
    const response = await axios.get(url);
    return response.data.prices; // format: [[timestamp, price]]
}

async function saveToDatabase(prices: [number, number][]) {
    const db = await setupDb();

    const insert = await db.prepare(`INSERT INTO price_history (timestamp, price) VALUES (?, ?)`);
    for (const [timestamp, price] of prices) {
        const isoTime = new Date(timestamp).toISOString();
        await insert.run(isoTime, price);
    }

    await insert.finalize();
    console.log(`✅ ${prices.length} records saved to SQLite`);
}

async function run() {
    try {
        // Pastikan hanya mengambil data maksimal 365 hari ke belakang
        for (let daysAgo = MAX_DAYS; daysAgo > 0; daysAgo -= DAY_CHUNK) {
            const from = getUnixTimestampDaysAgo(daysAgo);
            const to = getUnixTimestampDaysAgo(Math.max(daysAgo - DAY_CHUNK, 0));
            console.log(`⏳ Fetching from ${new Date(from * 1000).toISOString()} to ${new Date(to * 1000).toISOString()}...`);
            const prices = await fetchChunk(from, to);
            await saveToDatabase(prices);
            await new Promise(r => setTimeout(r, 1500)); // rate limit delay
        }

        console.log(`🎉 Selesai ambil data hingga 1 tahun ke belakang`);
    } catch (err) {
        console.error('❌ Error fetching/saving data:', err);
    }
}

run();
