const initSqlJs = require('sql.js');
const fs = require('fs');

let db: any = null;

// Inisialisasi database dari file atau buat baru di memori
export async function setupDb() {
    if (!db) {
        const SQL = await initSqlJs();
        if (fs.existsSync('./db.sqlite')) {
            const filebuffer = fs.readFileSync('./db.sqlite');
            db = new SQL.Database(filebuffer);
        } else {
            db = new SQL.Database();
            db.run(`
                CREATE TABLE IF NOT EXISTS price_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    open_time INTEGER,
                    open REAL,
                    high REAL,
                    low REAL,
                    close REAL,
                    volume REAL,
                    close_time INTEGER,
                    quote_asset_volume REAL,
                    number_of_trades INTEGER,
                    taker_buy_base_volume REAL,
                    taker_buy_quote_volume REAL,
                    ignore_value REAL
                );
            `);
            saveDb();
        }
    }
    return db;
}

// Simpan database ke file
export function saveDb() {
    if (db) {
        const data = db.export();
        fs.writeFileSync('./db.sqlite', Buffer.from(data));
    }
}

// Setup tabel sinyal
export async function setupSignalTable() {
    await setupDb();
    db.run(`
        CREATE TABLE IF NOT EXISTS sent_signals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            signal_type TEXT,
            price REAL,
            time TEXT
        )
    `);
    saveDb();
}

// Cek apakah sinyal sudah pernah dikirim
export async function isSignalSent(signal_type: string, price: number, time: string): Promise<boolean> {
    await setupDb();
    const stmt = db.prepare(
        `SELECT 1 FROM sent_signals WHERE signal_type = ? AND price = ? AND time = ?`
    );
    stmt.bind([signal_type, price, time]);
    const exists = stmt.step();
    stmt.free();
    return exists;
}

// Simpan sinyal
export async function saveSignal(signal_type: string, price: number, time: string) {
    await setupDb();
    db.run(
        `INSERT INTO sent_signals (signal_type, price, time) VALUES (?, ?, ?)`,
        [signal_type, price, time]
    );
    saveDb();
}

// Hapus sinyal lama (misal hanya simpan 1 hari terakhir)
export async function clearOldSignals() {
    await setupDb();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    db.run(`DELETE FROM sent_signals WHERE time < ?`, [yesterday.toISOString().slice(0, 10)]);
    saveDb();
}

// Setup tabel trade
export async function setupTradeTable() {
    await setupDb();
    db.run(`
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,           -- OPEN/CLOSE
            type TEXT,             -- BUY/SELL
            entryPrice REAL,
            size REAL,
            sl REAL,
            tp REAL,
            time TEXT,
            closePrice REAL,
            pnl REAL,
            result TEXT,           -- WIN/LOSS
            balance REAL
        )
    `);
    saveDb();
}

// Simpan trade (OPEN/CLOSE)
export async function saveTrade(trade: {
    action: string,
    type: string,
    entryPrice: number,
    size: number,
    sl: number,
    tp: number,
    time: string,
    closePrice?: number,
    pnl?: number,
    result?: string,
    balance?: number
}) {
    await setupDb();
    db.run(
        `INSERT INTO trades 
        (action, type, entryPrice, size, sl, tp, time, closePrice, pnl, result, balance)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            trade.action,
            trade.type,
            trade.entryPrice,
            trade.size,
            trade.sl,
            trade.tp,
            trade.time,
            trade.closePrice ?? null,
            trade.pnl ?? null,
            trade.result ?? null,
            trade.balance ?? null
        ]
    );
    saveDb();
}

// Ambil seluruh trade
export async function getAllTrades() {
    await setupDb();
    const stmt = db.prepare(`SELECT * FROM trades ORDER BY id ASC`);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

// Simpan candle lengkap
export async function insertCandle(candle: {
    open_time: number,
    open: number,
    high: number,
    low: number,
    close: number,
    volume: number,
    close_time: number,
    quote_asset_volume: number,
    number_of_trades: number,
    taker_buy_base_volume: number,
    taker_buy_quote_volume: number,
    ignore_value: number
}) {
    await setupDb();
    db.run(
        `INSERT INTO price_history (
            open_time, open, high, low, close, volume, close_time,
            quote_asset_volume, number_of_trades, taker_buy_base_volume,
            taker_buy_quote_volume, ignore_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            candle.open_time,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
            candle.close_time,
            candle.quote_asset_volume,
            candle.number_of_trades,
            candle.taker_buy_base_volume,
            candle.taker_buy_quote_volume,
            candle.ignore_value
        ]
    );
    saveDb();
}

// Ambil semua data candle lengkap
export async function getAllCandles() {
    await setupDb();
    const stmt = db.prepare(`SELECT * FROM price_history ORDER BY open_time ASC`);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

module.exports = {
    setupDb,
    saveDb,
    setupSignalTable,
    isSignalSent,
    saveSignal,
    clearOldSignals,
    setupTradeTable,
    saveTrade,
    getAllTrades,
    insertCandle,
    getAllCandles
};