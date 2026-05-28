
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type SignalType = "BUY" | "SELL" | "HOLD";

export type BotStrategy =
  | "SCALPER" | "TREND" | "REVERSION" | "BREAKOUT"
  | "MOMENTUM" | "VWAP" | "AGGRESSIVE" | "SWING"
  | "HYPER" | "SNIPER";

export type Candle = { o: number; h: number; l: number; c: number; v: number; t: number };

type TradeLog = { id: string; time: string; coin: string; price: string; signal: SignalType; reason?: string };
type ExecutedTrade = { id: string; time: string; coin: string; action: "BUY" | "SELL"; amount: string; price: string; totalUSDT: string };
type Notification = { id: string; msg: string; type: "error" | "info" | "success" };

// Round-trip trade: BUY entry → SELL exit with P&L
type CompletedTrade = {
  id: string;
  coin: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  amount: number;       // coin quantity
  invested: number;     // USDT spent on BUY
  returned: number;     // USDT received on SELL  
  profit: number;       // returned - invested
  profitPct: number;    // (profit / invested) * 100
  strategy: BotStrategy;
};

type OpenPosition = {
  coin: string;
  entryTime: string;
  entryPrice: number;
  amount: number;
  invested: number;
  strategy: BotStrategy;
};

export type HistorySnapshot = { t: number; v: number };

type LiveCoinState = {
  price: number | null;
  prevPrice: number | null;
  gain: number | null;
  signal: SignalType;
  atr?: number;
  volatility?: number;
  rsiValue?: number;
  isReady?: boolean;
  volume?: number;
  avgPrice?: number;
  profitPct?: number;
  botStatus?: string;
  filters?: {
    tickSize: string;
    stepSize: string;
    minQty: string;
    minNotional: string;
  };
  history?: number[];
  candleHistory?: Candle[];
};

type Portfolio = Record<string, number>;

