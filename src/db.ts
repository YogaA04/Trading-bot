import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

export async function openDb() {
    return open({
        filename: path.join(__dirname, '../data/bitcoin_trading.db'),
        driver: sqlite3.Database
    });
}

export async function setupDb() {
    const db = await openDb();
    await db.exec(`
    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      price REAL NOT NULL,
      high REAL,
      low REAL,
      close REAL
    )
  `);
    return db;
}
