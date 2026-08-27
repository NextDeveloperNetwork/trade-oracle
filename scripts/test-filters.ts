import { formatQuantity, formatPrice, getPrecision } from "../src/lib/binance";
import { calculateStopLossPrice, calculateEMA, calculateMinimumExitPrice, Candle } from "../src/lib/indicators";
import { evaluateStrategySignal } from "../src/lib/strategies";

async function runTests() {
  console.log("=== Testing Precision & Indicator Functions ===");

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

  // Test 5: Strategy Evaluator - Oracle Elite (Oversold -> BUY)
  const mockCandles: Candle[] = Array.from({ length: 30 }, (_, i) => ({
    t: Date.now() - (30 - i) * 60000,
    o: 100 - i * 0.5,
    h: 100 - i * 0.4,
    l: 100 - i * 0.6,
    c: 100 - i * 0.5,
    v: 1000
  }));

  const resOracle = evaluateStrategySignal("ORACLE_ELITE", mockCandles, 85, { rsiBuyThreshold: 40 });
  console.log("Oracle Elite Signal for falling prices =>", resOracle.signal, `(${resOracle.reason})`);
  if (resOracle.signal !== "BUY") throw new Error(`Expected BUY signal for oversold candles, got ${resOracle.signal}`);

  // Test 6: Strategy Evaluator - Stop Loss Triggered
  const resSL = evaluateStrategySignal("ORACLE_ELITE", mockCandles, 80, {
    stopLoss: -1.5,
    position: { entryPrice: 100, amount: 1, invested: 100 }
  });
  console.log("Oracle Elite Signal on -20% drop =>", resSL.signal, `(${resSL.reason})`);
  if (resSL.signal !== "SELL") throw new Error(`Expected SELL signal on stop loss breach, got ${resSL.signal}`);

  // Test 7: Strategy Evaluator - EMA Scalper
  const resEma = evaluateStrategySignal("EMA_SCALPER", mockCandles, 85);
  console.log("EMA Scalper Signal =>", resEma.signal, `(${resEma.reason})`);

  // Test 8: Strategy Evaluator - Manual + Auto Exit (No position -> HOLD)
  const resManualHold = evaluateStrategySignal("MANUAL_ASSIST", mockCandles, 85);
  console.log("Manual Assist (No Pos) =>", resManualHold.signal, `(${resManualHold.reason})`);
  if (resManualHold.signal !== "HOLD") throw new Error("Manual Assist should HOLD when no position");

  // Test 9: Strategy Evaluator - Manual + Auto Exit (In profit -> SELL)
  const resManualProfit = evaluateStrategySignal("MANUAL_ASSIST", mockCandles, 105, {
    netTarget: 0.5,
    feeRecovery: 0.2,
    position: { entryPrice: 100, amount: 1, invested: 100 }
  });
  console.log("Manual Assist (In Profit) =>", resManualProfit.signal, `(${resManualProfit.reason})`);
  if (resManualProfit.signal !== "SELL") throw new Error("Manual Assist should SELL when profit target is hit");

  console.log("All unit and strategy tests passed successfully!");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
