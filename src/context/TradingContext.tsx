
"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

type SignalType = "BUY" | "SELL" | "HOLD";

export type BotStrategy =
  | "SCALPER" | "TREND" | "REVERSION" | "BREAKOUT"
  | "MOMENTUM" | "VWAP" | "AGGRESSIVE" | "SWING"
  | "HYPER" | "SNIPER";

type Candle = { o: number; h: number; l: number; c: number; v: number; t: number };

type TradeLog = { id: string; time: string; coin: string; price: string; signal: SignalType };
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
  volume?: number;
  botStatus?: string;
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
  executeTrade: (action: "BUY" | "SELL", coin: string, usdtAmount: number, isInternal?: boolean) => Promise<boolean>;
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
};

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_COINS = ["BTC", "ETH", "XRP"];
const SAFE_RESERVE = 10.0;    // Always keep $10 USDT reserve for operations
const NANO_FILLER  = 10.1;    // Used for buy-and-trim on small trades
const MIN_NOTIONAL = 10.0;    // Binance minimum sell value
const MIN_BOT_USD  = 0.10;    // Minimum bot trade size to bother with
const MAX_ALLOCATION = 0.20;  // Max 20% of available funds per trade

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
  let gains = 0, losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
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

// ─── Pro Strategies (All candle-aware) ───────────────────────────────────────

