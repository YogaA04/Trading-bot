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

module.exports = {
    setupDb,
    insertPrice,
    getAllPrices,
    getLastPrice,
    saveDb
};