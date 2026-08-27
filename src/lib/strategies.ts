import { rsi, calculateEMA, calculateATR, calculateMinimumExitPrice, calculateStopLossPrice, Candle } from "./indicators";

export type BotStrategy =
  | "ORACLE_ELITE"
  | "MANUAL_ASSIST"
  | "EMA_SCALPER"
  | "TREND_FOLLOWER"
  | "VWAP_TRADER"
  | "MEAN_REVERSION"
  | "BREAKOUT_HUNTER"
  | "RSI_MOMENTUM"
  | "SWING_TRADER"
  | "AGGRESSIVE"
  | "HYPER_SCALPER"
  | "SNIPER"
  | "MANUAL_CONVERSION"
  | "MANUAL_ENTRY";

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

export const STRATEGY_INFO: Partial<Record<BotStrategy, { name: string; desc: string; extendedDesc: string; color: string; risk: string }>> = {
  ORACLE_ELITE: { 
    name: "Oracle Elite",      
    desc: "Hold until Profit + Fee Recovery",         
    extendedDesc: "Precision-engineered for maximum ROI recovery. Executes trades on RSI oversold pullbacks and holds until net profit exceeds exchange fees and resale margins. Includes hard stop-loss protection.",
    color: "text-[var(--color-crypto-green)]", 
    risk: "LOW" 
  },
  MANUAL_ASSIST: {
    name: "Manual + Auto Exit",
    desc: "Manual Buy with Automated TP/SL Exit",
    extendedDesc: "You buy any coins manually whenever you choose. The bot continuously monitors your open positions 24/7 and automatically sells when your configured Profit Target (+ Fee Recovery) or Stop Loss is met.",
    color: "text-amber-400",
    risk: "LOW"
  },
  EMA_SCALPER: {
    name: "EMA Scalper",
    desc: "Fast EMA(9) / Slow EMA(21) Momentum Crossovers",
    extendedDesc: "Captures micro-trends using dynamic 9 and 21 period exponential moving average crossovers with momentum filters.",
    color: "text-indigo-400",
    risk: "MEDIUM"
  },
  TREND_FOLLOWER: {
    name: "Trend Follower",
    desc: "Multi-Period Trend & ATR Volatility Channel",
    extendedDesc: "Rides sustained macro-trends when fast EMA is stacked above slow EMA, utilizing ATR volatility bands to protect profits.",
    color: "text-blue-400",
    risk: "MEDIUM"
  }
};

/**
 * Evaluates the active trading strategy against market candle history and returns an actionable signal.
 */
