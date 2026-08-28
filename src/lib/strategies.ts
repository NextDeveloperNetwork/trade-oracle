import { calculateMinimumExitPrice, calculateStopLossPrice, Candle } from "./indicators";

export type BotStrategy = "MANUAL_ASSIST";

export interface StrategySignalResult {
  signal: "BUY" | "SELL" | "HOLD";
  reason: string;
  rsiVal?: number;
  fastEma?: number;
  slowEma?: number;
  minExitPrice?: number;
  stopLossPrice?: number;
}

export interface StrategyOptions {
  rsiBuyThreshold?: number;
  rsiSellThreshold?: number;
  feeRecovery?: number;
  netTarget?: number;
  stopLoss?: number;
  position?: {
    entryPrice: number;
    amount: number;
    invested: number;
  };
}

export const STRATEGY_INFO: Record<BotStrategy, { name: string; desc: string; extendedDesc: string; color: string; risk: string }> = {
  MANUAL_ASSIST: {
    name: "Manual + Auto Exit",
    desc: "Manual Buy + Automated TP/SL Exit",
    extendedDesc: "You buy any coins manually whenever you choose. The bot continuously monitors your open positions 24/7 and automatically sells when your configured Profit Target (+ Fee Recovery) or Stop Loss is met.",
    color: "text-amber-400",
    risk: "LOW"
  }
};

/**
 * Evaluates the manual assist trading strategy against market candle history and returns an actionable signal.
 * In this mode, the bot NEVER buys coins on its own. It only executes Take-Profit and Stop-Loss exits.
 */
export function evaluateStrategySignal(
  _strategyName: string = "MANUAL_ASSIST",
  _candles: Candle[] = [],
  currentPrice: number,
  options: StrategyOptions = {}
): StrategySignalResult {
  const feeRate = (options.feeRecovery ?? 0.2) / 200;
  const netTarget = options.netTarget ?? 0.5;
  const stopLoss = options.stopLoss ?? -1.5;
  const position = options.position;

  // 1. If no active position, ALWAYS HOLD (Zero auto-buys)
  if (!position || position.amount <= 0 || position.entryPrice <= 0) {
    return {
      signal: "HOLD",
      reason: "Manual Mode: Awaiting manual coin entry",
    };
  }

  // 2. HARD STOP-LOSS CHECK
  const slPrice = calculateStopLossPrice(position.entryPrice, stopLoss);
  if (currentPrice > 0 && currentPrice <= slPrice) {
    const lossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
    return {
      signal: "SELL",
      reason: `STOP LOSS HIT: Price $${currentPrice.toFixed(4)} breached SL $${slPrice.toFixed(4)} (${lossPct.toFixed(2)}%)`,
      stopLossPrice: slPrice,
    };
  }

  // 3. PROFIT TARGET + FEE RECOVERY CHECK
  const minExitPrice = calculateMinimumExitPrice(position.invested, position.amount, feeRate, netTarget);
  if (currentPrice > 0 && currentPrice >= minExitPrice) {
    return {
      signal: "SELL",
      reason: `Target Net Profit Hit ($${currentPrice.toFixed(4)} >= $${minExitPrice.toFixed(4)})`,
      minExitPrice,
    };
  }

  return {
    signal: "HOLD",
    reason: `Guarding Position: TP $${minExitPrice.toFixed(4)} | SL $${slPrice.toFixed(4)}`,
    minExitPrice,
  };
}
