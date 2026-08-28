import { formatQuantity, formatPrice, getPrecision } from "../src/lib/binance";
import { calculateStopLossPrice, calculateMinimumExitPrice, Candle } from "../src/lib/indicators";
import { evaluateStrategySignal } from "../src/lib/strategies";

async function runTests() {
  console.log("=== Testing Precision & Manual Assist Bot Functions ===");

  // Test 1: Precision calculation
  console.assert(getPrecision("0.00100000") === 3, "Precision of 0.00100000 should be 3");
  console.assert(getPrecision("0.01") === 2, "Precision of 0.01 should be 2");

  // Test 2: Quantity formatting
  const qty1 = formatQuantity(0.0018591, "0.00100000");
  console.log("Format 0.0018591 with stepSize 0.001 =>", qty1);
  if (qty1 !== "0.001") throw new Error(`Expected 0.001, got ${qty1}`);

  // Test 3: Price formatting
  const price1 = formatPrice(65432.19, "0.10000000");
  console.log("Format 65432.19 with tickSize 0.1 =>", price1);
  if (price1 !== "65432.2") throw new Error(`Expected 65432.2, got ${price1}`);

  // Test 4: Stop-Loss calculation
  const slPrice = calculateStopLossPrice(100, -2.5);
  console.log("Stop loss price for $100 with -2.5% SL =>", slPrice);
  if (slPrice !== 97.5) throw new Error(`Expected 97.5, got ${slPrice}`);

  const mockCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
    t: Date.now() - (30 - i) * 60000,
    o: 100,
    h: 101,
    l: 99,
    c: 100,
    v: 1000
  }));

  // Test 5: Manual Assist (No position -> HOLD, never buy)
  const resManualHold = evaluateStrategySignal("MANUAL_ASSIST", mockCandles, 85);
  console.log("Manual Assist (No Pos) =>", resManualHold.signal, `(${resManualHold.reason})`);
  if (resManualHold.signal !== "HOLD") throw new Error("Manual Assist should HOLD when no position");

  // Test 6: Manual Assist (In profit -> SELL)
  const resManualProfit = evaluateStrategySignal("MANUAL_ASSIST", mockCandles, 105, {
    netTarget: 0.5,
    feeRecovery: 0.2,
    position: { entryPrice: 100, amount: 1, invested: 100 }
  });
  console.log("Manual Assist (In Profit) =>", resManualProfit.signal, `(${resManualProfit.reason})`);
  if (resManualProfit.signal !== "SELL") throw new Error("Manual Assist should SELL when profit target is hit");

  // Test 7: Manual Assist (Stop-Loss Breach -> SELL)
  const resManualSL = evaluateStrategySignal("MANUAL_ASSIST", mockCandles, 95, {
    stopLoss: -1.5,
    position: { entryPrice: 100, amount: 1, invested: 100 }
  });
  console.log("Manual Assist (Stop Loss) =>", resManualSL.signal, `(${resManualSL.reason})`);
  if (resManualSL.signal !== "SELL") throw new Error("Manual Assist should SELL on stop loss breach");

  console.log("All unit and strategy tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