function computeSignal(strategy: BotStrategy, candles: Candle[]): SignalType {
  if (candles.length < 15) return "HOLD";
  const closes = candles.map(c => c.c);
  const vols   = candles.map(c => c.v);
  const price  = closes[closes.length - 1];
  const vr     = volumeRatio(vols, 20);
  const vola   = volatility(closes, 20);

  switch (strategy) {
    case "SCALPER": {
      // EMA 5/30 cross + volume surge + min volatility filter
      if (candles.length < 30) return "HOLD";
      if (vola < 0.0003) return "HOLD";   // Dead-zone filter
      const s = ema(closes.slice(-5), 5);
      const l = ema(closes.slice(-30), 30);
      if (s > l * 1.00005 && vr > 1.05) return "BUY";
      if (s < l * 0.99995 && vr > 1.05) return "SELL";
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
      // Approximated VWAP with ATR bands
      if (candles.length < 50) return "HOLD";
      const vwapApprox = avg(closes.slice(-50));
      const atrVal = atr(candles.slice(-50), 14);
      if (price < vwapApprox - atrVal * 0.5) return "BUY";
      if (price > vwapApprox + atrVal * 0.5) return "SELL";
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
      if (s2 > l8 * 1.00005 && r < 65 && vr > 1.0) return "BUY";
      if (s2 < l8 * 0.99995 && r > 35 && vr > 1.0) return "SELL";
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
  const [currentStrategy, setStrategy]   = useState<BotStrategy>("SCALPER");

  const [paperBalances, setPaperBalances] = useState<Portfolio>({ USDT: 10000, BTC: 0, ETH: 0, XRP: 0 });
  const [liveBalances, setLiveBalances]   = useState<Portfolio>({ USDT: 0 });

  const balances = isLiveMode ? liveBalances : paperBalances;

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

  // Stable refs for use inside intervals/closures
  const strategyRef        = useRef(currentStrategy);
  const autoTradeRef       = useRef(isAutoTrading);
  const marketDataRef      = useRef(marketData);
  const historiesRef       = useRef<Record<string, Candle[]>>({});
  const lastTradeTime      = useRef<Record<string, number>>({});
  const lastSigState       = useRef<Record<string, SignalType>>({});
  // Async accumulator — WebSocket writes here; a separate timer flushes to React state
  const pendingUpdatesRef  = useRef<Record<string, Partial<LiveCoinState>>>({});

  useEffect(() => { strategyRef.current  = currentStrategy; }, [currentStrategy]);
  useEffect(() => { autoTradeRef.current = isAutoTrading;   }, [isAutoTrading]);
  // Note: marketDataRef is kept current by the flush interval below, not a separate effect

  // ─── Coin management ───────────────────────────────────────────────────────

  useEffect(() => {
    const saved = localStorage.getItem("activeCoins");
    if (saved) try { setActiveCoins(JSON.parse(saved)); } catch {}

    const savedSnaps = localStorage.getItem("portfolioSnapshots");
    if (savedSnaps) try { setSnapshots(JSON.parse(savedSnaps)); } catch {}

    const savedOpen = localStorage.getItem("openPositions");
    if (savedOpen) try { setOpenPositions(JSON.parse(savedOpen)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem("activeCoins", JSON.stringify(activeCoins)); }, [activeCoins]);
  useEffect(() => { localStorage.setItem("portfolioSnapshots", JSON.stringify(snapshots)); }, [snapshots]);
  useEffect(() => { localStorage.setItem("openPositions", JSON.stringify(openPositions)); }, [openPositions]);

  const addCoin = (symbol: string) => {
    const upper = symbol.toUpperCase();
    if (!activeCoins.includes(upper)) {
      setActiveCoins(prev => [...prev, upper]);
      setMarketData(prev => ({ ...prev, [upper]: { price: null, prevPrice: null, gain: null, signal: "HOLD" } }));
    }
  };
  const removeCoin = (symbol: string) => setActiveCoins(prev => prev.filter(c => c !== symbol.toUpperCase()));

  // ─── Notifications ────────────────────────────────────────────────────────

  const notify = useCallback((msg: string, type: Notification["type"] = "info") => {
    const id = Math.random().toString(36).slice(2, 9);
    setNotifications(prev => [...prev.slice(-4), { id, msg, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  }, []);

  // ─── Mode toggles ─────────────────────────────────────────────────────────

  const toggleLiveMode = () => setIsLiveMode(prev => {
    if (!prev) setIsAutoTrading(false); // safety: always disable bot when switching to live
    return !prev;
  });
  const toggleAutoTrading = () => setIsAutoTrading(p => !p);

  // ─── Binance Sync ─────────────────────────────────────────────────────────

  const syncBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/binance");
      const data = await res.json();
      if (data.error || data.msg) {
        notify(`Live Sync: ${data.error || data.msg}`, "error");
        return;
      }
      if (data.balances) {
        const nb: Portfolio = { USDT: 0 };
        const newActive = [...activeCoins];
        data.balances.forEach((b: any) => {
          const total = parseFloat(b.free) + parseFloat(b.locked);
          if (total > 0.0001) {
            nb[b.asset] = total;
            if (b.asset !== "USDT" && !newActive.includes(b.asset)) {
              newActive.push(b.asset);
            }
          }
        });
        if (newActive.length !== activeCoins.length) setActiveCoins(newActive);
        setLiveBalances(prev => { balancesRef.current = nb; return nb; });
        notify("Live Binance data synchronized", "success");
      }
    } catch (e: any) { 
      console.error("Sync failed", e);
      notify("Sync failed. Check network or keys.", "error");
    }
  }, []);

  // ─── Trade Execution ──────────────────────────────────────────────────────

  const recordTrade = (action: "BUY" | "SELL", coin: string, amount: number, price: number, total: number) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const id   = "t-" + Math.random().toString(36).slice(2, 10);
    const dec  = coin === "BTC" || coin === "ETH" ? 6 : 4;
    setTradeHistory(prev => [{ id, time, coin, action, amount: amount.toFixed(dec), price: price.toFixed(2), totalUSDT: total.toFixed(2) }, ...prev].slice(0, 100));

    // ── Position Tracking for P&L ──
    if (action === "BUY") {
      setOpenPositions(prev => [...prev, {
        coin, entryTime: time, entryPrice: price,
        amount, invested: total, strategy: strategyRef.current,
      }]);
    } else if (action === "SELL") {
      // Match against oldest open position for this coin (FIFO)
      const idx = openPositionsRef.current.findIndex(p => p.coin === coin);
      if (idx !== -1) {
        setOpenPositions(prev => {
          const next = [...prev];
          next.splice(idx, 1);
          return next;
        });
        const pos = openPositionsRef.current[idx];
        const returned = total;
        const profit   = returned - pos.invested;
        const profitPct = pos.invested > 0 ? (profit / pos.invested) * 100 : 0;
        const completed: CompletedTrade = {
          id: "ct-" + Math.random().toString(36).slice(2, 10),
          coin,
          entryTime: pos.entryTime,
          exitTime: time,
          entryPrice: pos.entryPrice,
          exitPrice: price,
          amount: pos.amount,
          invested: pos.invested,
          returned,
          profit,
          profitPct,
          strategy: pos.strategy,
        };
        setCompletedTrades(prev => [completed, ...prev].slice(0, 500));
      }
    }
  };

  const executeTrade = useCallback(async (
    action: "BUY" | "SELL",
    coin: string,
    usdtAmount: number,
    isInternal = false
  ): Promise<boolean> => {
    const livePrice = marketDataRef.current[coin]?.price;
    if (!livePrice || usdtAmount <= 0) return false;

    // ══════════════════════════════════════════════════════════════════════════
    // NANO-TRADE ENGINE (Binance $10 minimum workaround)
    //
    // BUY  $2 of COIN:  Buy $12 worth → immediately sell $10 back → net: +$2 of COIN
    // SELL $2 of COIN:  Buy $10 more  → immediately sell $12      → net: -$2 of COIN
    // ══════════════════════════════════════════════════════════════════════════

    if (!isInternal && usdtAmount < MIN_NOTIONAL) {

      if (action === "BUY") {
        // Need to buy $12 total, then sell $10 back to USDT
        const totalBuy = usdtAmount + MIN_NOTIONAL; // e.g. $2 + $10 = $12
        const available = (balancesRef.current.USDT || 0) - SAFE_RESERVE;
        if (totalBuy > available) {
          notify(`Nano-BUY blocked: Need $${totalBuy.toFixed(2)}, only $${available.toFixed(2)} above reserve.`, "error");
          return false;
        }
        const step1 = await executeTrade("BUY", coin, totalBuy, true);
        if (!step1) return false;
        await new Promise(r => setTimeout(r, 300));
        // Step 2: Sell $10 worth back to USDT (this meets the $10 minimum)
        const step2 = await executeTrade("SELL", coin, MIN_NOTIONAL, true);
        if (!step2) notify("Nano-BUY trim step failed, you hold extra coin.", "info");
        return true;
      }

      if (action === "SELL") {
        // Need to buy $10 more of this coin, then sell $12 total
        const buyFirst = MIN_NOTIONAL; // Buy $10 more of coin
        const totalSell = usdtAmount + MIN_NOTIONAL; // Then sell $12 worth
        const available = (balancesRef.current.USDT || 0) - SAFE_RESERVE;
        if (buyFirst > available) {
          notify(`Nano-SELL blocked: Need $${buyFirst.toFixed(2)} USDT to inflate, only $${available.toFixed(2)} above reserve.`, "error");
          return false;
        }
        const step1 = await executeTrade("BUY", coin, buyFirst, true);
        if (!step1) return false;
        await new Promise(r => setTimeout(r, 300));
        // Step 2: Sell $12 worth (this meets the $10 minimum)
        const step2 = await executeTrade("SELL", coin, totalSell, true);
        if (!step2) notify("Nano-SELL dump step failed, you hold extra coin.", "info");
        return true;
      }
    }

    // ── Reserve guard (BUY) ──
    if (action === "BUY" && !isInternal) {
      const afterTrade = (balancesRef.current.USDT || 0) - usdtAmount;
      if (afterTrade < SAFE_RESERVE) {
        notify("Reserve Protection: trade would dip below $10 reserve.", "error");
        return false;
      }
    }

    const coinAmount = usdtAmount / livePrice;

    // ── Live Binance execution ──
    if (isLiveMode) {
      try {
        const res = await fetch("/api/binance", {
          method: "POST",
          body: JSON.stringify({ symbol: coin, side: action, quantity: coinAmount.toFixed(6), usdtAmount: usdtAmount.toFixed(2) })
        });
        const result = await res.json();
        if (result.orderId) {
          await syncBalances();
          recordTrade(action, coin, coinAmount, livePrice, usdtAmount);
          return true;
        }
        if (result.msg || result.error) notify(`Binance: ${result.msg || result.error}`, "error");
        return false;
      } catch (e: any) {
        notify(`API error: ${e.message}`, "error");
        return false;
      }
    }

    // ── Simulator execution ──
    if (action === "BUY") {
      if ((balancesRef.current.USDT || 0) < usdtAmount) return false;
      setBalances(prev => ({ ...prev, USDT: (prev.USDT || 0) - usdtAmount, [coin]: (prev[coin] || 0) + coinAmount }));
    } else {
      if ((balancesRef.current[coin] || 0) < coinAmount) return false;
      setBalances(prev => ({ ...prev, [coin]: Math.max(0, (prev[coin] || 0) - coinAmount), USDT: (prev.USDT || 0) + usdtAmount }));
    }
    recordTrade(action, coin, coinAmount, livePrice, usdtAmount);
    return true;
  }, [isLiveMode, notify, syncBalances, setBalances]);

  // ─── High-Frequency Tick WebSockets ────────────────────────────────────────
  // KEY DESIGN: WebSocket handlers NEVER call setMarketData directly.
  // They write raw values into pendingUpdatesRef (a plain object, no re-renders).
  // A separate 500ms flush timer commits everything to React state in one batch.

  const coinsKey = activeCoins.join(','); // stable string dep prevents reference churn

  useEffect(() => {
    if (activeCoins.length === 0) return;

    const sockets = activeCoins.map(coin => {
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${coin.toLowerCase()}usdt@trade`);

      ws.onmessage = (event) => {
        const payload = JSON.parse(event.data);
        if (!payload.p) return;

        const price = parseFloat(payload.p);
        const vol   = parseFloat(payload.q);
        const time  = payload.T;
        const bucketTime = Math.floor(time / 1000) * 1000;

        const hist = historiesRef.current[coin] || [];
        let lastCandle = hist.length > 0 ? hist[hist.length - 1] : null;

        if (!lastCandle || lastCandle.t !== bucketTime) {
          const newCandle: Candle = { o: price, h: price, l: price, c: price, v: vol, t: bucketTime };
          hist.push(newCandle);
          lastCandle = newCandle;
        } else {
          lastCandle.c = price;
          lastCandle.h = Math.max(lastCandle.h, price);
          lastCandle.l = Math.min(lastCandle.l, price);
          lastCandle.v += vol;
        }
        historiesRef.current[coin] = hist.slice(-300);

        const closes = hist.map(c => c.c);
        // Write into accumulator ref — zero React renders triggered here
        pendingUpdatesRef.current[coin] = {
          prevPrice:  marketDataRef.current[coin]?.price ?? null,
          price,
          signal:     marketDataRef.current[coin]?.signal ?? "HOLD",
          gain:       marketDataRef.current[coin]?.gain   ?? null,
          volume:     lastCandle!.v,
          volatility: volatility(closes, 20),
          atr:        atr(hist, 14),
          rsiValue:   rsi(closes.slice(-20)),
        };
      };

      ws.onerror = () => console.warn(`[WS] Disconnected from ${coin} (likely delisted or paused)`);
      return ws;
    });

    // Flush accumulated updates to React state at most twice per second
    const flushId = setInterval(() => {
      const pending = pendingUpdatesRef.current;
      if (Object.keys(pending).length === 0) return;
      pendingUpdatesRef.current = {};
      setMarketData(prev => {
        const next = { ...prev };
        for (const [c, update] of Object.entries(pending)) {
          next[c] = { ...(prev[c] || { price: null, prevPrice: null, gain: null, signal: "HOLD" }), ...update };
        }
        marketDataRef.current = next; // keep ref in sync
        return next;
      });
    }, 500);

    return () => {
      sockets.forEach(ws => ws.close());
      clearInterval(flushId);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinsKey]);

  // ─── Signal Processor (1-second heartbeat) ───────────────────────────────

  useEffect(() => {
    const tick = () => {
      activeCoins.forEach(coin => {
        const hist = historiesRef.current[coin];
        if (!hist || hist.length < 15) return;

        const newSig = computeSignal(strategyRef.current, hist);
        const now    = Date.now();
        const signal_changed = lastSigState.current[coin] !== newSig;

        // ── Update live indicator ──
        if (signal_changed) {
          lastSigState.current[coin] = newSig;
          setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], signal: newSig } }));

          if (newSig !== "HOLD") {
            setSignalsLog(prev => [{
              id:     "s-" + Math.random().toString(36).slice(2, 8),
              time:   new Date().toLocaleTimeString(),
              coin,
              price:  hist[hist.length - 1].c.toFixed(coin === "CELR" || coin === "DUSK" ? 4 : 2),
              signal: newSig,
            }, ...prev].slice(0, 100));
          }
        }

        // ── Auto-Trade logic ──
        if (!autoTradeRef.current || newSig === "HOLD") return;

        const lastTr  = lastTradeTime.current[coin] || 0;
        if (now - lastTr < 15_000) return; // 15s cooldown per coin

        const price  = hist[hist.length - 1].c;
        const hasCoin = (balancesRef.current[coin] || 0) * price > 1.0;
        const needsBuy  = newSig === "BUY"  && !hasCoin;
        const needsSell = newSig === "SELL" && hasCoin;

        if (!needsBuy && !needsSell) return;

        lastTradeTime.current[coin] = now;

        if (needsBuy) {
          const bal  = balancesRef.current.USDT || 0;
          const aggr = ["HYPER", "AGGRESSIVE", "SNIPER"].includes(strategyRef.current);
          const baseConf = aggr ? 0.10 : 0.05;
          const closes = hist.map(c => c.c);
          const s = avg(closes.slice(-5));
          const l = avg(closes.slice(-20));
          const conf = Math.min(MAX_ALLOCATION, Math.max(baseConf, (Math.abs(s - l) / l) * 80));
          let amt = (bal - SAFE_RESERVE) * conf;

          // Smart-scale: can't exceed available budget above reserve + filler
          const maxSpend = Math.max(0, bal - SAFE_RESERVE - (amt < MIN_NOTIONAL ? NANO_FILLER : 0));
          if (amt > maxSpend) amt = maxSpend;
          if (amt < MIN_BOT_USD) {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "Low Funds" } }));
            return;
          }

          setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "Buying…" } }));
          executeTrade("BUY", coin, amt).then(ok => {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: ok ? "✓ Bought" : "✗ Failed" } }));
          });
        } else if (needsSell) {
          const coinBal = balancesRef.current[coin] || 0;
          const sellVal = coinBal * price;
          if (sellVal < MIN_BOT_USD) return;

          setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: "Selling…" } }));
          executeTrade("SELL", coin, sellVal).then(ok => {
            setMarketData(prev => ({ ...prev, [coin]: { ...prev[coin], botStatus: ok ? "✓ Sold" : "✗ Failed" } }));
          });
        }
      });
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeCoins, executeTrade]);

  // ─── 24h Gain Sync ───────────────────────────────────────────────────────

  useEffect(() => {
    const fetchGains = async () => {
      try {
        const res  = await fetch("/api/binance?type=exchangeInfo");
        const data = await res.json();
        if (!Array.isArray(data)) return;
        const map: Record<string, number> = {};
        data.forEach((d: any) => { map[d.baseAsset] = parseFloat(d.gain); });
        setMarketData(prev => {
          const next = { ...prev };
          Object.keys(next).forEach(c => { if (map[c] !== undefined) next[c] = { ...next[c], gain: map[c] }; });
          return next;
        });
      } catch {}
    };
    fetchGains();
    const id = setInterval(fetchGains, 60_000);
    return () => clearInterval(id);
  }, []);

  // ─── P&L ─────────────────────────────────────────────────────────────────

  const [paperInitial, setPaperInitial] = useState(10_000);
  const [liveInitial,  setLiveInitial]  = useState<number | null>(null);
  const [totalProfit,  setTotalProfit]  = useState(0);

  const calculateTotalUSDT = useCallback(() => {
    let total = balances.USDT || 0;
    activeCoins.forEach(c => {
      const p = marketData[c]?.price;
      if (p && balances[c]) total += balances[c] * p;
    });
    return total;
  }, [balances, activeCoins, marketData]);

  useEffect(() => {
    const total = calculateTotalUSDT();
    if (isLiveMode) {
      if (liveInitial === null && total > 0) { setLiveInitial(total); }
      else if (liveInitial !== null) setTotalProfit(total - liveInitial);
    } else {
      setTotalProfit(total - paperInitial);
    }
  }, [balances, marketData, isLiveMode, liveInitial, paperInitial, calculateTotalUSDT]);

  useEffect(() => { if (isLiveMode) syncBalances(); }, [isLiveMode, syncBalances]);

  useEffect(() => { localStorage.setItem("snapshots", JSON.stringify(snapshots)); }, [snapshots]);

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
      const currentVal = calculateTotalUSDT();
      if (currentVal <= 0) return;
      
      setSnapshots(prev => {
        const now = Date.now();
        const newSnapshot = { t: now, v: currentVal };
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
      totalUSDT: calculateTotalUSDT(),
      totalProfit,
      syncBalances,
      convertFromAsset, setConvertFromAsset,
      snapshots,
      openPositions,
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