export function evaluateStrategySignal(
  strategyName: string,
  candles: Candle[],
  currentPrice: number,
  options: StrategyOptions = {}
): StrategySignalResult {
  if (!candles || candles.length < 25) {
    return { signal: "HOLD", reason: "Insufficient candle history (need >= 25 periods)" };
  }

  const closes = candles.map((c) => c.c);
  const rsiBuy = options.rsiBuyThreshold ?? 40.0;
  const rsiSell = options.rsiSellThreshold ?? 60.0;
  const feeRate = (options.feeRecovery ?? 0.2) / 200;
  const netTarget = options.netTarget ?? 0.5;
  const stopLoss = options.stopLoss ?? -1.5;

  const currentRsi = rsi(closes);
  const position = options.position;
  const hasPos = !!position;

  // 1. HARD STOP-LOSS CHECK (Universal across all strategies)
  if (hasPos && position) {
    const slPrice = calculateStopLossPrice(position.entryPrice, stopLoss);
    if (currentPrice <= slPrice) {
      const lossPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      return {
        signal: "SELL",
        reason: `STOP LOSS HIT: Price $${currentPrice.toFixed(4)} breached SL $${slPrice.toFixed(4)} (${lossPct.toFixed(2)}%)`,
        stopLossPrice: slPrice,
        rsiVal: currentRsi,
      };
    }
  }

  // 2. Minimum exit price to cover fees + net target
  let minExitPrice = 0;
  let isFeeSafe = false;
  if (hasPos && position) {
    minExitPrice = calculateMinimumExitPrice(position.invested, position.amount, feeRate, netTarget);
    isFeeSafe = currentPrice >= minExitPrice;
  }

  // ── STRATEGY: MANUAL ASSIST (Manual Entry + Automated Profit/Stop-Loss Exit) ──
  if (strategyName === "MANUAL_ASSIST") {
    if (!hasPos) {
      return {
        signal: "HOLD",
        reason: "Manual Mode: Awaiting manual buy / entry",
        rsiVal: currentRsi,
      };
    }

    if (isFeeSafe) {
      return {
        signal: "SELL",
        reason: `Target Net Profit Hit ($${currentPrice.toFixed(4)} >= $${minExitPrice.toFixed(4)})`,
        minExitPrice,
        rsiVal: currentRsi,
      };
    }

    return {
      signal: "HOLD",
      reason: `Monitoring Position: Target $${minExitPrice.toFixed(4)} | SL $${calculateStopLossPrice(position!.entryPrice, stopLoss).toFixed(4)}`,
      minExitPrice,
      rsiVal: currentRsi,
    };
  }

  // ── STRATEGY: EMA SCALPER ──
  if (strategyName === "EMA_SCALPER") {
    const fastEmas = calculateEMA(closes, 9);
    const slowEmas = calculateEMA(closes, 21);

    if (fastEmas.length < 2 || slowEmas.length < 2) {
      return { signal: "HOLD", reason: "Calculating EMA buffers...", rsiVal: currentRsi };
    }

    const currFast = fastEmas[fastEmas.length - 1];
    const prevFast = fastEmas[fastEmas.length - 2];
    const currSlow = slowEmas[slowEmas.length - 1];
    const prevSlow = slowEmas[slowEmas.length - 2];

    const bullishCross = prevFast <= prevSlow && currFast > currSlow;
    const bearishCross = prevFast >= prevSlow && currFast < currSlow;

    if (!hasPos) {
      if (bullishCross && currentRsi < 65) {
        return {
          signal: "BUY",
          reason: `EMA 9/21 Golden Cross (Fast: $${currFast.toFixed(2)} > Slow: $${currSlow.toFixed(2)})`,
          fastEma: currFast,
          slowEma: currSlow,
          rsiVal: currentRsi,
        };
      }
    } else {
      if (bearishCross && isFeeSafe) {
        return {
          signal: "SELL",
          reason: `EMA 9/21 Death Cross with Profit Cleared ($${currentPrice.toFixed(2)} >= $${minExitPrice.toFixed(2)})`,
          fastEma: currFast,
          slowEma: currSlow,
          minExitPrice,
        };
      }
      if (currentPrice >= minExitPrice * 1.015) {
        return {
          signal: "SELL",
          reason: `Take-Profit Hit (+${netTarget}% net target achieved)`,
          minExitPrice,
        };
      }
    }

    return {
      signal: "HOLD",
      reason: hasPos ? (isFeeSafe ? "Riding EMA Bull Trend" : "Holding for Fee Recovery") : "Scanning for EMA Cross",
      fastEma: currFast,
      slowEma: currSlow,
      rsiVal: currentRsi,
    };
  }

  // ── STRATEGY: TREND FOLLOWER ──
  if (strategyName === "TREND_FOLLOWER") {
    const ema20Arr = calculateEMA(closes, 20);
    const atrVal = calculateATR(candles, 14);

    if (ema20Arr.length < 2) {
      return { signal: "HOLD", reason: "Buffering Trend Follower indicators..." };
    }

    const currEma20 = ema20Arr[ema20Arr.length - 1];
    const isAboveTrend = currentPrice > currEma20;

    if (!hasPos) {
      if (isAboveTrend && currentRsi > 45 && currentRsi < 68) {
        return {
          signal: "BUY",
          reason: `Trend Breakout: Price $${currentPrice.toFixed(2)} > EMA20 $${currEma20.toFixed(2)} | RSI: ${currentRsi.toFixed(1)}`,
          rsiVal: currentRsi,
        };
      }
    } else {
      if (isFeeSafe && (currentRsi > rsiSell || currentPrice < currEma20 - atrVal)) {
        return {
          signal: "SELL",
          reason: `Trend Exit / Profit Secured ($${currentPrice.toFixed(2)} >= $${minExitPrice.toFixed(2)})`,
          minExitPrice,
          rsiVal: currentRsi,
        };
      }
    }

    return {
      signal: "HOLD",
      reason: hasPos ? "Riding Macro Trend" : "Awaiting Trend Alignment",
      rsiVal: currentRsi,
    };
  }

  // ── DEFAULT STRATEGY: ORACLE ELITE (RSI + Fee Recovery) ──
  if (!hasPos) {
    if (currentRsi < rsiBuy) {
      return {
        signal: "BUY",
        reason: `RSI Oversold (${currentRsi.toFixed(1)} < ${rsiBuy})`,
        rsiVal: currentRsi,
      };
    }
  } else {
    if (currentRsi > rsiSell && isFeeSafe) {
      return {
        signal: "SELL",
        reason: `RSI Overbought (${currentRsi.toFixed(1)} > ${rsiSell}) & Fee Target Cleared`,
        minExitPrice,
        rsiVal: currentRsi,
      };
    }
    if (currentPrice >= minExitPrice && currentRsi > 55) {
      return {
        signal: "SELL",
        reason: `Target Net Profit Hit ($${currentPrice.toFixed(2)} >= $${minExitPrice.toFixed(2)})`,
        minExitPrice,
        rsiVal: currentRsi,
      };
    }
    if (!isFeeSafe) {
      return {
        signal: "HOLD",
        reason: `Fee Trap Shield: Current $${currentPrice.toFixed(2)} < Target $${minExitPrice.toFixed(2)}`,
        minExitPrice,
        rsiVal: currentRsi,
      };
    }
  }

  return { signal: "HOLD", reason: `RSI Ranging (${currentRsi.toFixed(1)})`, rsiVal: currentRsi };
}
