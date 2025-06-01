import axios from 'axios';
import { setupDb } from './db';

export async function fetchAndStoreLatestBTCData() {
    const db = await setupDb();

    // Ambil timestamp terakhir dari DB
    const lastRow = await db.get(`SELECT timestamp FROM price_history ORDER BY timestamp DESC LIMIT 1`);
    const lastTimestamp = lastRow ? new Date(lastRow.timestamp).getTime() : 0;

    console.log(`🕒 Terakhir di DB: ${lastRow?.timestamp || 'Belum ada data'}`);

    // Hitung selisih hari antara data terakhir dan sekarang
    const now = Date.now();
    let diffDays = Math.ceil((now - lastTimestamp) / (1000 * 60 * 60 * 24));
    if (diffDays < 1) diffDays = 1; // minimal ambil 1 hari

    // CoinGecko API maksimal 90 hari untuk market_chart endpoint
    if (diffDays > 90) diffDays = 90;

    // Fetch data sesuai kebutuhan
    const url = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${diffDays}`;

    try {
        const res = await axios.get(url);
        const prices: [number, number][] = res.data.prices;

        let added = 0;

        for (const [timestamp, price] of prices) {
            if (timestamp > lastTimestamp) {
                const date = new Date(timestamp);
                date.setMinutes(0, 0, 0); // bulatkan ke jam terdekat
                const isoHour = date.toISOString();

                // Cek apakah sudah ada data di jam ini
                const exists = await db.get(
                    `SELECT 1 FROM price_history WHERE timestamp = ?`,
                    isoHour
                );
                if (!exists) {
                    await db.run(
                        `INSERT INTO price_history (timestamp, price) VALUES (?, ?)`,
                        isoHour, price
                    );
                    added++;
                }
            }
        }

        console.log(`✅ ${added} data baru disimpan`);
    } catch (err: any) {
        console.error('❌ Gagal fetch/simpan:', err.message);
    }
}
