"use client";

import React, { useState, useRef, useEffect } from "react";
import { TrendingUp, TrendingDown, Activity, Wallet, PlusCircle, ShieldCheck, Zap, Download, ChevronDown } from "lucide-react";
import { motion as m, AnimatePresence as AP } from "framer-motion";
import { useTradingEngine, BotStrategy } from "@/context/TradingContext";
import TradeMap from "./TradeMap";
import TriangulationTool from "./TriangulationTool";
import HoldingsTable from "./HoldingsTable";
import Link from "next/link";

const getDecimals = (symbol: string) => {
  if (symbol === "XRP") return 4;
  if (symbol === "BTC" || symbol === "ETH") return 2;
  return 4;
};

const STRATEGY_INFO: Record<BotStrategy, { name: string, desc: string, color: string, risk: string }> = {
  SCALPER:    { name: "EMA Scalper",      desc: "5/30 EMA crossover",         color: "text-[var(--color-crypto-green)]", risk: "LOW" },
  TREND:      { name: "Trend Follower",   desc: "10-tick momentum tracking",   color: "text-blue-400",                   risk: "LOW" },
  REVERSION:  { name: "Mean Reversion",   desc: "Sell highs, buy dips",        color: "text-orange-400",                 risk: "MED" },
  BREAKOUT:   { name: "Breakout Hunter",  desc: "20-period high/low breaks",   color: "text-yellow-400",                 risk: "MED" },
  MOMENTUM:   { name: "RSI Momentum",     desc: "Oversold/overbought RSI",     color: "text-cyan-400",                   risk: "MED" },
  VWAP:       { name: "VWAP Trader",      desc: "Price vs 50-tick VWAP",       color: "text-purple-400",                 risk: "LOW" },
  AGGRESSIVE: { name: "Aggressive Bot",   desc: "3/20 EMA + RSI combo",        color: "text-pink-400",                   risk: "HIGH" },
  SWING:      { name: "Swing Trader",     desc: "12/50 EMA + Bollinger",       color: "text-amber-400",                  risk: "MED" },
  HYPER:      { name: "Hyper Scalper",    desc: "2/8-tick HF momentum",        color: "text-red-400",                    risk: "HIGH" },
  SNIPER:     { name: "Sniper Bot",       desc: "Bollinger extreme sniper",    color: "text-rose-400",                   risk: "HIGH" },
};

