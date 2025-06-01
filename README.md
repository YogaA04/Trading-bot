# Trading Bot

Aplikasi trading bot otomatis untuk Bitcoin berbasis Node.js. Bot ini mengambil data harga BTC/USD dari CoinGecko, menyimpan ke database SQLite, menganalisa sinyal trading menggunakan indikator teknikal, dan mengirimkan sinyal ke Telegram.

## Sumber Data

- **Harga BTC/USD** diambil secara otomatis dari [CoinGecko API](https://www.coingecko.com/).
- Data harga disimpan di database lokal **SQLite** pada tabel `price_history`.

## Algoritma Analisa

Bot ini menggunakan kombinasi beberapa indikator teknikal untuk menghasilkan sinyal trading:

- **Exponential Moving Average (EMA):**  
  - EMA Fast (periode 10) dan EMA Slow (periode 30) untuk mendeteksi tren.
- **Relative Strength Index (RSI):**  
  - RSI periode 14 untuk menghindari entry saat pasar overbought.
- **Average True Range (ATR):**  
  - ATR periode 14 untuk menentukan level stop loss dan take profit dinamis.
- **Breakout High:**  
  - Entry dilakukan saat harga menembus harga tertinggi 24 jam terakhir.

### Logika Sinyal

- **BUY:**  
  - EMA Fast > EMA Slow (uptrend)
  - RSI < 70 (tidak overbought)
  - Harga saat ini > harga tertinggi 24 jam terakhir (breakout)
  - Stop Loss dan Take Profit dihitung berdasarkan risk 1% dan reward 2% dari modal (default $100, leverage 25x).

- **SELL:**  
  - EMA Fast < EMA Slow (downtrend)
  - Atau sinyal crossing ke bawah
  - Stop Loss dan Take Profit juga dihitung berdasarkan risk/reward yang sama.

## Instalasi

1. **Clone repository:**
    ```bash
    git clone https://github.com/username/Trading-bot.git
    cd Trading-bot
    ```
2. **Install dependencies:**
    ```bash
    npm install
    ```
3. **(Opsional) Konfigurasi:**  
   Edit parameter trading di file `src/analyzer.ts` jika ingin mengubah modal, leverage, risk, atau reward.

## Cara Menggunakan

1. **Jalankan aplikasi:**
    ```bash
    npm start
    ```
   atau
    ```bash
    npx ts-node src/index.ts
    ```
    jika data harga btc di DB tidak ada jalankan
    ```bash
    npm run fetch:year
    ```
2. **Bot akan otomatis:**
    - Mengambil data harga BTC terbaru dari CoinGecko.
    - Menyimpan data ke database SQLite.
    - Melakukan analisa sinyal trading setiap jam.
    - Mengirimkan sinyal BUY/SELL ke Telegram jika ada peluang trading.

3. **Cek hasil sinyal:**  
   - Sinyal akan tampil di terminal dan dikirim ke Telegram (pastikan sudah mengatur bot Telegram di file `src/notifier.ts`).

## Kontribusi

Silakan buat pull request atau buka issue untuk perbaikan dan pengembangan lebih lanjut.

## Lisensi

Lihat file `LICENSE` untuk detail lisensi.