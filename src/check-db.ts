import { setupDb } from './db';

//cek total data di database
async function checkTotalData() {
    const db = await setupDb();
    const row = await db.get('SELECT COUNT(*) as total FROM price_history');
    console.log(`📊 Total data tersimpan: ${row.total}`);
}

checkTotalData();

//cek data terakhir di database
async function checkFirstAndLastTimestamps() {
    const db = await setupDb();
    const first = await db.get('SELECT timestamp FROM price_history ORDER BY timestamp ASC LIMIT 1');
    const last = await db.get('SELECT timestamp FROM price_history ORDER BY timestamp DESC LIMIT 1');

    console.log(`🟢 Pertama: ${first?.timestamp}`);
    console.log(`🔴 Terakhir: ${last?.timestamp}`);
}

checkFirstAndLastTimestamps();

//Lihat Sample 5 Data Terbaru dan Terlama
async function checkSampleData() {
    const db = await setupDb();
    const oldest = await db.all('SELECT * FROM price_history ORDER BY timestamp ASC LIMIT 5');
    const newest = await db.all('SELECT * FROM price_history ORDER BY timestamp DESC LIMIT 5');

    console.log('📜 5 Data Terlama:');
    console.table(oldest);

    console.log('🆕 5 Data Terbaru:');
    console.table(newest);
}

checkSampleData();

//Cek Ada Timestamp Duplikat
async function checkDuplicates() {
    const db = await setupDb();
    const duplicates = await db.all(`
    SELECT timestamp, COUNT(*) as count 
    FROM price_history 
    GROUP BY timestamp 
    HAVING count > 1
  `);

    if (duplicates.length > 0) {
        console.log('⚠️ Terdapat duplikat timestamp:');
        console.table(duplicates);
    } else {
        console.log('✅ Tidak ada duplikat timestamp.');
    }
}

checkDuplicates();