export default function CryptoDashboard() {
  const { 
    balances, 
    setUSDTBalance, 
    executeTrade, 
    marketData, 
    signalsLog, 
    tradeHistory, 
    isAutoTrading, 
    toggleAutoTrading, 
    currentStrategy,
    setStrategy,
    totalUSDT, 
    totalProfit, 
    isLiveMode, 
    toggleLiveMode, 
    syncBalances,
    activeCoins,
    notifications,
    snapshots
  } = useTradingEngine();

  const [usdtInput, setUsdtInput] = useState("");
  const [period, setPeriod] = useState<string>("ALL");

  const periods = [
    { label: '1m', ms: 60 * 1000 },
    { label: '5m', ms: 5 * 60 * 1000 },
    { label: '30m', ms: 30 * 60 * 1000 },
    { label: '1h', ms: 60 * 60 * 1000 },
    { label: '24h', ms: 24 * 60 * 60 * 1000 },
    { label: '1w', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: '1mo', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: '1y', ms: 365 * 24 * 60 * 60 * 1000 },
    { label: 'ALL', ms: Infinity }
  ];

  const getPeriodPnL = () => {
    if (period === "ALL") return totalProfit;
    const p = periods.find(x => x.label === period);
    if (!p || !snapshots || snapshots.length === 0) return 0;
    
    const targetTime = Date.now() - p.ms;
    let closest = snapshots[0];
    let minDiff = Math.abs(snapshots[0].t - targetTime);

    for (const s of snapshots) {
      const diff = Math.abs(s.t - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = s;
      }
    }
    return totalUSDT - closest.v;
  };

  const periodPnL = getPeriodPnL();
  const [activeLogTab, setActiveLogTab] = useState<"signals" | "trades">("signals");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Overlay for notifications
  const NotificationOverlay = () => (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AP>
        {notifications.map(n => (
          <m.div
            key={n.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 min-w-[280px] ${
              n.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-100' :
              n.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-100' :
              'bg-blue-500/20 border-blue-500/50 text-blue-100'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
              n.type === 'error' ? 'bg-red-500' : n.type === 'success' ? 'bg-green-500' : 'bg-blue-500'
            }`} />
            <span className="text-[11px] font-mono font-bold">{n.msg}</span>
          </m.div>
        ))}
      </AP>
    </div>
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleUpdateBalance = () => {
    const val = parseFloat(usdtInput);
    if (!isNaN(val)) {
      setUSDTBalance(val);
      setUsdtInput("");
    }
  };

  const getPriceColor = (coin: string) => {
    const state = marketData[coin];
    if (!state || !state.prevPrice || !state.price || state.price === state.prevPrice) return "text-gray-200";
    return state.price > state.prevPrice ? "text-[var(--color-crypto-green)]" : "text-[var(--color-crypto-red)]";
  };

  const downloadLogs = () => {
    const logs = activeLogTab === "signals" ? signalsLog : tradeHistory;
    if (logs.length === 0) return;
    const headers = Object.keys(logs[0]).join(",");
    const rows = logs.map(l => Object.values(l).join(",")).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `oracle_${activeLogTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4 mb-10 sm:mb-0">
      <NotificationOverlay />
      
      {/* High-Density Stats Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="glass-panel p-2.5 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col justify-between h-20 sm:h-auto">
          <div>
            <div className="text-[8px] sm:text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">Portfolio</div>
            <div className="text-base sm:text-lg font-black font-mono tracking-tighter text-white">
              ${totalUSDT.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          {!isLiveMode && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2">
              <input 
                type="number" 
                placeholder="Set..." 
                className="bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[8px] sm:text-[9px] w-14 sm:w-20 font-mono text-white" 
                value={usdtInput} 
                onChange={(e) => setUsdtInput(e.target.value)} 
              />
              <button onClick={handleUpdateBalance} className="bg-white/10 hover:bg-white/20 text-white/80 px-2 py-1 rounded text-[8px] sm:text-[9px] font-mono font-bold">SET</button>
            </div>
          )}
        </div>
        
        <div className="glass-panel p-2.5 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col justify-between h-20 sm:h-auto">
          <div>
            <div className="text-[8px] sm:text-[9px] font-mono text-white/30 uppercase tracking-widest mb-1">P&L ({period})</div>
            <div className={`text-base sm:text-lg font-black font-mono tracking-tighter ${periodPnL >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
              {periodPnL >= 0 ? '+' : ''}${Math.abs(periodPnL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {periods.filter(p => !['1y', '1mo'].includes(p.label)).map(p => (
              <button key={p.label} onClick={() => setPeriod(p.label)} className={`text-[6px] sm:text-[7px] font-mono px-1 py-0.5 rounded transition-all ${period === p.label ? 'bg-white/20 text-white' : 'text-white/30'}`}>
                {p.label}
              </button>
            ))}
            <button key="ALL" onClick={() => setPeriod("ALL")} className={`text-[6px] sm:text-[7px] font-mono px-1 py-0.5 rounded transition-all ${period === "ALL" ? 'bg-white/20 text-white' : 'text-white/30'}`}>ALL</button>
          </div>
        </div>

        <div className="glass-panel p-2.5 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between relative z-[60]" ref={dropdownRef}>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="text-[8px] sm:text-[9px] font-bold font-mono mb-1 text-[var(--color-crypto-green)]">BOT {isAutoTrading ? 'ACTIVE' : 'OFF'}</div>
            <div className="relative">
              <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono font-bold text-white/70">
                <span className={STRATEGY_INFO[currentStrategy].color}>{STRATEGY_INFO[currentStrategy].name}</span>
                <ChevronDown size={10} />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-[200px] bg-neutral-900 border border-white/10 rounded-xl shadow-2xl z-[100] max-h-[300px] overflow-y-auto">
                  {(Object.keys(STRATEGY_INFO) as BotStrategy[]).map((s) => (
                    <button key={s} onClick={() => { setStrategy(s); setDropdownOpen(false); }} className={`w-full flex items-center justify-between px-3 py-3 text-left border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${currentStrategy === s ? 'bg-white/5' : ''}`}>
                      <span className={`text-[10px] font-mono font-bold ${STRATEGY_INFO[s].color}`}>{STRATEGY_INFO[s].name}</span>
                      <span className="text-[7px] font-black px-1 rounded border border-white/20 opacity-40">{STRATEGY_INFO[s].risk}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={toggleAutoTrading} className={`p-2.5 rounded-xl transition-all ${isAutoTrading ? 'bg-[var(--color-crypto-green)] text-black' : 'bg-white/5 text-white/30'}`}>
            <Zap size={16} fill={isAutoTrading ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="glass-panel p-2.5 rounded-xl border border-white/5 bg-white/[0.01] flex items-center justify-between">
          <div className="flex flex-col">
            <div className={`text-[8px] sm:text-[9px] font-bold font-mono ${isLiveMode ? 'text-orange-400' : 'text-blue-400'}`}>
              {isLiveMode ? 'LIVE REAL' : 'PAPER SIM'}
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono font-bold text-white/70">Binance API</div>
          </div>
          <button onClick={toggleLiveMode} className={`p-2.5 rounded-xl transition-all ${isLiveMode ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]' : 'bg-white/5 text-white/30'}`}>
            <Activity size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9 space-y-6">
          {/* Active Coins Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-3">
            {activeCoins.filter(coin => marketData[coin]?.price).map((coin) => (
              <div key={coin} className="glass-panel p-2 sm:p-3 rounded-xl border border-white/5 bg-white/[0.01]">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded bg-white/5 flex items-center justify-center font-bold text-[8px]">{coin[0]}</div>
                    <span className="text-[9px] font-bold font-mono text-white/80">{coin}</span>
                  </div>
                  <div className={`text-[6px] font-black px-1.5 py-0.5 rounded border ${marketData[coin]?.signal === 'BUY' ? 'border-green-500/30 text-green-400' : marketData[coin]?.signal === 'SELL' ? 'border-red-500/30 text-red-400' : 'border-white/5 text-white/5'}`}>
                    {marketData[coin]?.signal}
                  </div>
                </div>
                <div className="mb-1">
                  <div className={`text-xs sm:text-sm font-black font-mono tracking-tighter ${getPriceColor(coin)}`}>
                    ${marketData[coin].price?.toLocaleString(undefined, { minimumFractionDigits: getDecimals(coin) })}
                  </div>
                  {marketData[coin]?.gain !== null && (
                    <div className={`text-[7px] font-mono font-bold ${marketData[coin].gain! >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {marketData[coin].gain! >= 0 ? '+' : ''}{marketData[coin].gain!.toFixed(1)}%
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[6px] opacity-20 font-mono overflow-hidden">
                  <span>RSI {marketData[coin]?.rsiValue?.toFixed(0) || '--'}</span>
                  <span>VOL {(marketData[coin]?.volatility! * 100).toFixed(1)}%</span>
                </div>
              </div>
            ))}
            <Link href="/markets" className="glass-panel p-3 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center text-white/10 hover:text-white/30 transition-all min-h-[60px]">
              <PlusCircle size={14} />
              <span className="text-[7px] font-mono mt-1 uppercase tracking-widest text-center">Add Asset</span>
            </Link>
          </div>

          <div className="h-[320px]">
            <TradeMap />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <HoldingsTable />
            <TriangulationTool />
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="glass-panel rounded-2xl border border-white/5 flex flex-col h-[400px] sm:h-[550px]">
            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex gap-4">
                {["signals", "trades"].map((tab) => (
                  <button key={tab} onClick={() => setActiveLogTab(tab as any)} className={`text-[9px] font-mono uppercase font-bold tracking-widest ${activeLogTab === tab ? 'text-white border-b-2 border-white/80 pb-1' : 'text-white/20'}`}>
                    {tab}
                  </button>
                ))}
              </div>
              <button onClick={downloadLogs} className="p-1.5 text-white/20 hover:text-white transition-all bg-white/5 rounded-lg">
                <Download size={14} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              <AP mode="popLayout">
                {(activeLogTab === "signals" ? signalsLog : tradeHistory).map((log: any) => (
                  <m.div key={log.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="flex justify-between items-center text-[10px] font-mono pb-2 border-b border-white/[0.03]">
                    <div className="flex flex-col">
                      <span className="font-bold text-white/90">{log.coin}</span>
                      <span className="text-[7px] opacity-30">{log.time}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white/60">${log.price}</span>
                      <span className={`font-black px-1 rounded ${log.signal === 'BUY' || log.action === 'BUY' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                        {log.signal || log.action}
                      </span>
                    </div>
                  </m.div>
                ))}
              </AP>
              {(activeLogTab === "signals" ? signalsLog.length : tradeHistory.length) === 0 && (
                <div className="flex flex-col items-center justify-center h-full opacity-10 py-10">
                  <Activity size={32} />
                  <span className="text-[8px] font-mono mt-2">NO DATA</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
