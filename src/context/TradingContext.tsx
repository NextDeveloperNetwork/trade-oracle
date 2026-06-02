"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { rsi, calculateMinimumExitPrice } from "@/lib/indicators";

// ─── Types ──────────────────────────────────────────────────────────────────

type SignalType = "BUY" | "SELL" | "HOLD" | "INFO";
export type BotStrategy = "EMA_SCALPER" | "TREND_FOLLOWER" | "VWAP_TRADER" | "MEAN_REVERSION" | "BREAKOUT_HUNTER" | "RSI_MOMENTUM" | "SWING_TRADER" | "AGGRESSIVE" | "HYPER_SCALPER" | "SNIPER" | "ORACLE_ELITE" | "MANUAL_CONVERSION" | "MANUAL_ENTRY";
export type Candle = { o: number; h: number; l: number; c: number; v: number; t: number };

type TradeLog = { id: string; time: string; coin: string; price: string; signal: SignalType; reason?: string };
type ExecutedTrade = { id: string; time: string; coin: string; action: "BUY" | "SELL"; amount: string; price: string; totalUSDT: string };

export type BotSettings = {
  feeRecovery: number;
  netTarget: number;
  stopLoss: number;
  allocationPct: number;
  maxOpenPositions: number;
  activeCoins?: string[];
  runTimer: number; // minutes
};

type CompletedTrade = {
  id: string;
  coin: string;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  invested: number;
  returned: number;
  fee: number;
  profit: number;
  netProfit: number;
  profitPct: number;
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
  candleHistory?: Candle[];
  botStatus?: string;
  rsiValue?: number;
  atr?: number;
  volume?: number;
  isReady?: boolean;
  filters?: {
    stepSize: string;
    tickSize: string;
    minQty: string;
    minNotional: string;
  };
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
  executeTrade: (action: "BUY" | "SELL", coin: string, usdtAmount: number) => Promise<boolean>;
  marketData: Record<string, LiveCoinState>;
  activeCoins: string[];
  addCoin: (symbol: string) => void;
  removeCoin: (symbol: string) => void;
  signalsLog: TradeLog[];
  tradeHistory: ExecutedTrade[];
  completedTrades: CompletedTrade[];
  totalUSDT: number;
  totalProfit: number;
  snapshots: HistorySnapshot[];
  openPositions: OpenPosition[];
  botSettings: BotSettings;
  updateBotSettings: (s: BotSettings) => Promise<void>;
  resetAll: () => void;
  resetPnL: () => void;
  selectedCoin: string;
  setSelectedCoin: (c: string) => void;
  syncBalances: () => Promise<void>;
  executeTriangulation: (f: string, t: string, a: number) => Promise<boolean>;
  convertFromAsset: string;
  setConvertFromAsset: (a: string) => void;
  notifications: any[];
  autoTradeStartedAt: string | null;
  updatePositionPrice: (coin: string, price: number) => Promise<void>;
};

