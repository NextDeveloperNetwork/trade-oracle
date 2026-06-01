/**
 * Professional-grade technical indicators for the Oracle Trading Engine.
 * Shared between client-side context (real-time) and server-side background bot.
 */

export type Candle = { o: number; h: number; l: number; c: number; v: number; t: number };

export const rsi = (prices: number[], period = 14): number => {
  if (prices.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period + 1; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
};

export const calculateATR = (candles: Candle[], period = 14) => {
  if (candles.length < period + 1) return 0;
  let trSum = 0;
  for (let i = 1; i <= period; i++) {
    const c = candles[i], p = candles[i - 1];
    trSum += Math.max(c.h - c.l, Math.abs(c.h - p.c), Math.abs(c.l - p.c));
  }
  return trSum / period;
};

/**
 * Calculates the exact exit price required to clear entry/exit fees 
 * and secure the desired net profit percentage.
 */
export const calculateMinimumExitPrice = (
  invested: number,
  amount: number,
  feeRate: number, // decimal per side, e.g. 0.001
  netTargetPct: number // %
): number => {
  const targetUSDT = invested * (1 + netTargetPct / 100);
  return targetUSDT / (amount * (1 - feeRate));
};
