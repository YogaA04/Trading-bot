import axios from 'axios';
import { setupDb, insertCandle } from './db';

type Candle = {
    open_time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    close_time: number;
    quote_asset_volume: number;
    number_of_trades: number;
    taker_buy_base_volume: number;
    taker_buy_quote_volume: number;
    ignore_value: number;
};

export async function fetchAndStoreLatestBTCData() {
    const db = await setupDb();

    // Ambil timestamp terakhir dari DB  
    const stmt = db.prepare(`SELECT open_time FROM price_history ORDER BY open_time DESC LIMIT 1`);
    let lastRow = null;
    if (stmt.step()) {
        lastRow = stmt.getAsObject();
    }
    stmt.free();

    let lastTimestamp = lastRow ? Number(lastRow.open_time) : 0;
    let limit = 500;
    let fetchParams: any = {
        symbol: 'BTCUSDT',
        interval: '30m',
        limit
    };

    if (!lastRow) {
        console.log('DB kosong, ambil 500 data pertama dari Binance...');
    } else {
        const now = Date.now();
        const diffMs = now - lastTimestamp;
        let diffCandles = Math.floor(diffMs / (30 * 60 * 1000));
        limit = Math.max(1, Math.min(diffCandles, 1000));
        if (limit === 1) {
            console.log('Data sudah up-to-date.');
            return;
        }
        fetchParams.limit = limit;
        fetchParams.startTime = lastTimestamp + 1;
        console.log(`Ambil ${limit} data 30m terbaru dari Binance...`);
    }

    let res;
    try {
        res = await axios.get('https://api.binance.com/api/v3/klines', {
            params: fetchParams
        });
    } catch (err) {
        console.error('Gagal fetch data dari Binance:', err);
        return;
    }

    const now = Date.now();
    const candles: Candle[] = res.data
        .map((c: any): Candle => ({
            open_time: c[0],
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5]),
            close_time: c[6],
            quote_asset_volume: parseFloat(c[7]),
            number_of_trades: c[8],
            taker_buy_base_volume: parseFloat(c[9]),
            taker_buy_quote_volume: parseFloat(c[10]),
            ignore_value: parseFloat(c[11]),
        }))
        .filter((candle:any) => candle.close_time <= now);

    let added = 0;

    for (const candle of candles) {
        const checkStmt = db.prepare(
            `SELECT 1 FROM price_history WHERE open_time = ?`
        );
        checkStmt.bind([candle.open_time]);
        const exists = checkStmt.step();
        checkStmt.free();

        if (!exists) {
            await insertCandle(candle);
            added++;
        }
    }

    console.log(`✅ ${added} data 30m baru dari Binance disimpan`);
}