const DEFAULT_COINS = ["BTC", "ETH", "XRP"];
export const SAFE_RESERVE = 0;
export const MAX_OPEN_POSITIONS = 5;
const MAX_TRADE_USD = 11.0;
const ORACLE_AUTH_TOKEN = "oracle_default_secret_9988";

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export function TradingProvider({ children }: { children: React.ReactNode }) {
  // 1. Core State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isAutoTrading, setIsAutoTrading] = useState(false);
  const [activeCoins, setActiveCoins] = useState<string[]>(DEFAULT_COINS);
  const [currentStrategy, setStrategy] = useState<BotStrategy>("ORACLE_ELITE");
  const [paperInitial, setPaperInitial] = useState(10_000);
  const [paperBalances, setPaperBalances] = useState<Portfolio>({ USDT: 10000 });
  const [liveBalances, setLiveBalances] = useState<Portfolio>({ USDT: 0 });
  const [liveInitial, setLiveInitial] = useState<number | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<string>("BTC");
  const [convertFromAsset, setConvertFromAsset] = useState("USDT");
  const [marketData, setMarketData] = useState<Record<string, LiveCoinState>>({});
  const [signalsLog, setSignalsLog] = useState<TradeLog[]>([]);
  const [tradeHistory, setTradeHistory] = useState<ExecutedTrade[]>([]);
  const [completedTrades, setCompletedTrades] = useState<CompletedTrade[]>([]);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [snapshots, setSnapshots] = useState<HistorySnapshot[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalUSDT, setTotalUSDT] = useState(0);
  const [botSettings, setBotSettings] = useState<BotSettings>({
    feeRecovery: 0.2, netTarget: 0.5, stopLoss: -1.5, allocationPct: 10, maxOpenPositions: 5, runTimer: 0
  });

  // 2. Refs
  const hasHydrated = useRef(false);
  const isTradeLockRef = useRef(false);
  const balances = isLiveMode ? liveBalances : paperBalances;
  const balancesRef = useRef(balances);
  const openPositionsRef = useRef(openPositions);
  const completedTradesRef = useRef(completedTrades);
  const marketDataRef = useRef(marketData);
  const strategyRef = useRef(currentStrategy);
  const autoTradeRef = useRef(isAutoTrading);
  const botSettingsRef = useRef(botSettings);
  const activeCoinsRef = useRef(activeCoins);
  const lastTradeTime = useRef<Record<string, number>>({});

  // 3. Keep Refs Synced
  useEffect(() => { balancesRef.current = balances; }, [balances]);
  useEffect(() => { openPositionsRef.current = openPositions; }, [openPositions]);
  useEffect(() => { completedTradesRef.current = completedTrades; }, [completedTrades]);
  useEffect(() => { marketDataRef.current = marketData; }, [marketData]);
  useEffect(() => { strategyRef.current = currentStrategy; }, [currentStrategy]);
  useEffect(() => { autoTradeRef.current = isAutoTrading; }, [isAutoTrading]);
  useEffect(() => { botSettingsRef.current = botSettings; }, [botSettings]);
  useEffect(() => { activeCoinsRef.current = activeCoins; }, [activeCoins]);

  // 4. Calculations
  const calculateTotalUSDT = useCallback(() => {
    let total = balances.USDT || 0;
    let hasStalePrice = false;
    Object.keys(balances).forEach(c => {
      if (c === "USDT") return;
      const amount = balances[c] || 0;
      if (amount <= 0.00000001) return;
      const p = marketData[c]?.price;
      if (p && p > 0) total += amount * p;
      else hasStalePrice = true;
    });
    return { total, isStale: hasStalePrice };
  }, [balances, marketData]);

  useEffect(() => {
    if (!hasHydrated.current) return;
    const { total, isStale } = calculateTotalUSDT();
    if (isStale && totalUSDT > 0) return;
    setTotalUSDT(total);

    // Cloud sync handled in specific setters and hydration

    // Total Profit = (All Realized Gains from History) + (Current Unrealized Gains)
    const activeFeeRate = (botSettings.feeRecovery || 0.2) / 200;
    const realizedPnL = completedTrades.reduce((sum, t) => sum + (Number(t.netProfit) || 0), 0);
    const unrealizedPnL = openPositions.reduce((sum, p) => {
      const currentPrice = marketData[p.coin]?.price || 0;
      if (!currentPrice || !p.amount) return sum;
      const currentValue = p.amount * currentPrice;
      const exitFee = currentValue * activeFeeRate;
      return sum + (currentValue - exitFee - p.invested);
    }, 0);

    const calculatedProfit = realizedPnL + unrealizedPnL;
    if (!isNaN(calculatedProfit)) {
      setTotalProfit(calculatedProfit);
    }
  }, [balances, marketData, isLiveMode, calculateTotalUSDT, completedTrades, openPositions, botSettings.feeRecovery]);

  const [autoTradeStartedAt, setAutoTradeStartedAt] = useState<string | null>(null);


  // 5. Data Fetchers
  const loadCandles = useCallback(async (coin: string) => {
    try {
      const [candleRes, marketsRes] = await Promise.all([
        fetch(`/api/binance?type=klines&symbol=${coin}USDT&interval=1m&limit=50`, {
          headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
        }),
        fetch(`/api/binance?type=exchangeInfo`, {
          headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
        })
      ]);
      
      const data = await candleRes.json();
      const allMarkets = await marketsRes.json();
      const coinFilters = Array.isArray(allMarkets) ? allMarkets.find((m: any) => m.baseAsset === coin)?.filters : null;

      if (Array.isArray(data)) {
        const formatted = data.map((d: any[]) => ({
          t: d[0],
          o: parseFloat(d[1]),
          h: parseFloat(d[2]),
          l: parseFloat(d[3]),
          c: parseFloat(d[4]),
          v: parseFloat(d[5])
        }));
        const lastCandle = formatted[formatted.length - 1];
        setMarketData(prev => ({
          ...prev,
          [coin]: {
            ...prev[coin],
            candleHistory: formatted,
            price: prev[coin]?.price || lastCandle?.c || null,
            prevPrice: prev[coin]?.prevPrice || lastCandle?.o || null,
            isReady: true,
            filters: coinFilters || prev[coin]?.filters
          }
        }));
      }
    } catch (e) { console.error("Candle fetch error", e); }
  }, []);

  useEffect(() => {
    const hydrate = async () => {
      // Fetch Staging Balances from Cloud
      const pbRes = await fetch("/api/paper-balance");
      if (pbRes.ok) {
        const pb = await pbRes.json();
        setPaperBalances(pb);
      }

      const mode = isLiveMode ? "LIVE" : "PAPER";
      let coinsToLoad = activeCoins;
      try {
        const [pRes, cRes, tRes, confRes] = await Promise.all([
          fetch(`/api/positions?mode=${mode}`),
          fetch(`/api/completed-trades?mode=${mode}`),
          fetch(`/api/trades?mode=${mode}`),
          fetch(`/api/config`)
        ]);
        if (pRes.ok) setOpenPositions(await pRes.json());
        if (cRes.ok) setCompletedTrades(await cRes.json());
        if (tRes.ok) setTradeHistory(await tRes.json());
        if (confRes.ok) {
          const d = await confRes.json();
          if (d && !d.error) {
            setBotSettings(d);
            if (d.activeCoins && Array.isArray(d.activeCoins) && d.activeCoins.length > 0) {
              setActiveCoins(d.activeCoins);
              coinsToLoad = d.activeCoins;
            }
            if (d.isAutoTrading) setIsAutoTrading(true);
            if (d.autoTradeStartedAt) setAutoTradeStartedAt(d.autoTradeStartedAt);
          }
        }
      } catch (e) { console.warn("Hydration failed", e); }
      // Save to Cloud
      try {
        const { total } = calculateTotalUSDT();
        await fetch("/api/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalUSDT: total, mode })
        });
      } catch (e) { console.warn("Snapshot cloud sync failed", e); }
      finally {
        hasHydrated.current = true;
        coinsToLoad.forEach(loadCandles);
      }
    };
    hydrate();
  }, [isLiveMode]);

  // WebSocket Price Feed (High Frequency)
  useEffect(() => {
    const tickerStreams = activeCoins.map(c => `${c.toLowerCase()}usdt@miniTicker`).join("/");
    const klineStreams = activeCoins.map(c => `${c.toLowerCase()}usdt@kline_1m`).join("/");
    const streams = `${tickerStreams}/${klineStreams}`;

    if (!streams) return;
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const d = msg.data;
      if (!d) return;

      const coin = d.s ? d.s.replace("USDT", "") : "";
      if (!coin) return;

      // Case 1: Mini-Ticker (Price Pulses)
      if (msg.stream.includes("miniTicker")) {
        const price = parseFloat(d.c);
        setMarketData(prev => ({
          ...prev,
          [coin]: {
            ...prev[coin],
            price,
            prevPrice: prev[coin]?.price,
            gain: ((price - parseFloat(d.o)) / parseFloat(d.o)) * 100,
            isReady: true
          }
        }));
      }

      // Case 2: 1s Klines (Chart Animation)
      if (msg.stream.includes("kline")) {
        const k = d.k;
        if (!k) return;
        const candle = { t: k.t, o: parseFloat(k.o), h: parseFloat(k.h), l: parseFloat(k.l), c: parseFloat(k.c), v: parseFloat(k.v) };
        if (isNaN(candle.o) || isNaN(candle.c) || isNaN(candle.h) || isNaN(candle.l)) return;

        setMarketData(prev => {
          const hist = prev[coin]?.candleHistory || [];
          // If this is the same candle, replace it. If new, push it.
          const last = hist[hist.length - 1];
          const isNewCandle = !last || last.t !== candle.t;

          const newHist = isNewCandle
            ? [...hist.slice(hist.length >= 200 ? 1 : 0), candle]
            : [...hist.slice(0, -1), candle];

          return {
            ...prev,
            [coin]: { ...prev[coin], candleHistory: newHist }
          };
        });
      }
    };

    ws.onerror = () => console.warn("Binance WS Error - invalid tick stream detected.");

    // Removing the aggressive `location.reload()` loop! 
    // If a user adds an unsupported coin (like GENIUS or special characters), 
    // Binance instantly disconnects the socket. Reloading creates an infinite page-refresh loop, 
    // preventing the bot from ever firing.

    return () => { ws.close(); };
  }, [activeCoins]);

  const logSignal = useCallback((coin: string, signal: SignalType, price: number, rsiOverride?: number) => {
    const rsiVal = rsiOverride !== undefined ? rsiOverride.toFixed(1) : (marketDataRef.current[coin]?.rsiValue?.toFixed(1) || "??");
    setSignalsLog(prev => [{
      id: "s-" + Math.random().toString(36).slice(2, 8),
      time: new Date().toLocaleTimeString(),
      coin,
      price: price.toFixed(2),
      signal,
      reason: `RSI: ${rsiVal} | ${signal === "BUY" ? "Oversold" : signal === "SELL" ? "Overbought" : "Ranging"}`
    }, ...prev].slice(0, 100));
  }, []);

  // 6. Handlers
  const syncBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/binance", {
        headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
      });
      const data = await res.json();
      if (data.balances) {
        const nb: Portfolio = { USDT: 0 };
        data.balances.forEach((b: any) => {
          const total = parseFloat(b.free) + parseFloat(b.locked);
          if (total > 0.00000001) nb[b.asset] = total;
        });
        setLiveBalances(nb);
        balancesRef.current = nb;
        toast.success(`Live sync: $${nb.USDT?.toFixed(2)} USDT available`);
      }
    } catch (e) {
      console.error("Sync failed", e);
      toast.error("Live sync failed. Check API keys.");
    }
  }, []);

  useEffect(() => { if (isLiveMode) syncBalances(); }, [isLiveMode, syncBalances]);

  const executeTrade = useCallback(async (action: "BUY" | "SELL", coin: string, usdtAmount: number): Promise<boolean> => {
    if (isTradeLockRef.current) {
      toast.error(`Trade lock collision on ${coin}`);
      return false;
    }
    isTradeLockRef.current = true;

    const price = marketDataRef.current[coin]?.price;
    if (!price) {
      toast.error(`Trade failed: Waiting for oracle price data on ${coin}`);
      isTradeLockRef.current = false;
      return false;
    }

    try {
      const mode = isLiveMode ? "LIVE" : "PAPER";

      if (action === "BUY") {
        const available = balancesRef.current.USDT || 0;
        const safeAvailable = Math.max(0, available - SAFE_RESERVE);
        if (safeAvailable < usdtAmount) {
          toast.error(`Action Blocked: Minimal Reserve Protection ($${SAFE_RESERVE}) Active. Total balance must exceed requested trade + reserve.`);
          isTradeLockRef.current = false;
          return false;
        }

        if (isLiveMode && usdtAmount < 10) {
          toast.warning(`Warning: Trade amount $${usdtAmount} may be below Binance minimum ($10).`);
        }

        // ── LIVE EXECUTION ──
        if (isLiveMode) {
          try {
            const filters = marketDataRef.current[coin]?.filters;
            const minNotional = filters?.minNotional ? parseFloat(filters.minNotional) : 10.0;
            
            if (usdtAmount < minNotional) {
              toast.error(`Order Rejected: Binance minimum for ${coin} is $${minNotional.toFixed(2)}. Current trade: $${usdtAmount.toFixed(2)}`);
              isTradeLockRef.current = false;
              return false;
            }

            const res = await fetch("/api/binance", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN },
              body: JSON.stringify({ symbol: coin, side: "BUY", usdtAmount: parseFloat(usdtAmount.toFixed(2)) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Binance Execution Error");
            toast.success(`Live Order Placed: Buy ${coin} @ $${price.toFixed(2)}`);
          } catch (err: any) {
            toast.error(`LIVE BUY FAILED: ${err.message}`);
            isTradeLockRef.current = false;
            return false;
          }
        }

        const feeRate = (botSettingsRef.current.feeRecovery || 0.2) / 200;
        const feeAmount = usdtAmount * feeRate;
        const netUsdt = usdtAmount - feeAmount;
        const amount = netUsdt / price;

        const setBalFn = isLiveMode ? setLiveBalances : setPaperBalances;
        setBalFn(prev => ({ ...prev, USDT: (prev.USDT || 0) - usdtAmount, [coin]: (prev[coin] || 0) + amount }));

        if (!isLiveMode) {
          // Sync Paper Balances
          fetch("/api/paper-balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: "USDT", amount: (balancesRef.current.USDT || 0) - usdtAmount }) }).catch(console.error);
          fetch("/api/paper-balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: coin, amount: (balancesRef.current[coin] || 0) + amount }) }).catch(console.error);
        }

        const newPos = { coin, entryTime: new Date().toISOString(), entryPrice: price, amount, invested: usdtAmount, strategy: strategyRef.current };
        setOpenPositions(prev => [...prev, newPos]);

        // Record for Execution Log
        const executionRecord: ExecutedTrade = {
          id: "ex-" + Math.random().toString(36).slice(2, 10),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          coin, action: "BUY", amount: amount.toString(), price: price.toString(), totalUSDT: usdtAmount.toString()
        };
        setTradeHistory(prev => [executionRecord, ...prev]);

        await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...executionRecord, strategy: strategyRef.current, mode })
        }).catch(console.error);

        await fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...newPos, mode })
        }).catch(e => console.error("DB Save Pos error:", e));

        if (!isLiveMode) toast.success(`Bot: Bought ${coin} at $${price.toFixed(2)}`);
      } else {
        const posIdx = openPositionsRef.current.findIndex(p => p.coin === coin);
        const pos = posIdx !== -1 ? openPositionsRef.current[posIdx] : null;

        // Dynamic amount determination for manual exit
        const filters = marketDataRef.current[coin]?.filters;
        const stepSize = filters?.stepSize ? parseFloat(filters.stepSize) : 0.00000001;
        const minNotional = filters?.minNotional ? parseFloat(filters.minNotional) : 10.0;

        // We prioritize the actual wallet balance for live trades to avoid "Insufficient Balance" errors
        const walletBalance = balancesRef.current[coin] || 0;
        const posAmount = pos ? pos.amount : 0;
        
        // Sell what's in the wallet if live, otherwise use recorded position amount
        let rawAmount = isLiveMode ? walletBalance : (posAmount || walletBalance);
        
        // Precision Rounding (Very Important for Binance LOT_SIZE filter)
        // If stepSize is 0.01, we want floor(amount / 0.01) * 0.01
        const precision = stepSize > 0 ? Math.floor(rawAmount / stepSize) * stepSize : rawAmount;
        const sellAmount = parseFloat(precision.toFixed(8));

        if (sellAmount <= 0) {
          toast.error(`Trade failed: No valid ${coin} quantity to sell after rounding.`);
          isTradeLockRef.current = false;
          return false;
        }

        const returned = sellAmount * price;

        // ── LIVE EXECUTION ──
        if (isLiveMode) {
          try {
            // PROACTIVE: Binance MIN_NOTIONAL check
            if (returned < minNotional) {
              const shortfall = minNotional - returned + 0.1; // Add $0.1 safety
              const confirmRecovery = confirm(`⚠️ MINIMUM NOTIONAL ERROR\n\nPosition value ($${returned.toFixed(2)}) is below Binance minimum ($${minNotional}).\n\nWould you like the bot to perform an EMERGENCY RECOVERY?\n(It will buy $${shortfall.toFixed(2)} more of ${coin} then sell everything immediately).`);
              
              if (confirmRecovery) {
                toast.info("Starting Emergency Recovery...");
                // 1. Buy the shortfall
                const buySuccess = await executeTrade("BUY", coin, shortfall);
                if (!buySuccess) throw new Error("Recovery step 1 (Buy) failed.");
                
                // 2. Immediate re-sell (full balance)
                toast.info("Clearing expanded position...");
                // We recursively call executeTrade SELL but now it should have enough balance
                const doubleCheckBal = balancesRef.current[coin] || 0;
                return await executeTrade("SELL", coin, 0); 
              }
              
              isTradeLockRef.current = false;
              return false;
            }
            const res = await fetch("/api/binance", {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN },
              body: JSON.stringify({ 
                symbol: coin, 
                side: "SELL", 
                quantity: sellAmount.toString()
              })
            });
            const data = await res.json();
            if (!res.ok) {
              const errMsg = data.msg || data.error || "Unknown Binance Error";
              throw new Error(errMsg);
            }
            toast.success(`Live Order Placed: Sell ${coin} @ $${price.toFixed(2)}`);
          } catch (err: any) {
            toast.error(`LIVE SELL FAILED: ${err.message}`);
            return false;
          }
        }

        const setBalFn = isLiveMode ? setLiveBalances : setPaperBalances;
        setBalFn(prev => ({ ...prev, USDT: (prev.USDT || 0) + returned, [coin]: 0 }));

        const feeRate = (botSettingsRef.current.feeRecovery || 0.2) / 200;
        const invested = pos ? pos.invested : returned; // Fallback to returned (0 profit) if no pos record
        const fee = (invested + returned) * feeRate;
        const profit = returned - invested;

        const completed: CompletedTrade = {
          id: "ct-" + Math.random().toString(36).slice(2, 10),
          coin,
          entryTime: pos ? pos.entryTime : new Date().toISOString(),
          exitTime: new Date().toISOString(),
          entryPrice: pos ? pos.entryPrice : price,
          exitPrice: price,
          amount: sellAmount,
          invested, returned, fee, profit, netProfit: profit - fee,
          profitPct: pos ? (profit / pos.invested) * 100 : 0,
          strategy: pos ? pos.strategy : "MANUAL_CONVERSION"
        };

        setCompletedTrades(prev => [completed, ...prev]);
        if (posIdx !== -1) {
          setOpenPositions(prev => prev.filter((_, i) => i !== posIdx));
        }

        // Record for Execution Log
        const executionRecord: ExecutedTrade = {
          id: "ex-" + Math.random().toString(36).slice(2, 10),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          coin, action: "SELL", amount: sellAmount.toString(), price: price.toString(), totalUSDT: returned.toString()
        };
        setTradeHistory(prev => [executionRecord, ...prev]);

        await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...executionRecord, strategy: strategyRef.current, mode })
        }).catch(console.error);

        // Save to Database
        await fetch("/api/completed-trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...completed, mode })
        }).catch(e => console.error("History Save error:", e));

        await fetch(`/api/positions?coin=${coin}&mode=${mode}`, { method: "DELETE" }).catch(e => console.error(e));

        if (!isLiveMode) toast.success(`Bot: Sold ${coin} at $${price.toFixed(2)} (${profit >= 0 ? '+' : ''}$${profit.toFixed(2)})`);
      }
      return true;
    } finally { isTradeLockRef.current = false; }
  }, [isLiveMode]);

  const resetAll = useCallback(async () => {
    const mode = isLiveMode ? "LIVE" : "PAPER";
    try {
      // 1. Wipe all trade history, positions, completed trades from DB
      await fetch(`/api/reset?mode=${mode}`, { method: "POST" });

      // 2. Reset ALL paper balances in DB to just 10000 USDT
      //    First zero out existing assets by setting them to 0
      const balances = Object.keys(paperBalances);
      await Promise.all(
        balances.filter(a => a !== "USDT").map(asset =>
          fetch(`/api/paper-balance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ asset, amount: 0 }),
          })
        )
      );
      // Reset USDT back to 10000
      await fetch(`/api/paper-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset: "USDT", amount: 10000 }),
      });
    } catch (e) { console.error("Purge Error:", e); }

    // 3. Clear local state
    setPaperBalances({ USDT: 10000 });
    setPaperInitial(10000);
    setOpenPositions([]);
    setCompletedTrades([]);
    localStorage.clear();
    location.reload();
  }, [isLiveMode, paperBalances]);

  const executeTradeRef = useRef(executeTrade);
  useEffect(() => { executeTradeRef.current = executeTrade; }, [executeTrade]);

  // 7. Tick Engine (Stabilized)
  useEffect(() => {
    let tickCount = 0;
    const tick = () => {
      tickCount++;
      const active = activeCoinsRef.current;

      let tradeExecutedThisTick = false;
      for (const coin of active) {
        if (tradeExecutedThisTick) break;
        const data = marketDataRef.current[coin];
        if (!data || !data.candleHistory || data.candleHistory.length < 15) continue;

        const validCandles = data.candleHistory.filter(c => !isNaN(c.c));
        if (validCandles.length < 15) continue;

        const closes = validCandles.map(c => c.c);
        const r = rsi(closes);
        if (isNaN(r)) continue;

        const position = openPositionsRef.current.find(p => p.coin === coin);
        const hasPos = !!position;


        // Update indicators
        setMarketData(prev => {
          if (prev[coin]?.rsiValue === r) return prev;
          const status = hasPos ? prev[coin]?.botStatus : "Scanning...";
          return { ...prev, [coin]: { ...prev[coin], rsiValue: r, botStatus: status } };
        });

        if (r < 40) {
          logSignal(coin, "BUY", data.price || 0, r);
          if (autoTradeRef.current) {
            if (hasPos) {
              // Valid skip, already holding this coin
            } else if ((openPositionsRef.current?.length || 0) >= (botSettingsRef.current?.maxOpenPositions || 5)) {
              toast.error(`Bot Skipped ${coin}: Max open slots reached`);
            } else {
              tradeExecutedThisTick = true;
              const available = Math.max(0, (balancesRef.current.USDT || 0) - SAFE_RESERVE);
              const allocation = available * (botSettingsRef.current.allocationPct / 100);
              const tradeSize = Math.max(MAX_TRADE_USD, allocation);
              executeTradeRef.current("BUY", coin, tradeSize).catch(err => console.error("Buy err", err));
            }
          }
        } else if (r > 60) {
          let isFeeSafe = true;
          let minPrice = 0;

          if (position) {
            const feeRate = (botSettingsRef.current.feeRecovery || 0.2) / 200;
            minPrice = calculateMinimumExitPrice(position.invested, position.amount, feeRate, botSettingsRef.current.netTarget);
            isFeeSafe = (data.price || 0) >= minPrice;
          }

          if (isFeeSafe) {
            logSignal(coin, "SELL", data.price || 0, r);
            if (autoTradeRef.current && hasPos) {
              tradeExecutedThisTick = true;
              executeTradeRef.current("SELL", coin, 0).catch(console.error);
            }
          } else if (position) {
            // Signal log for Fee Trap protection
            if (tickCount % 6 === 0) {
              const shortfallPct = ((minPrice - (data.price || 0)) / (data.price || 0)) * 100;
              setMarketData(prev => ({
                ...prev,
                [coin]: { ...prev[coin], botStatus: `FEE TRAP: Need +${shortfallPct.toFixed(2)}%` }
              }));
            }
          }
        } else if (tickCount % 12 === 0) { // Every minute status for confidence
          logSignal(coin, "HOLD", data.price || 0, r);
        }
      }
    };

    const id = setInterval(tick, 5000);
    // Initial immediate tick to confirm system start
    tick();
    return () => clearInterval(id);
  }, []); // Only run once on mount

  const updatePositionPrice = async (coin: string, price: number) => {
    const mode = isLiveMode ? "LIVE" : "PAPER";
    const existingPos = openPositions.find(p => p.coin === coin);
    const coinBalance = balancesRef.current[coin] || 0;
    
    // If no existing position AND no balance, we can't really set an entry for nothing
    if (!existingPos && coinBalance <= 0) {
      toast.error(`Cannot set entry price: No ${coin} balance found.`);
      return;
    }

    const amount = existingPos ? existingPos.amount : coinBalance;
    const invested = amount * price;
    
    const updatedPos: OpenPosition = {
      coin,
      entryTime: existingPos ? existingPos.entryTime : new Date().toISOString(),
      entryPrice: price,
      amount,
      invested,
      strategy: (existingPos ? existingPos.strategy : "MANUAL_ENTRY") as BotStrategy
    };
    
    // Update local state
    if (existingPos) {
      setOpenPositions(prev => prev.map(p => p.coin === coin ? updatedPos : p));
    } else {
      setOpenPositions(prev => [...prev, updatedPos]);
    }
    
    // Persist to DB
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updatedPos, mode })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save position to database");
      }
      
      toast.success(`Entry price for ${coin} established at $${price.toFixed(4)}`);
    } catch (error: any) {
      console.error("Manual Price Save Error:", error);
      toast.error(`Database Sync Failed: ${error.message}`);
      // Revert local state if DB failed
      if (existingPos) {
        setOpenPositions(prev => prev.map(p => p.coin === coin ? existingPos : p));
      } else {
        setOpenPositions(prev => prev.filter(p => p.coin !== coin));
      }
    }
  };

  return (
    <TradingContext.Provider value={{
      isLiveMode, toggleLiveMode: async () => {
        const nextMode = !isLiveMode;
        setIsLiveMode(nextMode);

        // Cloud Sync Mode
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isLiveMode: nextMode })
        }).catch(console.error);
      },
      isAutoTrading,
      toggleAutoTrading: async () => {
        const nextState = !isAutoTrading;
        setIsAutoTrading(nextState);
        const startTime = nextState ? new Date().toISOString() : null;
        setAutoTradeStartedAt(startTime);
        toast.success(`Autonomous Trading ${nextState ? 'ENGAGED' : 'PAUSED'}`);

        // Cloud Sync Bot Status
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAutoTrading: nextState })
        }).catch(console.error);
      },
      currentStrategy, setStrategy,
      balances, setUSDTBalance: async (a) => {
        setPaperBalances(p => ({ ...p, USDT: a }));
        setPaperInitial(a);
        await fetch("/api/paper-balance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asset: "USDT", amount: a })
        }).catch(console.error);
      },
      executeTrade, marketData, activeCoins,
      addCoin: (c) => {
        setActiveCoins(p => {
          const nw = [...new Set([...p, c.toUpperCase()])];
          fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activeCoins: nw }) }).catch(console.error);
          return nw;
        });
        loadCandles(c.toUpperCase());
      },
      removeCoin: (c) => {
        setActiveCoins(p => {
          const nw = p.filter(x => x !== c.toUpperCase());
          fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activeCoins: nw }) }).catch(console.error);
          return nw;
        });
      },
      signalsLog, tradeHistory, completedTrades,
      totalUSDT, totalProfit, snapshots, openPositions,
      botSettings, updateBotSettings: async (s) => {
        setBotSettings(s);
        try {
          await fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(s)
          });
        } catch (e) { console.error("Failed to persist settings", e); }
      },
      resetAll, resetPnL: () => setPaperInitial(totalUSDT),
      selectedCoin, setSelectedCoin,
      syncBalances,
      autoTradeStartedAt,
      executeTriangulation: async (from: string, to: string, amount: number) => {
        if (from === to) return false;
        const fromPrice = from === "USDT" ? 1 : (marketDataRef.current[from]?.price || 0);
        const toPrice = to === "USDT" ? 1 : (marketDataRef.current[to]?.price || 0);

        if (!fromPrice || !toPrice) {
          toast.error("Exchange Error: Pricing data missing");
          return false;
        }

        const bal = balancesRef.current[from] || 0;
        const requiredReserve = from === "USDT" ? SAFE_RESERVE : 0;

        if (bal - requiredReserve < amount) {
          toast.error(from === "USDT"
            ? `Action Blocked: Minimal Reserve Protection ($${SAFE_RESERVE}) Active.`
            : `Insufficient ${from} balance`
          );
          return false;
        }

        const usdtValue = amount * fromPrice;
        const targetAmount = usdtValue / toPrice;
        const feeRate = (botSettingsRef.current.feeRecovery || 0.2) / 200;
        const fee = targetAmount * feeRate;
        const finalAmount = targetAmount - fee;

        const setBalFn = isLiveMode ? setLiveBalances : setPaperBalances;
        setBalFn(prev => ({
          ...prev,
          [from]: (prev[from] || 0) - amount,
          [to]: (prev[to] || 0) + finalAmount
        }));

        // ── POSITION TRACKING ──
        const mode = isLiveMode ? "LIVE" : "PAPER";

        // 1. Source Side: If it was a coin, reduce/remove from positions
        if (from !== "USDT") {
          const sellAmount = amount;
          const price = fromPrice;
          const returned = sellAmount * price;

          // Record for Execution Log (ALWAYS log conversions)
          const exLog: ExecutedTrade = {
            id: "ex-" + Math.random().toString(36).slice(2, 10),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            coin: from, action: "SELL", amount: sellAmount.toString(), price: price.toString(), totalUSDT: returned.toString()
          };
          setTradeHistory(prev => [exLog, ...prev]);
          await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exLog, mode, strategy: "MANUAL_CONVERSION" }) }).catch(console.error);

          const existing = openPositionsRef.current.find(p => p.coin === from);

          // History Tracking
          const feeRate = (botSettingsRef.current.feeRecovery || 0.2) / 200;
          const sellFee = returned * feeRate;

          const completed: CompletedTrade = {
            id: "ct-" + Math.random().toString(36).slice(2, 10),
            coin: from,
            entryTime: existing?.entryTime || new Date().toISOString(),
            exitTime: new Date().toISOString(),
            entryPrice: existing?.entryPrice || price,
            exitPrice: price,
            amount: sellAmount,
            invested: existing ? (sellAmount / existing.amount) * existing.invested : returned,
            returned,
            fee: sellFee,
            profit: 0, // Fallback if no position
            netProfit: 0, // Fallback if no position
            profitPct: 0, // Fallback if no position
            strategy: "MANUAL_CONVERSION"
          };

          if (existing) {
            const investedProportion = (sellAmount / existing.amount) * existing.invested;
            const profit = returned - investedProportion;
            completed.invested = investedProportion;
            completed.profit = profit;
            completed.netProfit = profit - sellFee;
            completed.profitPct = (profit / investedProportion) * 100;
          }

          setCompletedTrades(prev => [completed, ...prev]);
          await fetch("/api/completed-trades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...completed, mode })
          }).catch(console.error);

          // Update/Delete Open Position
          if (existing) {
            const remaining = existing.amount - sellAmount;
            if (remaining <= 0.000001) {
              setOpenPositions(prev => prev.filter(p => p.coin !== from));
              await fetch(`/api/positions?coin=${from}&mode=${mode}`, { method: "DELETE" }).catch(console.error);
            } else {
              const updated = { ...existing, amount: remaining, invested: existing.invested - (sellAmount / existing.amount) * existing.invested };
              setOpenPositions(prev => prev.map(p => p.coin === from ? updated : p));
              await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...updated, mode }) }).catch(console.error);
            }
          }
        }

        // 2. Destination Side: If it's a coin, create/update position
        if (to !== "USDT") {
          const existing = openPositionsRef.current.find(p => p.coin === to);
          let updatedPos: OpenPosition;
          if (existing) {
            const newAmount = existing.amount + finalAmount;
            const newTotalInvested = (existing.amount * existing.entryPrice) + (finalAmount * toPrice);
            updatedPos = { ...existing, amount: newAmount, entryPrice: newTotalInvested / newAmount, invested: newTotalInvested };
            setOpenPositions(prev => prev.map(p => p.coin === to ? updatedPos : p));
          } else {
            updatedPos = { coin: to, entryTime: new Date().toISOString(), entryPrice: toPrice, amount: finalAmount, invested: usdtValue, strategy: "MANUAL_CONVERSION" };
            setOpenPositions(prev => [...prev, updatedPos]);
          }

          // Track in Execution Logs
          const exLog: ExecutedTrade = {
            id: "ex-" + Math.random().toString(36).slice(2, 10),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            coin: to, action: "BUY", amount: finalAmount.toString(), price: toPrice.toString(), totalUSDT: usdtValue.toString()
          };
          setTradeHistory(prev => [exLog, ...prev]);
          await fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exLog, mode, strategy: "MANUAL_CONVERSION" }) }).catch(console.error);

          await fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...updatedPos, mode }) }).catch(console.error);
        }

        toast.success(`Converted ${from} to ${to}`);
        return true;
      },
      convertFromAsset, setConvertFromAsset,
      notifications: [],
      updatePositionPrice,
    }}>
      {children}
    </TradingContext.Provider>
  );
}

export const useTradingEngine = () => {
  const context = useContext(TradingContext);
  if (!context) throw new Error("useTradingEngine error");
  return context;
};
