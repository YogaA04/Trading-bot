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
                    timestamp TEXT NOT NULL,
                    price REAL NOT NULL
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

// Menyimpan data harga baru
export async function insertPrice(timestamp: string, price: number) {
    await setupDb();
    db.run(
        `INSERT INTO price_history (timestamp, price) VALUES (?, ?)`,
        [timestamp, price]
    );
    saveDb();
}

// Mengambil semua data harga
export async function getAllPrices() {
    await setupDb();
    const stmt = db.prepare(`SELECT timestamp, price FROM price_history ORDER BY timestamp ASC`);
    const rows = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
}

// Mengambil harga terakhir
export async function getLastPrice() {
    await setupDb();
    const stmt = db.prepare(`SELECT timestamp, price FROM price_history ORDER BY timestamp DESC LIMIT 1`);
    let row = null;
    if (stmt.step()) {
        row = stmt.getAsObject();
    }
    stmt.free();
    return row;
}

// Tambahkan di bawah setupDb()
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

export async function saveSignal(signal_type: string, price: number, time: string) {
    await setupDb();
    db.run(
        `INSERT INTO sent_signals (signal_type, price, time) VALUES (?, ?, ?)`,
        [signal_type, price, time]
    );
    saveDb();
}

// (Opsional) Hapus sinyal lama, misal hanya simpan 1 hari terakhir
export async function clearOldSignals() {
    await setupDb();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    db.run(`DELETE FROM sent_signals WHERE time < ?`, [yesterday.toISOString().slice(0, 10)]);
    saveDb();
}

module.exports = {
    setupDb,
    insertPrice,
    getAllPrices,
    getLastPrice,
    saveDb,
    setupSignalTable,
    isSignalSent,
    saveSignal,
    clearOldSignals
};