type TradingContextType = {
  isLiveMode: boolean;
  toggleLiveMode: () => void;
  isAutoTrading: boolean;
  toggleAutoTrading: () => void;
  currentStrategy: BotStrategy;
  setStrategy: (s: BotStrategy) => void;
  balances: Portfolio;
  setUSDTBalance: (amount: number) => void;
  executeTrade: (action: "BUY" | "SELL", coin: string, usdtAmount: number, isInternal?: boolean, exactQty?: number) => Promise<boolean>;
  executeTriangulation: (fromAsset: string, toAsset: string, amountOfFrom: number) => Promise<boolean>;
  marketData: Record<string, LiveCoinState>;
  activeCoins: string[];
  addCoin: (symbol: string) => void;
  removeCoin: (symbol: string) => void;
  signalsLog: TradeLog[];
  tradeHistory: ExecutedTrade[];
  completedTrades: CompletedTrade[];
  notifications: Notification[];
  totalUSDT: number;
  totalProfit: number;
  syncBalances: () => Promise<void>;
  convertFromAsset: string;
  setConvertFromAsset: (a: string) => void;
  snapshots: HistorySnapshot[];
  openPositions: OpenPosition[];
  resetAll: () => void;
  resetPnL: () => void;
  // totalUSDT is a stable state value, not recomputed inline
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COINS = ["BTC", "ETH", "XRP"];
export const SAFE_RESERVE = 11.0;    // Re-applied $11 hold for nano-trade lubrication
export const MAX_OPEN_POSITIONS = 5;  // Increased to 5 slots per user request
const MAX_TRADE_USD  = 25.00; // Raised to avoid fee-heavy nano-trades ($15-25 min)
const NANO_BUFFER  = 1.0;     // Safety buffer for nano-trades ($1.00 extra)
const MIN_NOTIONAL_CONST = 10.0; // Default fallback
const MIN_BOT_USD  = 0.05;    // Minimum bot trade size to bother with
const MAX_ALLOCATION = 0.30;  // Max 30% of available funds per trade

const COOLDOWNS: Record<BotStrategy, number> = {
  HYPER: 5_000, SCALPER: 10_000, AGGRESSIVE: 10_000,
  MOMENTUM: 20_000, VWAP: 20_000, TREND: 60_000,
  REVERSION: 60_000, BREAKOUT: 90_000, SWING: 120_000, SNIPER: 300_000,
};

const ORACLE_AUTH_TOKEN = "oracle_default_secret_9988";
// ─── Math Helpers ────────────────────────────────────────────────────────────

const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const std = (a: number[]) => { const m = avg(a); return Math.sqrt(avg(a.map(v => (v - m) ** 2))); };

const ema = (prices: number[], period: number): number => {
  const k = 2 / (period + 1);
  let e = prices[0];
  for (let i = 1; i < prices.length; i++) e = prices[i] * k + e * (1 - k);
  return e;
};

const rsi = (prices: number[], period = 14): number => {
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

const atr = (candles: Candle[], period = 14): number => {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(1).map((c, i) =>
    Math.max(c.h - c.l, Math.abs(c.h - candles[i].c), Math.abs(c.l - candles[i].c))
  );
  return avg(trs.slice(-period));
};

const volatility = (prices: number[], period = 20): number => {
  if (prices.length < period) return 0;
  const w = prices.slice(-period);
  const m = avg(w);
  return Math.sqrt(avg(w.map(p => (p - m) ** 2))) / m;
};

const volumeRatio = (vols: number[], period = 20): number => {
  if (vols.length < period + 1) return 1;
  const avgV = avg(vols.slice(-period - 1, -1));
  return avgV > 0 ? vols[vols.length - 1] / avgV : 1;
};

// Round value to nearest step/tick size
const roundStep = (val: number, step: string) => {
  const s = parseFloat(step);
  if (!s || s === 0) return val;
  const precision = Math.max(0, -Math.log10(s));
  // Use a small epsilon to avoid floor issues with floating point (e.g. 0.00000001)
  return parseFloat((Math.floor(val / s + 0.00000001) * s).toFixed(10));
};

const formatToPrecision = (val: number, step: string) => {
  const s = parseFloat(step);
  const precision = Math.max(0, Math.round(-Math.log10(s)));
  return val.toFixed(precision);
};

const getWeightedEntry = (positions: OpenPosition[]) => {
  if (positions.length === 0) return 0;
  const totalAmount = positions.reduce((sum, p) => sum + p.amount, 0);
  if (totalAmount === 0) return 0;
  const weightedSum = positions.reduce((sum, p) => sum + (p.entryPrice * p.amount), 0);
  return weightedSum / totalAmount;
};

// ─── Pro Strategies (All candle-aware) ───────────────────────────────────────

function computeSignal(strategy: BotStrategy, candles: Candle[]): SignalType {
  if (candles.length < 10) return "HOLD";
  const closes = candles.map(c => c.c);
  const vols   = candles.map(c => c.v);
  const price  = closes[closes.length - 1];
  const vr     = volumeRatio(vols, 20);
  const vola   = volatility(closes, 20);

  switch (strategy) {
    case "SCALPER": {
      // High-Frequency Sensitivity: EMA cross + RSI
      if (candles.length < 10) return "HOLD";
      const s = ema(closes.slice(-5), 5);
      const l = ema(closes.slice(-15), 15);
      const r = rsi(closes.slice(-10));
      
      const buySignal  = s > l && r < 60;
      const sellSignal = s < l && r > 40;
      
      if (buySignal) return "BUY";
      if (sellSignal) return "SELL";
      return "HOLD";
    }
    case "TREND": {
      // 10-candle momentum + ADX-like filter
      if (candles.length < 20) return "HOLD";
      const change = (price - closes[closes.length - 10]) / closes[closes.length - 10];
      const atrVal = atr(candles, 14);
      const atrPct = atrVal / price;
      if (atrPct < 0.0005) return "HOLD"; // No trending market
      if (change > 0.0015 && vr > 1.0) return "BUY";
      if (change < -0.0015 && vr > 1.0) return "SELL";
      return "HOLD";
    }
    case "REVERSION": {
      // Mean reversion on 50-period (+volume confirmation)
      if (candles.length < 50) return "HOLD";
      const mean = avg(closes.slice(-50));
      const dev  = (price - mean) / mean;
      if (dev < -0.004 && vr > 1.1) return "BUY";
      if (dev > 0.004 && vr > 1.1) return "SELL";
      return "HOLD";
    }
    case "BREAKOUT": {
      // 20-bar channel breakout with ATR expansion confirmation
      if (candles.length < 25) return "HOLD";
      const window = candles.slice(-21, -1);
      const high = Math.max(...window.map(c => c.h));
      const low  = Math.min(...window.map(c => c.l));
      const atrVal = atr(candles, 14);
      const expansion = atrVal > avg(candles.slice(-50).map(c => c.h - c.l)) * 1.1;
      if (price > high && expansion && vr > 1.3) return "BUY";
      if (price < low  && expansion && vr > 1.3) return "SELL";
      return "HOLD";
    }
    case "MOMENTUM": {
      // RSI with volume confirmation
      if (candles.length < 20) return "HOLD";
      const r = rsi(closes.slice(-20));
      if (r < 32 && vr > 0.9) return "BUY";
      if (r > 68 && vr > 0.9) return "SELL";
      return "HOLD";
    }
    case "VWAP": {
      // True VWAP: volume-weighted price
      if (candles.length < 50) return "HOLD";
      const window = candles.slice(-50);
      const totalVol = window.reduce((s, c) => s + c.v, 0);
      const vwap = totalVol > 0
        ? window.reduce((s, c) => s + ((c.h + c.l + c.c) / 3) * c.v, 0) / totalVol
        : avg(window.map(c => c.c));
      const atrVal = atr(candles, 14);
      if (price < vwap - atrVal * 0.6) return "BUY";
      if (price > vwap + atrVal * 0.6) return "SELL";
      return "HOLD";
    }
    case "AGGRESSIVE": {
      // Tight 3/20 EMA + RSI combo
      if (candles.length < 20) return "HOLD";
      const s = ema(closes.slice(-3), 3);
      const l = ema(closes.slice(-20), 20);
      const r = rsi(closes.slice(-15));
      if (s > l && r < 65 && vr > 0.95) return "BUY";
      if (s < l && r > 35 && vr > 0.95) return "SELL";
      return "HOLD";
    }
    case "SWING": {
      // 12/50 EMA + Bollinger Band 2σ confirmation
      if (candles.length < 55) return "HOLD";
      const s12 = ema(closes.slice(-12), 12);
      const l50 = ema(closes.slice(-50), 50);
      const m   = avg(closes.slice(-20));
      const sd  = std(closes.slice(-20));
      if (s12 > l50 && price < m - 1.8 * sd) return "BUY";
      if (s12 < l50 && price > m + 1.8 * sd) return "SELL";
      return "HOLD";
    }
    case "HYPER": {
      // 2-candle micro-momentum with RSI + volume
      if (candles.length < 15) return "HOLD";
      const s2 = avg(closes.slice(-2));
      const l8 = avg(closes.slice(-8));
      const r  = rsi(closes.slice(-14));
      // Tighter RSI and higher volume requirement to skip noise
      if (s2 > l8 * 1.0001 && r < 30 && vr > 1.1) return "BUY";
      if (s2 < l8 * 0.9999 && r > 70 && vr > 1.1) return "SELL";
      return "HOLD";
    }
    case "SNIPER": {
      // Bollinger 2.5σ + RSI extreme + volume spike — fires rarely but clean
      if (candles.length < 35) return "HOLD";
      const m  = avg(closes.slice(-30));
      const sd = std(closes.slice(-30));
      const r  = rsi(closes.slice(-20));
      if (price <= m - 2.5 * sd && r < 28 && vr > 1.4) return "BUY";
      if (price >= m + 2.5 * sd && r > 72 && vr > 1.4) return "SELL";
      return "HOLD";
    }
    default: return "HOLD";
  }
}

// ─── Context Setup ───────────────────────────────────────────────────────────

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }: { children: React.ReactNode }) {
  const [activeCoins, setActiveCoins]     = useState<string[]>(DEFAULT_COINS);
  const [convertFromAsset, setConvertFromAsset] = useState("USDT");
  const [isLiveMode, setIsLiveMode]       = useState(false);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [currentStrategy, setStrategy]     = useState<BotStrategy>("SCALPER");

  const [paperInitial, setPaperInitial] = useState(10_000);
  const [paperBalances, setPaperBalances] = useState<Portfolio>({ USDT: 10000, BTC: 0, ETH: 0, XRP: 0 });
  const [liveBalances, setLiveBalances]   = useState<Portfolio>({ USDT: 0 });

  const balances = isLiveMode ? liveBalances : paperBalances;

  // Guard: prevent save-effects from firing before the hydration load completes
  const hasHydrated = useRef(false);

  // Combined mount effect for all persistent state
  useEffect(() => {
    const savedCoins = localStorage.getItem("activeCoins");
    if (savedCoins) try { setActiveCoins(JSON.parse(savedCoins)); } catch {}
    
    const savedOpen = localStorage.getItem("openPositions");
    if (savedOpen) try { setOpenPositions(JSON.parse(savedOpen)); } catch {}

    const savedSnaps = localStorage.getItem("snapshots");
    if (savedSnaps) try { setSnapshots(JSON.parse(savedSnaps)); } catch {}

    const savedPaperBal = localStorage.getItem("paperBalances");
    if (savedPaperBal) try { setPaperBalances(JSON.parse(savedPaperBal)); } catch {}

    const savedPaperInit = localStorage.getItem("paperInitial");
    if (savedPaperInit) try { setPaperInitial(parseFloat(savedPaperInit)); } catch {}

    const savedLiveInit = localStorage.getItem("liveInitial");
    if (savedLiveInit) try { setLiveInitial(parseFloat(savedLiveInit)); } catch {}

    // Mark hydration complete — save effects may now fire
    hasHydrated.current = true;
  }, []);

  // Synchronous balance ref — always up to date even across async gaps
  const balancesRef = useRef<Portfolio>(balances);
  const setBalances = useCallback((action: React.SetStateAction<Portfolio>) => {
    const update = (prev: Portfolio) => {
      const next = typeof action === "function" ? action(prev) : action;
      balancesRef.current = next;
      return next;
    };
    if (isLiveMode) setLiveBalances(update); else setPaperBalances(update);
  }, [isLiveMode]);

  useEffect(() => { balancesRef.current = balances; }, [balances, isLiveMode]);

  const [marketData, setMarketData] = useState<Record<string, LiveCoinState>>(() => {
    const m: Record<string, LiveCoinState> = {};
    DEFAULT_COINS.forEach(c => { m[c] = { price: null, prevPrice: null, gain: null, signal: "HOLD" }; });
    return m;
  });

  const [signalsLog,  setSignalsLog]  = useState<TradeLog[]>([]);
  const [tradeHistory, setTradeHistory] = useState<ExecutedTrade[]>([]);
  const [completedTrades, setCompletedTrades] = useState<CompletedTrade[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Track open (un-sold) positions per coin
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const openPositionsRef = useRef<OpenPosition[]>([]);
  useEffect(() => { openPositionsRef.current = openPositions; }, [openPositions]);

  const [snapshots, setSnapshots] = useState<HistorySnapshot[]>([]);

  // ─── Ghost Position Scrubber (Rescue Logic) ────────────────────────────────
  // High-performance rescue logic that uses an in-memory registry for entry price recovery.
  const entryRegistryRef = useRef<Record<string, number>>({});
  
  useEffect(() => {
    const saved = localStorage.getItem("entry_registry");
    if (saved) entryRegistryRef.current = JSON.parse(saved);
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;
    setOpenPositions(prev => {
      let changed = false;
      const currentCoinsWithBalance = Object.keys(balances).filter(c => c !== "USDT" && balances[c] > 0);
      const repaired = [...prev];

      currentCoinsWithBalance.forEach(coin => {
        if (!repaired.some(p => p.coin === coin)) {
          const savedPrice = entryRegistryRef.current[coin];
          const fallbackPrice = marketDataRef.current[coin]?.price || 0;
          const finalPrice = savedPrice || fallbackPrice;

          if (finalPrice > 0) {
            repaired.push({
              coin,
              entryTime: "Restored",
              entryPrice: finalPrice,
              amount: balances[coin],
              invested: balances[coin] * finalPrice,
              strategy: strategyRef.current
            });
            changed = true;
          }
        }
      });
      return changed ? repaired : prev;
    });
  }, [balances]); 

  // Watcher: Ensure any coin with a balance is always in activeCoins (subscribes to live price stream)
  useEffect(() => {
    if (!hasHydrated.current) return;
    const coinsWithBalance = Object.keys(balances).filter(c => c !== "USDT" && balances[c] > 0.00001);
    let changed = false;
    const nextActive = [...activeCoins];
    
    coinsWithBalance.forEach(coin => {
      if (!nextActive.includes(coin)) {
        nextActive.push(coin);
        changed = true;
      }
    });

    if (changed) {
      setActiveCoins(nextActive);
      localStorage.setItem("activeCoins", JSON.stringify(nextActive));
    }
  }, [balances, activeCoins]);


  // ─── Refs ──────────────────────────────────────────────────────────────────
  const strategyRef        = useRef(currentStrategy);
  const autoTradeRef       = useRef(isAutoTrading);
  const marketDataRef      = useRef(marketData);
  const historiesRef       = useRef<Record<string, Candle[]>>({});
  const lastTradeTime      = useRef<Record<string, number>>({});
  const lastSigState       = useRef<Record<string, SignalType>>({});
  const prevVolRef         = useRef<Record<string, number>>({});
  // Async accumulator — WebSocket writes here; a separate timer flushes to React state
  const pendingUpdatesRef  = useRef<Record<string, Partial<LiveCoinState>>>({});

  useEffect(() => { strategyRef.current  = currentStrategy; }, [currentStrategy]);
  useEffect(() => { autoTradeRef.current = isAutoTrading;   }, [isAutoTrading]);
  // Note: marketDataRef is kept current by the flush interval below, not a separate effect

  // ─── Coin management ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasHydrated.current) return;
    if (!isLiveMode) {
      localStorage.setItem("paperBalances", JSON.stringify(paperBalances));
      localStorage.setItem("paperInitial", paperInitial.toString());
    }
  }, [paperBalances, paperInitial, isLiveMode]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    localStorage.setItem("activeCoins", JSON.stringify(activeCoins));
  }, [activeCoins]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    localStorage.setItem("openPositions", JSON.stringify(openPositions));
  }, [openPositions]);

  const addCoin = (symbol: string) => {
    const upper = symbol.toUpperCase();
    setActiveCoins(prev => {
      if (!prev.includes(upper)) {
        const next = [...prev, upper];
        localStorage.setItem("activeCoins", JSON.stringify(next));
        return next;
      }
      return prev;
    });
    setMarketData(prev => {
      if (!prev[upper]) {
        return { ...prev, [upper]: { price: null, prevPrice: null, gain: null, signal: "HOLD" } };
      }
      return prev;
    });
  };

  const removeCoin = (symbol: string) => {
    const upper = symbol.toUpperCase();
    setActiveCoins(prev => {
      const next = prev.filter(c => c !== upper);
      localStorage.setItem("activeCoins", JSON.stringify(next));
      return next;
    });
    // Emergency Wipe: also remove any ghost position records for this coin
    setOpenPositions(prev => prev.filter(p => p.coin !== upper));
  };

  const resetAll = () => {
    if (!confirm("Are you sure you want to RESET EVERYTHING? All history, positions, and balances will be wiped.")) return;
    
    // 1. Flush WebSocket & refs (implicit via state resets)
    
    // 2. Clear State
    setPaperBalances({ USDT: 10000 });
    setLiveBalances({ USDT: 0 });
    setPaperInitial(10000);
    setOpenPositions([]);
    setTradeHistory([]);
    setCompletedTrades([]);
    setSnapshots([]);
    setActiveCoins(DEFAULT_COINS);
    setSignalsLog([]);
    setMarketData({});
    
    // 3. Purge registries
    entryRegistryRef.current = {};

    // 4. Clear LocalStorage
    localStorage.clear();
    
    notify("Engine fully reset. All circuits cleared.", "success");
  };

  const resetPnL = () => {
    const { total } = calculateTotalUSDT();
    if (isLiveMode) {
      setLiveInitial(total);
      localStorage.setItem("liveInitial", total.toString());
    } else {
      setPaperInitial(total);
      localStorage.setItem("paperInitial", total.toString());
    }
    notify("Total P&L has been zeroed to current equity.", "success");
  };

  const notify = useCallback((msg: string, type: Notification["type"] = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setNotifications(prev => [...prev.slice(-4), { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  }, []);

  const toggleLiveMode = () => setIsLiveMode(prev => {
    if (!prev) setIsAutoTrading(false);
    return !prev;
  });
  const toggleAutoTrading = () => setIsAutoTrading(p => !p);

  const syncBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/binance", {
        headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
      });
      const data = await res.json();
      if (data.error || data.msg) {
        notify(`Live Sync: ${data.error || data.msg}`, "error");
        return;
      }
      if (data.balances) {
        const nb: Portfolio = { USDT: 0 };
        setActiveCoins(prev => {
          const newActive = [...prev];
          let changed = false;
          data.balances.forEach((b: any) => {
            const total = parseFloat(b.free) + parseFloat(b.locked);
            if (total > 0.0001) {
              nb[b.asset] = total;
              if (b.asset !== "USDT" && !newActive.includes(b.asset)) {
                newActive.push(b.asset);
                changed = true;
              }
            }
          });
          if (changed) {
            localStorage.setItem("activeCoins", JSON.stringify(newActive));
            return newActive;
          }
          return prev;
        });
        setLiveBalances(prev => { balancesRef.current = nb; return nb; });
        notify("Live Binance data synchronized", "success");
      }
    } catch (e: any) { 
      console.error("Sync failed", e);
      notify("Sync failed. Check network or keys.", "error");
    }
  }, [notify]);

  const recordTrade = useCallback((action: "BUY" | "SELL", coin: string, amount: number, price: number, total: number) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const id   = "t-" + Math.random().toString(36).slice(2, 10);
    const dec  = coin === "BTC" || coin === "ETH" ? 6 : 4;

    const loggedTotal = total;
    setTradeHistory(prev => [{ id, time, coin, action, amount: amount.toFixed(dec), price: price.toFixed(2), totalUSDT: loggedTotal.toFixed(2) }, ...prev].slice(0, 100));

    if (action === "BUY") {
      const registry = { ...entryRegistryRef.current, [coin]: price };
      entryRegistryRef.current = registry;
      localStorage.setItem("entry_registry", JSON.stringify(registry));

      setOpenPositions(prev => [...prev, {
        coin, entryTime: time, entryPrice: price,
        amount, invested: loggedTotal, strategy: strategyRef.current,
      }]);
    } else if (action === "SELL") {
      const idx = openPositionsRef.current.findIndex(p => p.coin === coin);
      if (idx !== -1) {
        const pos = openPositionsRef.current[idx];
        const sellPct = Math.min(1, amount / pos.amount);
        const isFullSell = sellPct >= 0.99;

        if (isFullSell) {
          setOpenPositions(prev => prev.filter((_, i) => i !== idx));
          const registry = { ...entryRegistryRef.current };
          delete registry[coin];
          entryRegistryRef.current = registry;
          localStorage.setItem("entry_registry", JSON.stringify(registry));
        } else {
          setOpenPositions(prev => prev.map((p, i) => i === idx ? {
            ...p,
            amount: p.amount - amount,
            invested: p.invested * (1 - sellPct)
          } : p));
        }
        
        const realReturned = amount * price; 
        const portionInvested = pos.invested * sellPct;
        const profit = realReturned - portionInvested;
        const profitPct = portionInvested > 0 ? (profit / portionInvested) * 100 : 0;
        
        const completed: CompletedTrade = {
          id: "ct-" + Math.random().toString(36).slice(2, 10),
          coin,
          entryTime: pos.entryTime,
          exitTime: time,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          amount: amount,
          invested: portionInvested,
          returned: realReturned,
          profit,
          profitPct,
          strategy: pos.strategy,
        };
        setCompletedTrades(prev => [completed, ...prev].slice(0, 500));
      }
    }
  }, [strategyRef]);

  const executeTrade = useCallback(async (
    action: "BUY" | "SELL",
    coin: string,
    usdtAmount: number,
    isInternal = false,
    exactQty?: number
  ): Promise<boolean> => {
    const livePrice = marketDataRef.current[coin]?.price;
    if (!livePrice || usdtAmount <= 0) return false;

    const filters = marketDataRef.current[coin]?.filters;
    const dynamicMinNotional = filters ? parseFloat(filters.minNotional) : MIN_NOTIONAL_CONST;
    const effectiveMinNotional = dynamicMinNotional + 0.01;

    if (!isInternal && usdtAmount < effectiveMinNotional) {
      if (action === "BUY") {
        const totalBuy = usdtAmount + effectiveMinNotional + NANO_BUFFER; 
        const totalFunds = balancesRef.current.USDT || 0;
        if (totalBuy > totalFunds) {
          notify(`Nano-BUY blocked: Need $${totalBuy.toFixed(2)}, only $${totalFunds.toFixed(2)} available.`, "error");
          return false;
        }
        if (totalFunds - usdtAmount < SAFE_RESERVE) {
          notify(`Reserve Protection: $1.00 trade would drop total below $${SAFE_RESERVE}.`, "error");
          return false;
        }
        
        const step1 = await executeTrade("BUY", coin, totalBuy, true);
        if (!step1) return false;
        
        await new Promise(r => setTimeout(r, 400));
        
        const trimAmount = effectiveMinNotional + NANO_BUFFER;
        const step2 = await executeTrade("SELL", coin, trimAmount, true);
        if (!step2) notify("Nano-BUY trim failed: holding extra asset.", "info");
        return true;
      }

      if (action === "SELL") {
        const inflationAmount = effectiveMinNotional + NANO_BUFFER;
        const totalSell = usdtAmount + inflationAmount;
        const totalFunds = balancesRef.current.USDT || 0;
        if (inflationAmount > totalFunds) {
          notify(`Nano-SELL blocked: Need $${inflationAmount.toFixed(2)} to inflate, only $${totalFunds.toFixed(2)} available.`, "error");
          return false;
        }

        const step1 = await executeTrade("BUY", coin, inflationAmount, true);
        if (!step1) return false;
        
        await new Promise(r => setTimeout(r, 400));
        
        const step2 = await executeTrade("SELL", coin, totalSell, true);
        if (!step2) notify("Nano-SELL dump failed: check holdings.", "info");
        return true;
      }
    }

    if (action === "BUY" && !isInternal) {
      const afterTrade = (balancesRef.current.USDT || 0) - usdtAmount;
      if (afterTrade < SAFE_RESERVE) {
        notify(`Reserve Protection: trade would leave less than $${SAFE_RESERVE} USDT.`, "error");
        return false;
      }
      addCoin(coin);
    }

    const coinAmount = exactQty || usdtAmount / livePrice;

    if (isLiveMode) {
      try {
        const filters = marketDataRef.current[coin]?.filters;
        const tickSize = filters?.tickSize || "0.01";
        const stepSize = filters?.stepSize || "0.00001";
        const minNotional = parseFloat(filters?.minNotional || "10.0");

        if (usdtAmount < minNotional && !isInternal) {
          notify(`Trade too small: $${usdtAmount.toFixed(2)} < $${minNotional}`, "error");
          return false;
        }

        const roundedQty = roundStep(coinAmount, stepSize);
        const formattedQty = formatToPrecision(roundedQty, stepSize);
        const formattedUsdt = usdtAmount.toFixed(2);

        const res = await fetch("/api/binance", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-oracle-token": ORACLE_AUTH_TOKEN 
          },
          body: JSON.stringify({ 
            symbol: coin, 
            side: action, 
            quantity: formattedQty, 
            usdtAmount: formattedUsdt 
          })
        });
        const result = await res.json();
        if (result.orderId) {
          await syncBalances();
          recordTrade(action, coin, parseFloat(formattedQty), livePrice, usdtAmount);
          return true;
        }
        if (result.msg || result.error) notify(`Binance Error: ${result.msg || result.error} (Qty: ${formattedQty})`, "error");
        return false;
      } catch (e: any) {
        notify(`API error: ${e.message}`, "error");
        return false;
      }
    }

    const PAPER_FEE = 0.001; // 0.1% simulation fee
    if (action === "BUY") {
      if ((balancesRef.current.USDT || 0) < usdtAmount) return false;
      const fee = usdtAmount * PAPER_FEE;
      setBalances(prev => ({ 
        ...prev, 
        USDT: (prev.USDT || 0) - usdtAmount - fee, 
        [coin]: (prev[coin] || 0) + coinAmount 
      }));
    } else {
      if ((balancesRef.current[coin] || 0) < coinAmount) return false;
      const fee = usdtAmount * PAPER_FEE;
      setBalances(prev => ({ 
        ...prev, 
        [coin]: Math.max(0, (prev[coin] || 0) - coinAmount), 
        USDT: (prev.USDT || 0) + usdtAmount - fee 
      }));
    }
    recordTrade(action, coin, coinAmount, livePrice, usdtAmount);
    return true;
  }, [isLiveMode, notify, syncBalances, setBalances]);

  const coinsKey = activeCoins.join(',');

  useEffect(() => {
    if (activeCoins.length === 0) return;

    let ws: WebSocket;
    let reconnectTimer: any;
    let flushId: any;

    const connect = () => {
      const streams = activeCoins.map(c => `${c.toLowerCase()}usdt@ticker`).join("/");
      const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
      ws = new WebSocket(wsUrl);

      ws.onerror = () => notify(`Price stream error. System re-syncing…`, "error");
      ws.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting in 3s...");
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        const data = msg.data || msg;
        if (!data.s) return;
      
        const symbol = data.s;
        const coin = symbol.replace("USDT", "");
        const price = parseFloat(data.c);
        const last24hVol = parseFloat(data.v);
        const prev24hVol = prevVolRef.current[coin] || last24hVol;
        const intervalVol = Math.max(0, last24hVol - prev24hVol);
        prevVolRef.current[coin] = last24hVol;
        const now   = Date.now();
        const bucketTime = Math.floor(now / 1000) * 1000;

        const hist = historiesRef.current[coin] || [];
        let lastCandle = hist.length > 0 ? hist[hist.length - 1] : null;

        if (!lastCandle || lastCandle.t !== bucketTime) {
          const newCandle: Candle = { o: price, h: price, l: price, c: price, v: intervalVol, t: bucketTime };
          hist.push(newCandle);
          lastCandle = newCandle;
        } else {
          lastCandle.c = price;
          lastCandle.h = Math.max(lastCandle.h, price);
          lastCandle.l = Math.min(lastCandle.l, price);
          lastCandle.v += intervalVol; 
        }
        historiesRef.current[coin] = hist.slice(-300);

        const closes = hist.map(c => c.c);
        pendingUpdatesRef.current[coin] = {
          prevPrice:  marketDataRef.current[coin]?.price ?? null,
          price,
          signal:     marketDataRef.current[coin]?.signal ?? "HOLD",
          gain:       marketDataRef.current[coin]?.gain   ?? null,
          volume:     intervalVol,
          volatility: volatility(closes, 20),
          atr:        atr(hist, 14),
          rsiValue:   rsi(closes.slice(-20)),
          isReady:    hist.length >= 15,
          history:    closes.slice(-30),
          candleHistory: hist.slice(-60)
        };
      };
    };

    connect();

    flushId = setInterval(() => {
      const pending = pendingUpdatesRef.current;
      if (Object.keys(pending).length === 0) return;
      pendingUpdatesRef.current = {};
      setMarketData(prev => {
        const next = { ...prev };
        for (const [c, update] of Object.entries(pending)) {
          next[c] = { ...(prev[c] || { price: null, prevPrice: null, gain: null, signal: "HOLD" }), ...update };
        }
        marketDataRef.current = next;
        return next;
      });
    }, 500);

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(flushId);
    };
  }, [coinsKey]);

  useEffect(() => {
    const tick = () => {
      let currentAndPlanned = openPositionsRef.current.length;

      activeCoins.forEach(coin => {
        const hist = historiesRef.current[coin];
        if (!hist || hist.length < 15) return;

        const price = hist[hist.length - 1].c;
        const newSig = computeSignal(strategyRef.current, hist);
        const balance = balancesRef.current[coin] || 0;
        const hasCoin = balance * price > 0.5;
        const now = Date.now();
        
        if (hist.length < 10) {
           setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: `Booting ${hist.length}/10` } }));
           return;
        }
        
        let displaySig = newSig;
        if (newSig === "SELL" && !hasCoin) displaySig = "HOLD"; 
        if (newSig === "BUY" && hasCoin) displaySig = "HOLD";   

        const signal_changed = lastSigState.current[coin] !== displaySig;

        if (signal_changed) {
          lastSigState.current[coin] = displaySig;
          
          const myPos = openPositionsRef.current.filter(p => p.coin === coin);
          const avgEntry = getWeightedEntry(myPos);
          const pnl = avgEntry > 0 ? ((price - avgEntry) / avgEntry) * 100 : 0;

          setMarketData(prev => ({ 
            ...prev, 
            [coin]: { ...prev[coin], signal: displaySig, avgPrice: avgEntry, profitPct: pnl } 
          }));

          if (displaySig !== "HOLD") {
            setSignalsLog(prev => [{
              id:     "s-" + Math.random().toString(36).slice(2, 8),
              time:   new Date().toLocaleTimeString(),
              coin,
              price:  price.toFixed(coin === "CELR" || coin === "DUSK" ? 4 : 2),
              signal: displaySig as SignalType,
              reason: `EMA/RSI Pattern Detected (${strategyRef.current})`
            }, ...prev].slice(0, 100));
          } else if (newSig !== "HOLD" && signal_changed) {
             // Patterns detected but filtered by position guard
             setSignalsLog(prev => [{
                id:     "s-" + Math.random().toString(36).slice(2, 8),
                time:   new Date().toLocaleTimeString(),
                coin,
                price:  price.toFixed(2),
                signal: "HOLD" as SignalType,
                reason: `Signal ${newSig} Suppressed: Pos Exists`
             }, ...prev].slice(0, 100));
          }
        }

        if (!autoTradeRef.current) return;

        const dynCooldown = COOLDOWNS[strategyRef.current] || 15_000;
        const lastTr  = lastTradeTime.current[coin] || 0;
        if (now - lastTr < dynCooldown) {
          const remaining = Math.ceil((dynCooldown - (now - lastTr)) / 1000);
          setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: `CD ${remaining}s` } }));
          return; 
        }

        const needsBuy  = newSig === "BUY"  && !hasCoin;
        const needsSell = newSig === "SELL" && hasCoin;

        let forceSell = false;
        if (hasCoin) {
          const myPos = openPositionsRef.current.filter(p => p.coin === coin);
          const avgEntry = getWeightedEntry(myPos);
          const profit = avgEntry > 0 ? (price - avgEntry) / avgEntry : 0;

          const isTakeProfit = profit > 0.008;
          const isStopLoss   = profit < -0.015;

          if (isTakeProfit || isStopLoss) forceSell = true;
        }

        if (!needsBuy && !needsSell && !forceSell) {
          // Show why the bot is idle for this coin
          if (newSig === "BUY" && hasCoin) {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "Already In" } }));
          } else if (newSig === "SELL" && !hasCoin) {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "No Position" } }));
          } else {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "Waiting…" } }));
          }
          return;
        }

        lastTradeTime.current[coin] = now;

        if (needsBuy) {
          if (currentAndPlanned >= MAX_OPEN_POSITIONS) {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: `Full ${currentAndPlanned}/${MAX_OPEN_POSITIONS}` } }));
            return;
          }
          currentAndPlanned++; // Reserve slot immediately to prevent race in this tick loop
          const bal  = balancesRef.current.USDT || 0;
          const aggr = ["HYPER", "AGGRESSIVE", "SNIPER"].includes(strategyRef.current);
          const baseConf = aggr ? 0.10 : 0.05;
          const closes = hist.map(c => c.c);
          const s = avg(closes.slice(-5));
          const l = avg(closes.slice(-20));
          const conf = Math.min(MAX_ALLOCATION, Math.max(baseConf, (Math.abs(s - l) / l) * 80));
          let amt = (bal - SAFE_RESERVE) * conf;
          amt = Math.min(amt, MAX_TRADE_USD);

          const filters = marketDataRef.current[coin]?.filters;
          const dynamicMinNotional = filters ? parseFloat(filters.minNotional) : MIN_NOTIONAL_CONST;
          const neededForNano = dynamicMinNotional + NANO_BUFFER + amt;

          if (bal < neededForNano) {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: `Low $${bal.toFixed(0)}` } }));
            return;
          }

          const projectedFinalUSDT = bal - amt;
          if (projectedFinalUSDT < SAFE_RESERVE) {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "At Reserve" } }));
            return;
          }

          setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: `Buying $${amt.toFixed(0)}…` } }));
          executeTrade("BUY", coin, amt).then(ok => {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: ok ? "✓ Bought" : "✗ Failed" } }));
          });
        } else if (needsSell || forceSell) {
          const coinBal = balancesRef.current[coin] || 0;
          const sellVal = coinBal * price;
          if (sellVal < MIN_BOT_USD) {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "Too Small" } }));
            return;
          }

          const label = forceSell ? "Force Sell…" : "Selling…";
          setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: label } }));
          executeTrade("SELL", coin, sellVal).then(ok => {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: ok ? "✓ Sold" : "✗ Failed" } }));
          });
        }
      });
    };

    const id = setInterval(tick, 1500);
    return () => clearInterval(id);
  }, [activeCoins, executeTrade]);

  useEffect(() => {
    const fetchMarketInfo = async () => {
      try {
        const res  = await fetch("/api/binance?type=exchangeInfo", {
          headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
        });
        const data = await res.json();
        if (!Array.isArray(data)) return;
        
        setMarketData(prev => {
          const next = { ...prev };
          data.forEach((d: any) => {
            const coin = d.baseAsset;
            if (next[coin]) {
              next[coin] = { 
                ...next[coin], 
                gain: parseFloat(d.gain),
                filters: d.filters
              };
            } else if (activeCoins.includes(coin)) {
              next[coin] = {
                price: null,
                prevPrice: null,
                gain: parseFloat(d.gain),
                signal: "HOLD",
                filters: d.filters
              };
            }
          });
          marketDataRef.current = next;
          return next;
        });
      } catch (e) {
        console.error("Failed to fetch market info:", e);
      }
    };
    fetchMarketInfo();
    const id = setInterval(fetchMarketInfo, 60_000);
    return () => clearInterval(id);
  }, [activeCoins]);

  // ─── P&L ─────────────────────────────────────────────────────────────────

  const [liveInitial,  setLiveInitial]  = useState<number | null>(null);
  const [totalProfit,  setTotalProfit]  = useState(0);
  const [totalUSDT,    setTotalUSDT]    = useState(0);

  const calculateTotalUSDT = useCallback(() => {
    let total = balances.USDT || 0;
    let hasStalePrice = false;

    Object.keys(balances).forEach(c => {
      if (c === "USDT") return;
      const amount = balances[c] || 0;
      if (amount <= 0.00000001) return;
      
      const p = marketData[c]?.price;
      if (p && p > 0) {
        total += amount * p;
      } else {
        // We have a balance but no price -> this will cause a false P&L drop
        hasStalePrice = true;
      }
    });

    return { total, isStale: hasStalePrice };
  }, [balances, marketData]);

  useEffect(() => {
    const { total, isStale } = calculateTotalUSDT();
    if (isStale && totalUSDT > 0) return; // Prevent flickering to lower values during sync
    
    setTotalUSDT(total);
    if (isLiveMode) {
      if (liveInitial === null && total > 0 && !isStale) { 
        setLiveInitial(total);
        localStorage.setItem("liveInitial", total.toString());
      }
      else if (liveInitial !== null) setTotalProfit(total - liveInitial);
    } else {
      setTotalProfit(total - paperInitial);
    }
  }, [balances, marketData, isLiveMode, liveInitial, paperInitial, calculateTotalUSDT, totalUSDT]);

  useEffect(() => { if (isLiveMode) syncBalances(); }, [isLiveMode, syncBalances]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    const timer = setTimeout(() => {
      localStorage.setItem("snapshots", JSON.stringify(snapshots));
    }, 2000);
    return () => clearTimeout(timer);
  }, [snapshots]);

  const setUSDTBalance = (amount: number) => {
    // Avoid double-firing side effects in setBalances updater (React StrictMode)
    const currentUSDT = balancesRef.current.USDT || 0;
    const diff = amount - currentUSDT;
    if (!isLiveMode) {
      setPaperInitial(base => base + diff);
    }
    setBalances(prev => ({ ...prev, USDT: amount }));
  };

  // ─── Portfolio Historian (Snapshots for P&L) ──────────────────────────────

  useEffect(() => {
    const takeSnapshot = () => {
      const { total, isStale } = calculateTotalUSDT();
      if (total <= 0 || isStale) return;
      
      setSnapshots(prev => {
        const now = Date.now();
        const newSnapshot = { t: now, v: total };
        const updated = [...prev, newSnapshot];
        
        // Pruning logic: keep all from last 24h, then 1 per hour for 1mo, 1 per day for 1y
        if (updated.length < 5000) return updated;
        
        const oneDayAgo = now - 24 * 60 * 60 * 1000;
        return updated.filter((s, i) => {
          if (s.t > oneDayAgo) return true;
          const prevS = updated[i-1];
          if (!prevS) return true;
          const hour = 60 * 60 * 1000;
          return Math.floor(s.t / hour) !== Math.floor(prevS.t / hour);
        }).slice(-5000);
      });
    };

    const timeout = setTimeout(takeSnapshot, 10000);
    const interval = setInterval(takeSnapshot, 60000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [calculateTotalUSDT]);

  // ─── Triangulation ───────────────────────────────────────────────────────

  const executeTriangulation = useCallback(async (fromAsset: string, toAsset: string, amountOfFrom: number): Promise<boolean> => {
    if ((balancesRef.current[fromAsset] || 0) < amountOfFrom) {
      notify("Insufficient balance for conversion.", "error"); return false;
    }
    if (fromAsset === "USDT" && (balancesRef.current.USDT || 0) - amountOfFrom < SAFE_RESERVE) {
      notify("Reserve Protection: conversion would drop USDT below $10.", "error"); return false;
    }

    if (isLiveMode) {
      let usdt = 0;
      if (fromAsset !== "USDT") {
        const p = marketDataRef.current[fromAsset]?.price;
        if (!p) return false;
        usdt = amountOfFrom * p;
        const sold = await executeTrade("SELL", fromAsset, usdt, true);
        if (!sold) return false;
      } else { usdt = amountOfFrom; }
      if (toAsset !== "USDT") {
        const bought = await executeTrade("BUY", toAsset, usdt, true);
        if (!bought) return false;
      }
      return true;
    }

    // Simulator
    const fromPrice = fromAsset === "USDT" ? 1 : (marketDataRef.current[fromAsset]?.price || 0);
    const toPrice   = toAsset   === "USDT" ? 1 : (marketDataRef.current[toAsset]?.price   || 0);
    if (!fromPrice || !toPrice) return false;
    const usdtValue = amountOfFrom * fromPrice;
    const toAmount  = usdtValue / toPrice;
    setBalances(prev => ({
      ...prev,
      [fromAsset]: (prev[fromAsset] || 0) - amountOfFrom,
      [toAsset]:   (prev[toAsset]   || 0) + toAmount,
    }));
    return true;
  }, [isLiveMode, executeTrade, notify, setBalances]);

  // ─── Provider ────────────────────────────────────────────────────────────

  return (
    <TradingContext.Provider value={{
      isLiveMode, toggleLiveMode,
      isAutoTrading, toggleAutoTrading,
      currentStrategy, setStrategy,
      balances, setUSDTBalance,
      executeTrade, executeTriangulation,
      marketData, activeCoins, addCoin, removeCoin,
      signalsLog, tradeHistory, completedTrades, notifications,
      totalUSDT,
      totalProfit,
      syncBalances,
      convertFromAsset, setConvertFromAsset,
      snapshots,
      openPositions,
      resetAll,
      resetPnL,
    }}>
      {children}
    </TradingContext.Provider>
  );
}

export function useTradingEngine() {
  const ctx = useContext(TradingContext);
  if (!ctx) throw new Error("useTradingEngine must be used within TradingProvider");
  return ctx;
}
