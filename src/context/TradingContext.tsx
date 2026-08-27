"use client";

import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { rsi, calculateMinimumExitPrice } from "@/lib/indicators";
import { evaluateStrategySignal } from "@/lib/strategies";

// ─── Types ──────────────────────────────────────────────────────────────────

type SignalType = "BUY" | "SELL" | "HOLD" | "INFO";
export type BotStrategy = "ORACLE_ELITE" | "MANUAL_ASSIST" | "EMA_SCALPER" | "TREND_FOLLOWER" | "VWAP_TRADER" | "MEAN_REVERSION" | "BREAKOUT_HUNTER" | "RSI_MOMENTUM" | "SWING_TRADER" | "AGGRESSIVE" | "HYPER_SCALPER" | "SNIPER" | "MANUAL_CONVERSION" | "MANUAL_ENTRY";
export type Candle = { o: number; h: number; l: number; c: number; v: number; t: number };

type TradeLog = { id: string; time: string; coin: string; price: string; signal: SignalType; reason?: string };
type ExecutedTrade = { id: string; time: string; coin: string; action: "BUY" | "SELL"; amount: string; price: string; totalUSDT: string };

export type BotSettings = {
  strategy?: string;
  timeframe?: string;
  feeRecovery: number;
  netTarget: number;
  stopLoss: number;
  cooldownMinutes?: number;
  rsiBuyThreshold?: number;
  rsiSellThreshold?: number;
  allocationPct: number;
  maxOpenPositions: number;
  activeCoins?: string[];
  runTimer: number; // hours
  isPaperAutoTrading?: boolean;
  isLiveAutoTrading?: boolean;
  isLiveMode?: boolean;
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

type PortfolioMetrics = {
  totalUSDT: number;
  totalBTC: number;
  drawdown: number;
  sharpeRatio: number;
  allocation: Record<string, number>;
};

type ExecutionStyle = "MARKET" | "TWAP" | "ICEBERG";

type TradingContextType = {
  isLiveMode: boolean;
  toggleLiveMode: () => void;
  isAutoTrading: boolean;
  toggleAutoTrading: () => void;
  currentStrategy: BotStrategy;
  setStrategy: (s: BotStrategy) => void;
  balances: Portfolio;
  setUSDTBalance: (amount: number) => void;
  executeTrade: (action: "BUY" | "SELL", coin: string, amount?: number, style?: ExecutionStyle) => Promise<boolean>;
  marketData: Record<string, LiveCoinState>;
  activeCoins: string[];
  addCoin: (symbol: string) => void;
  removeCoin: (symbol: string) => void;
  metrics: PortfolioMetrics;
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
  autoDustConvert: () => Promise<void>;
};

const DEFAULT_COINS = ["BTC", "ETH", "XRP"];
export const SAFE_RESERVE = 0;
export const MAX_OPEN_POSITIONS = 100;
const MAX_TRADE_USD = 11.0;
const ORACLE_AUTH_TOKEN = "oracle_default_secret_9988";

const TradingContext = createContext<TradingContextType | undefined>(undefined);

// ─── Module Cache for Binance Exchange Info ──────────────────────────────────
const exchangeInfoCache = {
  data: null as any,
  promise: null as Promise<any> | null,
  timestamp: 0,
  async get() {
    const now = Date.now();
    if (this.data && (now - this.timestamp < 300000)) return this.data;
    if (this.promise) return this.promise;
    
    this.promise = fetch("/api/binance?type=exchangeInfo", {
      headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
    }).then(async r => {
      const d = await r.json();
      this.data = d;
      this.timestamp = Date.now();
      this.promise = null;
      return d;
    }).catch(e => {
      this.promise = null;
      throw e;
    });
    return this.promise;
  }
};

export function TradingProvider({ children }: { children: React.ReactNode }) {
  // 1. Core State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [isPaperAutoTrading, setIsPaperAutoTrading] = useState(false);
  const [isLiveAutoTrading, setIsLiveAutoTrading] = useState(false);
  
  // Computed for UI compatibility
  const isAutoTrading = isLiveMode ? isLiveAutoTrading : isPaperAutoTrading;
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
  const [botSettings, setBotSettings] = useState<BotSettings>({
    feeRecovery: 0.2, netTarget: 0.5, stopLoss: -1.5, allocationPct: 10, maxOpenPositions: 100, runTimer: 0
  });
  const [metrics, setMetrics] = useState<PortfolioMetrics>({
    totalUSDT: 0, totalBTC: 0, drawdown: 0, sharpeRatio: 0, allocation: {}
  });
  const [listenKey, setListenKey] = useState<string | null>(null);

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
  const paperAutoTradeRef = useRef(isPaperAutoTrading);
  const liveAutoTradeRef = useRef(isLiveAutoTrading);
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
  useEffect(() => { paperAutoTradeRef.current = isPaperAutoTrading; }, [isPaperAutoTrading]);
  useEffect(() => { liveAutoTradeRef.current = isLiveAutoTrading; }, [isLiveAutoTrading]);
  useEffect(() => { botSettingsRef.current = botSettings; }, [botSettings]);
  useEffect(() => { activeCoinsRef.current = activeCoins; }, [activeCoins]);

  const executeTriangulation = useCallback(async (from: string, to: string, amount: number) => {
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
    const finalAmount = targetAmount * (1 - feeRate);

    const setBalFn = isLiveMode ? setLiveBalances : setPaperBalances;
    setBalFn(prev => ({ ...prev, [from]: (prev[from] || 0) - amount, [to]: (prev[to] || 0) + finalAmount }));

    const mode = isLiveMode ? "LIVE" : "PAPER";
    if (from !== "USDT") {
      const existing = openPositionsRef.current.find(p => p.coin === from);
      const returned = amount * fromPrice;
      const completed = { id: "ct-" + Math.random().toString(36).slice(2, 10), coin: from, entryTime: existing?.entryTime || new Date().toISOString(), exitTime: new Date().toISOString(), entryPrice: existing?.entryPrice || fromPrice, exitPrice: fromPrice, amount, invested: existing ? (amount / existing.amount) * existing.invested : returned, returned, fee: returned * feeRate, profit: 0, netProfit: 0, profitPct: 0, strategy: "MANUAL_CONVERSION" as const };
      if (existing) {
        const investedProportion = (amount / existing.amount) * existing.invested;
        completed.profit = returned - investedProportion;
        completed.netProfit = completed.profit - completed.fee;
      }
      setCompletedTrades(prev => [completed, ...prev]);
    }
    if (to !== "USDT") {
      const existing = openPositionsRef.current.find(p => p.coin === to);
      const newPos = { coin: to, entryTime: new Date().toISOString(), entryPrice: toPrice, amount: (existing?.amount || 0) + finalAmount, invested: (existing?.invested || 0) + usdtValue, strategy: "MANUAL_CONVERSION" as const };
      setOpenPositions(prev => existing ? prev.map(p => p.coin === to ? newPos : p) : [...prev, newPos]);
    }
    toast.success(`Converted ${from} to ${to}`);
    return true;
  }, [isLiveMode, balances]);

  // 4. Calculations - Reactive Live Total Portfolio & Total P&L
  const activeFeeRate = (botSettings.feeRecovery || 0.2) / 200;
  
  const { totalUSDT, totalProfit } = useMemo(() => {
    let total = balances.USDT || 0;
    Object.keys(balances).forEach(c => {
      if (c === "USDT") return;
      const amount = balances[c] || 0;
      if (amount <= 0.00000001) return;
      const p = marketData[c]?.price || openPositions.find(pos => pos.coin === c)?.entryPrice || 0;
      if (p > 0) total += amount * p;
    });

    const realizedPnL = completedTrades.reduce((sum, t) => sum + (Number(t.netProfit) || Number(t.profit) || 0), 0);
    const unrealizedPnL = openPositions.reduce((sum, p) => {
      const currentPrice = marketData[p.coin]?.price || p.entryPrice || 0;
      if (!currentPrice || !p.amount) return sum;
      const currentValue = p.amount * currentPrice;
      const exitFee = currentValue * activeFeeRate;
      return sum + (currentValue - exitFee - p.invested);
    }, 0);

    const calculatedProfit = realizedPnL + unrealizedPnL;
    return {
      totalUSDT: isNaN(total) ? 0 : total,
      totalProfit: isNaN(calculatedProfit) ? 0 : calculatedProfit
    };
  }, [balances, marketData, completedTrades, openPositions, activeFeeRate]);

  // NOTE: deliberately uses refs so this function never needs to be in any dep array.
  const calculateTotalUSDT = useCallback(() => {
    const bal = balancesRef.current;
    const md = marketDataRef.current;
    let total = bal.USDT || 0;
    let hasStalePrice = false;
    Object.keys(bal).forEach(c => {
      if (c === "USDT") return;
      const amount = bal[c] || 0;
      if (amount <= 0.00000001) return;
      const p = md[c]?.price;
      if (p && p > 0) total += amount * p;
      else hasStalePrice = true;
    });
    return { total, isStale: hasStalePrice };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // stable — reads from refs, never needs re-creation

  const [autoTradeStartedAt, setAutoTradeStartedAt] = useState<string | null>(null);


  // 5. Data Fetchers

  // Module-level promise cache: all concurrent loadCandles calls share ONE exchangeInfo
  // fetch instead of each firing their own. Cache expires after 5 minutes.
  const loadCandles = useCallback(async (coin: string) => {
    try {
      const [candleRes, allMarkets] = await Promise.all([
        fetch(`/api/binance?type=klines&symbol=${coin}USDT&interval=1m&limit=50`, {
          headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
        }).then(r => r.json()),
        exchangeInfoCache.get()
      ]);

      const coinFilters = Array.isArray(allMarkets) ? allMarkets.find((m: any) => m.baseAsset === coin)?.filters : null;

      if (Array.isArray(candleRes)) {
        const formatted = candleRes.map((d: any[]) => ({
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
      // 1. Fetch Config First to establish Mode
      let currentMode = "PAPER";
      try {
        const confRes = await fetch("/api/config");
        if (confRes.ok) {
          const d = await confRes.json();
          if (d && !d.error) {
            setBotSettings(d);
            if (d.activeCoins && Array.isArray(d.activeCoins) && d.activeCoins.length > 0) {
              setActiveCoins(d.activeCoins);
              activeCoinsRef.current = d.activeCoins;
            }
            
            if (d.isPaperAutoTrading !== undefined) setIsPaperAutoTrading(d.isPaperAutoTrading);
            if (d.isLiveAutoTrading !== undefined) setIsLiveAutoTrading(d.isLiveAutoTrading);
            
            if (d.autoTradeStartedAt) setAutoTradeStartedAt(d.autoTradeStartedAt);
            
            // CRITICAL: Set Live Mode before fetching positions
            if (d.isLiveMode !== undefined) {
              setIsLiveMode(d.isLiveMode);
              currentMode = d.isLiveMode ? "LIVE" : "PAPER";
            }
          }
        }
      } catch (e) { console.warn("Config hydration failed", e); }

      // 2. Fetch Mode-Specific Data
      try {
        const [pRes, cRes, tRes, pbRes] = await Promise.all([
          fetch(`/api/positions?mode=${currentMode}`),
          fetch(`/api/completed-trades?mode=${currentMode}`),
          fetch(`/api/trades?mode=${currentMode}`),
          fetch("/api/paper-balance")
        ]);

        if (pRes.ok) setOpenPositions(await pRes.json());
        if (cRes.ok) setCompletedTrades(await cRes.json());
        if (tRes.ok) setTradeHistory(await tRes.json());
        if (pbRes.ok) setPaperBalances(await pbRes.json());
      } catch (e) { console.warn("Data hydration failed", e); }

      // 3. Save Initial Snapshot & Mark Ready
      try {
        const { total } = calculateTotalUSDT();
        await fetch("/api/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalUSDT: total, mode: currentMode })
        });
      } catch (e) { console.warn("Snapshot sync failed", e); }
      finally {
        hasHydrated.current = true;
        activeCoinsRef.current.forEach(loadCandles);
        // CRITICAL: Trigger initial balance sync for live mode
        if (currentMode === "LIVE") {
          fetch("/api/binance", { headers: { "x-oracle-token": ORACLE_AUTH_TOKEN } })
            .then(r => r.json())
            .then(data => {
              if (data.balances) {
                const nb: Portfolio = { USDT: 0 };
                data.balances.forEach((b: any) => {
                  const total = parseFloat(b.free) + parseFloat(b.locked);
                  if (total > 0.00000001) nb[b.asset] = total;
                });
                setLiveBalances(nb);
                balancesRef.current = nb;
              }
            }).catch(console.error);
        }
      }
    };
    hydrate();
  }, []); // Only run once on mount

  // 4.5 Dynamic Stream Synchronization
  // NOTE: deliberately excludes `activeCoins` from deps to avoid a self-referential
  // loop (the effect writes to activeCoins, so including it would re-trigger itself).
  // We use the ref for reading current coins, and a stable joined-string to detect
  // genuine changes without creating a new effect identity on every render.
  const balancesKeysStr = Object.keys(balances).filter(c => c !== "USDT" && balances[c] > 0).sort().join(",");
  const posCoinsStr = openPositions.map(p => p.coin).sort().join(",");
  useEffect(() => {
    if (!hasHydrated.current) return;

    const holdingCoins = balancesKeysStr ? balancesKeysStr.split(",") : [];
    const posCoins = posCoinsStr ? posCoinsStr.split(",") : [];
    const currentActive = activeCoinsRef.current;

    // Merge existing activeCoins (from ref) with current holdings
    const combined = Array.from(new Set([...currentActive, ...holdingCoins, ...posCoins]));
    const combinedKey = combined.slice().sort().join(",");
    const currentKey = currentActive.slice().sort().join(",");

    if (combinedKey !== currentKey) {
      const newCoins = combined.filter(c => !currentActive.includes(c));
      setActiveCoins(combined);
      activeCoinsRef.current = combined;
      newCoins.forEach(loadCandles);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balancesKeysStr, posCoinsStr, loadCandles]);

  // 4.6 Handlers & Balance Sync
  const syncBalances = useCallback(async () => {
    try {
      const res = await fetch("/api/binance", {
        headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
      });
      const data = await res.json();
      if (res.ok && data.balances) {
        const nb: Portfolio = { USDT: 0 };
        data.balances.forEach((b: any) => {
          const total = parseFloat(b.free) + parseFloat(b.locked);
          if (total > 0.00000001) nb[b.asset] = total;
        });
        setLiveBalances(nb);
        balancesRef.current = nb;
      } else if (!res.ok) {
        console.warn("Live balance sync warning:", data);
        if (data.error || data.msg) {
          toast.error(`Live Sync: ${data.error || data.msg}`);
        }
      }
    } catch (e: any) {
      console.error("Sync failed", e);
      toast.error(`Live sync error: ${e.message || "Check API keys & IP whitelist"}`);
    }
  }, []);

  useEffect(() => { 
    if (!isLiveMode) return;
    syncBalances();
    const timer = setInterval(syncBalances, 8000);
    return () => clearInterval(timer);
  }, [isLiveMode, syncBalances]);

  // Enhanced Multi-Stream WebSocket with Auto-Reconnect & Keep-Alive
  const streamsKey = useMemo(() => {
    const tickerStreams = activeCoins.map(c => `${c.toLowerCase()}usdt@miniTicker`).join("/");
    const klineStreams = activeCoins.map(c => `${c.toLowerCase()}usdt@kline_1m`).join("/");
    const depthStreams = activeCoins.map(c => `${c.toLowerCase()}usdt@depth5@100ms`).join("/");
    const userStreamStr = listenKey ? `/${listenKey}` : "";
    return `${tickerStreams}/${klineStreams}/${depthStreams}${userStreamStr}`;
  }, [activeCoins, listenKey]);

  useEffect(() => {
    if (!activeCoins.length || !streamsKey) return;
    
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isCleanClose = false;
    let backoffDelay = 1000;

    const connectWs = () => {
      try {
        ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streamsKey}`);

        ws.onopen = () => {
          backoffDelay = 1000; // Reset backoff on successful connection
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const d = msg.data;
            if (!d) return;

            // ── USER DATA STREAM INTERCEPT ──
            if (d.e === "outboundAccountPosition") {
              const nb: Portfolio = { ...balancesRef.current };
              d.B.forEach((b: any) => {
                const total = parseFloat(b.f) + parseFloat(b.l);
                if (total > 0.00000001) nb[b.a] = total;
                else delete nb[b.a];
              });
              setLiveBalances(nb);
              toast.info("Wallet Sync: Order Fill / External Transact Detected");
            }

            if (d.e === "executionReport") {
              if (d.x === "TRADE") {
                toast.success(`${d.S} Order Fill: ${d.q} ${d.s} @ ${d.L}`);
                syncBalances(); 
              }
            }

            const coin = d.s ? d.s.replace("USDT", "") : "";
            if (!coin) return;

            if (msg.stream?.includes("miniTicker")) {
              const price = parseFloat(d.c);
              setMarketData(prev => ({
                ...prev,
                [coin]: { ...prev[coin], price, prevPrice: prev[coin]?.price, gain: ((price - parseFloat(d.o)) / parseFloat(d.o)) * 100, isReady: true }
              }));
            }

            if (msg.stream?.includes("depth5")) {
              const bids = d.b || [];
              const asks = d.a || [];
              if (bids.length && asks.length) {
                const bidVol = bids.reduce((s: number, x: any) => s + parseFloat(x[1]), 0);
                const askVol = asks.reduce((s: number, x: any) => s + parseFloat(x[1]), 0);
                const imbalance = bidVol / (bidVol + askVol);
                setMarketData(prev => ({
                  ...prev,
                  [coin]: { ...prev[coin], volume: bidVol + askVol, botStatus: imbalance > 0.6 ? "Bullish Depth" : imbalance < 0.4 ? "Bearish Depth" : "Neutral Depth" }
                }));
              }
            }

            if (msg.stream?.includes("kline")) {
              const k = d.k;
              const candle = { t: k.t, o: parseFloat(k.o), h: parseFloat(k.h), l: parseFloat(k.l), c: parseFloat(k.c), v: parseFloat(k.v) };
              setMarketData(prev => {
                const hist = prev[coin]?.candleHistory || [];
                const last = hist[hist.length - 1];
                const isNewCandle = !last || last.t !== candle.t;
                const newHist = isNewCandle ? [...hist.slice(hist.length >= 200 ? 1 : 0), candle] : [...hist.slice(0, -1), candle];
                return { ...prev, [coin]: { ...prev[coin], candleHistory: newHist } };
              });
            }
          } catch (parseErr) {
            console.warn("WS parsing error:", parseErr);
          }
        };

        ws.onerror = (err) => {
          console.warn("Binance WS encountered an error, reconnecting...", err);
        };

        ws.onclose = () => {
          if (!isCleanClose) {
            reconnectTimeout = setTimeout(() => {
              backoffDelay = Math.min(backoffDelay * 1.5, 15000);
              connectWs();
            }, backoffDelay);
          }
        };
      } catch (connErr) {
        console.error("WS connect failure:", connErr);
      }
    };

    connectWs();

    return () => {
      isCleanClose = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) ws.close();
    };
  }, [streamsKey, syncBalances]);

  // Listenkey Acquisition & 30-minute Keep-Alive Ping
  useEffect(() => {
    if (!isLiveMode) return;

    // Acquire initial listenKey
    if (!listenKey) {
      fetch("/api/binance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN },
        body: JSON.stringify({ type: "userDataStream" })
      })
        .then(r => r.json())
        .then(d => d.listenKey && setListenKey(d.listenKey))
        .catch(console.error);
      return;
    }

    // Ping listenKey every 30 minutes to prevent expiration
    const keepAliveTimer = setInterval(() => {
      fetch("/api/binance", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN },
        body: JSON.stringify({ type: "keepAliveStream", listenKey })
      }).catch(err => console.warn("ListenKey keep-alive failed:", err));
    }, 30 * 60 * 1000);

    return () => clearInterval(keepAliveTimer);
  }, [isLiveMode, listenKey]);

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

  // Helper to truncate decimals correctly without rounding up position totals (LOT_SIZE compliant)
  const truncateToLotSize = (amount: number, stepSize: number): number => {
    if (!stepSize || stepSize <= 0) return amount;
    const precision = Math.round(Math.log10(1 / stepSize));
    const factor = Math.pow(10, precision);
    return Math.floor(amount * factor) / factor;
  };

  const executeTrade = useCallback(async (action: "BUY" | "SELL", coin: string, amountOverride?: number, style: ExecutionStyle = "MARKET"): Promise<boolean> => {
    if (isTradeLockRef.current) {
      console.log(`[TRADE LOCK] Context busy. Dropping concurrent ${action} for ${coin}`);
      return false;
    }

    try {
      isTradeLockRef.current = true;
      const currentPrice = marketDataRef.current[coin]?.price;
      if (!currentPrice) {
        toast.error(`Execution failed: No live market ticker for ${coin}`);
        return false;
      }

      const mode = isLiveMode ? "LIVE" : "PAPER";
      const MIN_NOTIONAL = 10.0;
      const currentUSDTBalance = balancesRef.current.USDT || 0;
      const setBalFn = isLiveMode ? setLiveBalances : setPaperBalances;

      // ─── SIMPLE EARN REDEMPTION SYNC ───
      if (action === "BUY" && isLiveMode) {
        const required = amountOverride || 12.5;
        if (currentUSDTBalance < required) {
          toast.info("Liquidity Low: Redeeming from Simple Earn Flexible...");
          const redeemRes = await fetch("/api/binance", {
            method: "POST", headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN },
            body: JSON.stringify({ type: "earnRedeem", usdtAmount: (required - currentUSDTBalance + 5).toFixed(2) })
          });
          if (redeemRes.ok) await syncBalances();
        }
      }

      // ==========================================
      // ACTION: BUY (With Proactive Notional Padding)
      // ==========================================
      if (action === "BUY") {
        if (openPositionsRef.current.some(p => p.coin === coin)) {
          console.log(`[STRATEGY RISK] Already holding active position in ${coin}. Skipping entry.`);
          return false;
        }

        if (openPositionsRef.current.length >= botSettingsRef.current.maxOpenPositions) {
          toast.error(`Max position risk ceiling reached (${botSettingsRef.current.maxOpenPositions})`);
          return false;
        }

        const riskFactor = Math.abs(botSettingsRef.current.stopLoss) / 100;
        const baselineRequired = MIN_NOTIONAL / (1 - riskFactor);
        const paddedAllocation = Math.max(12.5, baselineRequired + 1.5);
        let targetedSpend = amountOverride ? Math.max(amountOverride, paddedAllocation) : paddedAllocation;

        if (currentUSDTBalance < targetedSpend && !isLiveMode) {
          toast.error(`Insufficient Liquidity: Required $${targetedSpend.toFixed(2)} USDT`);
          return false;
        }

        // ── TWAP / ICEBERG ROUTING ──
        if (style === "TWAP" && isLiveMode) {
          toast.info(`Executing TWAP: Slicing $${targetedSpend.toFixed(2)} into 5 micro-lots...`);
          const slice = targetedSpend / 5;
          for (let i = 0; i < 5; i++) {
            await fetch("/api/binance", { method: "POST", headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN }, body: JSON.stringify({ symbol: coin, side: "BUY", usdtAmount: slice.toFixed(2) }) });
            await new Promise(r => setTimeout(r, 60000)); // 1 min pause
          }
        } else if (isLiveMode) {
          const res = await fetch("/api/binance", { 
            method: "POST", 
            headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN }, 
            body: JSON.stringify({ symbol: coin, side: "BUY", usdtAmount: parseFloat(targetedSpend.toFixed(2)) }) 
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.msg || errData.error || "Binance Buy Order Rejected");
          }
        }

        const feeRate = (botSettingsRef.current.feeRecovery || 0.2) / 200;
        const calculatedAmount = (targetedSpend * (1 - feeRate)) / currentPrice;

        // Update in-memory balances
        const newUSDT = Math.max(0, (balancesRef.current.USDT || 0) - targetedSpend);
        const newCoinAmt = (balancesRef.current[coin] || 0) + calculatedAmount;
        setBalFn(prev => ({ ...prev, USDT: newUSDT, [coin]: newCoinAmt }));

        const newPos = { coin, entryTime: new Date().toISOString(), entryPrice: currentPrice, amount: calculatedAmount, invested: targetedSpend, strategy: strategyRef.current };
        setOpenPositions(prev => [...prev, newPos]);

        const logEntry = { id: "ex-" + Math.random().toString(36).slice(2, 10), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), coin, action: "BUY" as const, amount: calculatedAmount.toString(), price: currentPrice.toString(), totalUSDT: targetedSpend.toString() };
        setTradeHistory(prev => [logEntry, ...prev]);

        toast.success(`Notional Guard Active: Entry for ${coin} at $${targetedSpend.toFixed(2)}`);

        // Persist to DB (trade log + position + updated paper balance)
        const saveResults = await Promise.allSettled([
          fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...logEntry, mode, strategy: strategyRef.current }) }),
          fetch("/api/positions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newPos, mode }) }),
          // Only persist paper balances for paper mode
          ...(!isLiveMode ? [
            fetch("/api/paper-balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: "USDT", amount: newUSDT }) }),
            fetch("/api/paper-balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: coin, amount: newCoinAmt }) })
          ] : [])
        ]);
        const failed = saveResults.filter(r => r.status === "rejected");
        if (failed.length > 0) {
          console.error("[DB SYNC] Some trade data failed to persist:", failed);
          toast.error("Warning: Trade data may not have fully saved to database.");
        }

        return true;
      }

      // ==========================================
      // ACTION: SELL (With Reactive Emergency Flash Top-Up Loop)
      // ==========================================
      if (action === "SELL") {
        // Use position amount as fallback when balance wasn't persisted (e.g. after page reload)
        const positionRecord = openPositionsRef.current.find(p => p.coin === coin);
        const targetHolding = balancesRef.current[coin] > 0
          ? balancesRef.current[coin]
          : (positionRecord?.amount || 0);
        if (targetHolding <= 0) {
          toast.error(`Cannot close ${coin}: No balance or position record found.`);
          return false;
        }

        let runTimeNotional = targetHolding * currentPrice;
        let finalLiquidatedHolding = targetHolding;
        let wasEmergencyLoopActive = false;

        if (runTimeNotional < MIN_NOTIONAL) {
          const emergencyTopUpCost = Math.max(11.0, MIN_NOTIONAL - runTimeNotional + 1.5);
          if ((balancesRef.current["USDT"] || 0) >= emergencyTopUpCost) {
            if (isLiveMode) {
              await fetch("/api/binance", { method: "POST", headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN }, body: JSON.stringify({ symbol: coin, side: "BUY", usdtAmount: parseFloat(emergencyTopUpCost.toFixed(2)) }) });
              await new Promise(r => setTimeout(r, 600)); // Allow Binance matching engine to settle balance
            }
            setBalFn(prev => ({ ...prev, USDT: (prev.USDT || 0) - emergencyTopUpCost }));
            wasEmergencyLoopActive = true;
          }
        }

        // In Live Mode, re-sync exact free balance from Binance to avoid floating-point / fee mismatches
        let actualSellHolding = targetHolding;
        if (isLiveMode) {
          try {
            const balRes = await fetch("/api/binance", { headers: { "x-oracle-token": ORACLE_AUTH_TOKEN } });
            const balData = await balRes.json();
            if (balData.balances) {
              const coinBal = balData.balances.find((b: any) => b.asset === coin);
              if (coinBal && parseFloat(coinBal.free) > 0) {
                actualSellHolding = parseFloat(coinBal.free);
              }
            }
          } catch (syncErr) {
            console.warn("Pre-sell balance sync fallback to local targetHolding:", syncErr);
          }
        }

        const filters = marketDataRef.current[coin]?.filters;
        const tickSize = filters?.tickSize ? parseFloat(filters.tickSize) : 0.01;
        const stepSize = filters?.stepSize ? parseFloat(filters.stepSize) : 0.00000001;
        const finalSellQty = truncateToLotSize(actualSellHolding, stepSize);
        const finalSellPrice = Math.floor(currentPrice / tickSize) * tickSize;

        if (isLiveMode) {
          const res = await fetch("/api/binance", { 
            method: "POST", 
            headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN }, 
            body: JSON.stringify({ symbol: coin, side: "SELL", quantity: finalSellQty.toString() }) 
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.msg || errData.error || "Binance Sell Order Rejected");
          }
          await syncBalances();
        }

        const returnUSDT = finalSellQty * finalSellPrice;
        
        // Capture position before state changes and await delays clear it
        const posSnapshot = openPositionsRef.current.find(p => p.coin === coin);
        
        const newUSDTAfterSell = (balancesRef.current.USDT || 0) + returnUSDT;
        setBalFn(prev => ({ ...prev, USDT: newUSDTAfterSell, [coin]: 0 }));
        setOpenPositions(prev => prev.filter(p => p.coin !== coin));

        const exitLog = { id: "ex-" + Math.random().toString(36).slice(2, 10), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), coin, action: "SELL" as const, amount: finalSellQty.toString(), price: finalSellPrice.toString(), totalUSDT: returnUSDT.toString() };
        setTradeHistory(prev => [exitLog, ...prev]);

        toast.success(`Liquidated: Recovered $${returnUSDT.toFixed(2)} USDT`);
        
        // ── SIMPLE EARN AUTO-SUBSCRIBE ──
        if (isLiveMode && returnUSDT > 10) {
          fetch("/api/binance", { method: "POST", headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN }, body: JSON.stringify({ type: "earnSubscribe", usdtAmount: returnUSDT.toFixed(2) }) });
        }

        // Build completed trade record first (needed for DB save below)
        const invested_at_exit = (posSnapshot?.invested || returnUSDT) + (wasEmergencyLoopActive ? 6.00 : 0);
        const profit = returnUSDT - invested_at_exit;
        const sellFee = returnUSDT * (botSettingsRef.current.feeRecovery / 200);
        const completed = posSnapshot ? {
            id: "ct-" + Math.random().toString(36).slice(2, 10),
            coin,
            entryTime: posSnapshot.entryTime,
            exitTime: new Date().toISOString(),
            entryPrice: posSnapshot.entryPrice,
            exitPrice: finalSellPrice,
            amount: finalSellQty,
            invested: invested_at_exit,
            returned: returnUSDT,
            fee: sellFee,
            profit,
            netProfit: profit - sellFee,
            profitPct: ((profit - sellFee) / invested_at_exit) * 100,
            strategy: posSnapshot.strategy
        } : null;

        if (completed) setCompletedTrades(prev => [completed, ...prev]);

        // Persist all sell-related data to DB atomically
        const sellSaveResults = await Promise.allSettled([
          fetch("/api/trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...exitLog, mode, strategy: strategyRef.current }) }),
          fetch(`/api/positions?coin=${coin}&mode=${mode}`, { method: "DELETE" }),
          ...(completed ? [fetch("/api/completed-trades", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...completed, mode }) })] : []),
          // Only persist paper balances for paper mode
          ...(!isLiveMode ? [
            fetch("/api/paper-balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: "USDT", amount: newUSDTAfterSell }) }),
            fetch("/api/paper-balance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset: coin, amount: 0 }) })
          ] : [])
        ]);
        const sellFailed = sellSaveResults.filter(r => r.status === "rejected");
        if (sellFailed.length > 0) {
          console.error("[DB SYNC] Some sell data failed to persist:", sellFailed);
          toast.error("Warning: Sell data may not have fully saved to database.");
        }

        return true;
      }
      return false;
    } catch (criticalError) {
      console.error("[CRITICAL]", criticalError);
      return false;
    } finally { isTradeLockRef.current = false; }
  }, [isLiveMode]);

  const autoDustConvert = useCallback(async () => {
    if (!isLiveMode) return;
    const dustAssets = Object.keys(liveBalances).filter(k => k !== "USDT" && k !== "BNB" && liveBalances[k] * (marketDataRef.current[k]?.price || 0) < 1);
    if (dustAssets.length === 0) return;

    try {
      const res = await fetch("/api/binance", {
        method: "POST", headers: { "Content-Type": "application/json", "x-oracle-token": ORACLE_AUTH_TOKEN },
        body: JSON.stringify({ type: "dustConvert", assets: dustAssets })
      });
      if (res.ok) {
        toast.success(`Dust Sanitizer: Batched ${dustAssets.length} micro-balances into BNB`);
        syncBalances();
      }
    } catch (e) { console.error("Dust failed", e); }
  }, [isLiveMode, liveBalances]);

  useEffect(() => {
    const healthLoop = setInterval(() => {
      const { total } = calculateTotalUSDT();
      const btcPrice = marketDataRef.current["BTC"]?.price || 60000;
      
      const alloc: Record<string, number> = {};
      Object.keys(balancesRef.current).forEach(k => {
        const val = balancesRef.current[k] * (marketDataRef.current[k]?.price || 1);
        alloc[k] = (val / total) * 100;
      });

      const returns = completedTradesRef.current.map(t => t.profitPct);
      const avg = returns.length ? returns.reduce((a, b) => a + b) / returns.length : 0;
      const drawdown = snapshots.length ? ((Math.max(...snapshots.map(s => s.v)) - snapshots[snapshots.length - 1].v) / Math.max(...snapshots.map(s => s.v))) * 100 : 0;

      setMetrics({
        totalUSDT: total,
        totalBTC: total / btcPrice,
        drawdown: Math.max(0, drawdown),
        sharpeRatio: avg / (Math.abs(botSettingsRef.current.stopLoss) || 1),
        allocation: alloc
      });

      if (isAutoTrading) {
        Object.keys(alloc).forEach((coin: string) => {
          if (coin !== "USDT" && alloc[coin] > 30) {
            toast.info(`Rebalancing ${coin}: Weight (${alloc[coin].toFixed(1)}%) exceeds limit.`);
            executeTrade("SELL", coin);
          }
        });
      }
    }, 3600000);

    return () => clearInterval(healthLoop);
  }, [isAutoTrading, snapshots]);

  useEffect(() => {
    const dustTimer = setInterval(autoDustConvert, 86400000);
    return () => clearInterval(dustTimer);
  }, [autoDustConvert]);

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

        const curPrice = data.price || validCandles[validCandles.length - 1].c;
        const position = openPositionsRef.current.find(p => p.coin === coin);
        const hasPos = !!position;

        const evalResult = evaluateStrategySignal(strategyRef.current, validCandles, curPrice, {
          rsiBuyThreshold: botSettingsRef.current?.rsiBuyThreshold || 40.0,
          rsiSellThreshold: botSettingsRef.current?.rsiSellThreshold || 60.0,
          feeRecovery: botSettingsRef.current?.feeRecovery || 0.2,
          netTarget: botSettingsRef.current?.netTarget || 0.5,
          stopLoss: botSettingsRef.current?.stopLoss || -1.5,
          position: position ? {
            entryPrice: position.entryPrice,
            amount: position.amount,
            invested: position.invested
          } : undefined
        });

        // Update indicators
        setMarketData(prev => {
          const r = evalResult.rsiVal ?? prev[coin]?.rsiValue ?? 50;
          return { ...prev, [coin]: { ...prev[coin], rsiValue: r, botStatus: evalResult.reason } };
        });

        if (evalResult.signal === "BUY" && !hasPos) {
          logSignal(coin, "BUY", curPrice, evalResult.rsiVal);
          if (autoTradeRef.current) {
            if ((openPositionsRef.current?.length || 0) >= (botSettingsRef.current?.maxOpenPositions || 5)) {
              toast.error(`Bot Skipped ${coin}: Max open slots reached`);
            } else {
              tradeExecutedThisTick = true;
              const available = Math.max(0, (balancesRef.current.USDT || 0) - SAFE_RESERVE);
              const allocation = available * ((botSettingsRef.current?.allocationPct || 10) / 100);
              const tradeSize = Math.max(MAX_TRADE_USD, allocation);
              executeTradeRef.current("BUY", coin, tradeSize).catch(err => console.error("Buy err", err));
            }
          }
        } else if (evalResult.signal === "SELL" && hasPos) {
          logSignal(coin, "SELL", curPrice, evalResult.rsiVal);
          if (autoTradeRef.current) {
            tradeExecutedThisTick = true;
            toast.info(`Automated Exit (${coin}): ${evalResult.reason}`);
            executeTradeRef.current("SELL", coin, 0).catch(console.error);
          }
        } else if (tickCount % 12 === 0) {
          logSignal(coin, "HOLD", curPrice, evalResult.rsiVal);
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
        const modeStr = nextMode ? "LIVE" : "PAPER";

        // Cloud Sync Mode
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isLiveMode: nextMode })
        }).catch(console.error);

        // RE-FETCH Mode-Specific Data immediately
        try {
          const [pRes, cRes, tRes] = await Promise.all([
            fetch(`/api/positions?mode=${modeStr}`),
            fetch(`/api/completed-trades?mode=${modeStr}`),
            fetch(`/api/trades?mode=${modeStr}`)
          ]);

          if (pRes.ok) setOpenPositions(await pRes.json());
          if (cRes.ok) setCompletedTrades(await cRes.json());
          if (tRes.ok) setTradeHistory(await tRes.json());
          
          if (nextMode) {
            // Trigger balance sync for live
            fetch("/api/binance", { headers: { "x-oracle-token": ORACLE_AUTH_TOKEN } })
              .then(r => r.json())
              .then(data => {
                if (data.balances) {
                  const nb: Portfolio = { USDT: 0 };
                  data.balances.forEach((b: any) => {
                    const total = parseFloat(b.free) + parseFloat(b.locked);
                    if (total > 0.00000001) nb[b.asset] = total;
                  });
                  setLiveBalances(nb);
                  balancesRef.current = nb;
                }
              }).catch(console.error);
          }
        } catch (e) {
          console.error("Mode switch data fetch failed", e);
        }
      },
      isAutoTrading,
      toggleAutoTrading: async () => {
        const nextState = !isAutoTrading;
        if (isLiveMode) {
          setIsLiveAutoTrading(nextState);
        } else {
          setIsPaperAutoTrading(nextState);
        }
        
        const startTime = nextState ? new Date().toISOString() : null;
        setAutoTradeStartedAt(startTime);
        toast.success(`Autonomous Trading ${nextState ? 'ENGAGED' : 'PAUSED'}`);

        // Cloud Sync Bot Status
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [isLiveMode ? "isLiveAutoTrading" : "isPaperAutoTrading"]: nextState })
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
      executeTriangulation,
      convertFromAsset, setConvertFromAsset,
      notifications: [],
      updatePositionPrice,
      metrics,
      autoDustConvert
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
