interface TradeInput {
    positionType: 'long' | 'short'; // jenis posisi: long atau short
    entryPrice: number;             // harga masuk
    takeProfitPrice: number;        // harga TP
    stopLossPrice: number;          // harga SL
    btcSize: number;                // ukuran posisi dalam BTC
    leverage: number;               // leverage
    feePercent: number;             // fee taker dalam persen
}

function calculateTradeOutcome(input: TradeInput) {
    const { entryPrice, takeProfitPrice, stopLossPrice, btcSize, leverage, feePercent, positionType } = input;

    // Total modal (hanya sebagian dari nilai transaksi karena leverage)
    const positionValue = entryPrice * btcSize;
    const userCapital = positionValue / leverage;

    const fee = (entryPrice + takeProfitPrice + stopLossPrice) * btcSize * (feePercent / 100) / 2; // Fee dua arah rata-rata

    // TP & SL outcome
    let profit = 0;
    let loss = 0;

    if (positionType === 'long') {
        profit = (takeProfitPrice - entryPrice) * btcSize - fee;
        loss = (entryPrice - stopLossPrice) * btcSize + fee;
    } else {
        profit = (entryPrice - takeProfitPrice) * btcSize - fee;
        loss = (stopLossPrice - entryPrice) * btcSize + fee;
    }

    return {
        userCapital,
        estimatedProfit: profit,
        estimatedLoss: -loss,
        totalFee: fee,
    };
}

// === CONTOH PENGGUNAAN ===

const result = calculateTradeOutcome({
    positionType: 'short',
    entryPrice: 104070,       // dari data awal kamu
    takeProfitPrice: 103000,  // contoh TP (belum kamu sebut)
    stopLossPrice: 105142.6,  // dari data kamu
    btcSize: 0.001,
    leverage: 25,
    feePercent: 0.15          // diasumsikan taker fee 0.15%
});

console.log("Modal Awal (dengan leverage):", result.userCapital.toFixed(2), "USDT");
console.log("Estimasi Keuntungan:", result.estimatedProfit.toFixed(2), "USDT");
console.log("Estimasi Kerugian:", result.estimatedLoss.toFixed(2), "USDT");
console.log("Biaya Total:", result.totalFee.toFixed(2), "USDT");
