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
    notifications
  } = useTradingEngine();

  const [usdtInput, setUsdtInput] = useState("");
  const [tradeAmount, setTradeAmount] = useState("100");
  const [activeLogTab, setActiveLogTab] = useState<"signals" | "trades">("signals");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredStrategy, setHoveredStrategy] = useState<BotStrategy | null>(null);
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
    link.className = "hidden";
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `trading_${activeLogTab}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* High-Density Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="glass-panel p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mb-1">Portfolio</div>
          <div className="text-lg font-black font-mono tracking-tighter text-white">
            ${totalUSDT.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          {!isLiveMode && (
            <div className="mt-2 flex items-center gap-2 border-t border-white/5 pt-2">
              <input 
                type="number" 
                placeholder="Set USDT..." 
                className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] w-20 font-mono focus:outline-none focus:border-white/30 text-white" 
                value={usdtInput} 
                onChange={(e) => setUsdtInput(e.target.value)} 
              />
              <button 
                onClick={handleUpdateBalance} 
                className="bg-white/5 hover:bg-white/10 text-white/60 hover:text-white px-2 py-1 rounded text-[9px] font-mono font-bold transition-all"
              >
                Set
              </button>
            </div>
          )}
        </div>
        
        <div className="glass-panel p-4 rounded-2xl border border-white/5 bg-white/[0.02]">
          <div className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mb-1">Profit/Loss</div>
          <div className={`text-lg font-black font-mono tracking-tighter ${totalProfit >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
            {totalProfit >= 0 ? '+' : ''}${Math.abs(totalProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between group" ref={dropdownRef}>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div className={`text-[9px] font-bold font-mono ${isAutoTrading ? 'text-[var(--color-crypto-green)] glow-text-green' : 'text-white/20'}`}>
                {isAutoTrading ? 'BOT ACTIVE' : 'BOT OFF'}
              </div>
              <span className={`text-[7px] font-black px-1 rounded border font-mono ${
                STRATEGY_INFO[currentStrategy].risk === 'HIGH' ? 'border-red-500/40 text-red-400' :
                STRATEGY_INFO[currentStrategy].risk === 'MED'  ? 'border-yellow-500/40 text-yellow-400' :
                'border-green-500/40 text-green-400'
              }`}>{STRATEGY_INFO[currentStrategy].risk}</span>
            </div>

            {/* Custom Dropdown Trigger */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 text-[10px] font-mono font-bold text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <span className={STRATEGY_INFO[currentStrategy].color}>{STRATEGY_INFO[currentStrategy].name}</span>
                <ChevronDown size={10} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-[220px] bg-neutral-900/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 max-h-[320px] overflow-y-auto custom-scrollbar">
                  {(Object.keys(STRATEGY_INFO) as BotStrategy[]).map((s) => (
                    <div
                      key={s}
                      className="relative"
                      onMouseEnter={() => setHoveredStrategy(s)}
                      onMouseLeave={() => setHoveredStrategy(null)}
                    >
                      <button
                        onClick={() => { setStrategy(s); setDropdownOpen(false); }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left transition-all hover:bg-white/5 ${currentStrategy === s ? 'bg-white/[0.03]' : ''}`}
                      >
                        <span className={`text-[10px] font-mono font-bold ${STRATEGY_INFO[s].color}`}>{STRATEGY_INFO[s].name}</span>
                        <span className={`text-[7px] font-black px-1 rounded border font-mono shrink-0 ${
                          STRATEGY_INFO[s].risk === 'HIGH' ? 'border-red-500/40 text-red-400' :
                          STRATEGY_INFO[s].risk === 'MED'  ? 'border-yellow-500/40 text-yellow-400' :
                          'border-green-500/40 text-green-400'
                        }`}>{STRATEGY_INFO[s].risk}</span>
                      </button>

                      {/* Hover Tooltip */}
                      {hoveredStrategy === s && (
                        <div className="absolute left-full top-0 ml-2 w-[210px] p-3 bg-neutral-950 border border-white/10 rounded-xl shadow-2xl z-[60] pointer-events-none">
                          <div className={`text-[11px] font-black font-mono mb-1 ${STRATEGY_INFO[s].color}`}>{STRATEGY_INFO[s].name}</div>
                          <div className="text-[9px] text-white/50 font-mono mb-2">{STRATEGY_INFO[s].desc}</div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <span className="text-[7px] text-white/20 font-mono">RISK:</span>
                            <span className={`text-[8px] font-black font-mono ${
                              STRATEGY_INFO[s].risk === 'HIGH' ? 'text-red-400' :
                              STRATEGY_INFO[s].risk === 'MED'  ? 'text-yellow-400' : 'text-green-400'
                            }`}>{STRATEGY_INFO[s].risk === 'HIGH' ? '🔴 HIGH' : STRATEGY_INFO[s].risk === 'MED' ? '🟡 MODERATE' : '🟢 LOW'}</span>
                          </div>
                          <div className="text-[8px] text-white/30 font-mono leading-relaxed border-t border-white/5 pt-2">
                            {s === 'SCALPER' && 'Compares a fast 5-period EMA to a slow 30-period EMA. Fires on crossover events.'}
                            {s === 'TREND' && 'Measures total % price change over last 10 ticks. Triggers when momentum exceeds ±0.2%.'}
                            {s === 'REVERSION' && 'Calculates 50-period mean and fires when price deviates >0.8% from it.'}
                            {s === 'BREAKOUT' && 'Watches 20-period channel. Buys on break above highs, sells on break below lows.'}
                            {s === 'MOMENTUM' && 'Uses RSI(14). Buys when RSI < 35 (oversold), sells when RSI > 65 (overbought).'}
                            {s === 'VWAP' && 'Approximates VWAP over 50 ticks. Buys 0.3% below VWAP, sells 0.3% above.'}
                            {s === 'AGGRESSIVE' && 'Ultra-tight 3/20 EMA cross with RSI filter. Very frequent signals, large position sizes.'}
                            {s === 'SWING' && '12/50 EMA cross confirmed by Bollinger Band (2σ) touches for medium-term plays.'}
                            {s === 'HYPER' && '2-tick vs 8-tick micro-momentum with double RSI filter. Highest frequency bot.'}
                            {s === 'SNIPER' && 'Fires ONLY at extreme Bollinger (2.5σ) deviations + RSI extremes. Rare but powerful.'}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[7px] text-white/20 font-mono truncate max-w-[140px]">{STRATEGY_INFO[currentStrategy].desc}</div>
          </div>
          <button onClick={toggleAutoTrading} className={`p-2 rounded-lg transition-all ml-2 shrink-0 ${isAutoTrading ? 'bg-[var(--color-crypto-green)] text-black' : 'bg-white/5 text-white/30'}`}>
            <Zap size={14} fill={isAutoTrading ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-between">
          <div className="flex flex-col">
            <div className={`text-[9px] font-bold font-mono ${isLiveMode ? 'text-orange-400' : 'text-blue-400'}`}>
              {isLiveMode ? 'LIVE BINANCE' : 'SIMULATOR'}
            </div>
            {isLiveMode && <button onClick={() => syncBalances()} className="text-[7px] text-white/30 uppercase hover:text-white text-left">Sync API</button>}
          </div>
          <button onClick={toggleLiveMode} className={`p-2 rounded-lg transition-all ${isLiveMode ? 'bg-orange-500 text-white' : 'bg-blue-500/20 text-blue-400'}`}>
            <ShieldCheck size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        <div className="lg:col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {activeCoins.filter(coin => marketData[coin]?.price).map((coin) => (
              <div key={coin} className="glass-panel p-4 rounded-2xl border border-white/5 hover:border-white/10 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center font-bold text-[10px]">{coin[0]}</div>
                    <span className="text-xs font-bold font-mono tracking-tight">{coin}</span>
                  </div>
                  {marketData[coin] && (
                    <div className="flex flex-col items-end gap-1">
                      <div className={`text-[8px] font-black px-1.5 py-0.5 rounded border font-mono ${marketData[coin].signal === 'BUY' ? 'border-[var(--color-crypto-green)]/30 text-[var(--color-crypto-green)]' : marketData[coin].signal === 'SELL' ? 'border-[var(--color-crypto-red)]/30 text-[var(--color-crypto-red)]' : 'border-white/5 text-white/10'}`}>
                        {marketData[coin].signal}
                      </div>
                      {marketData[coin].botStatus && (
                        <div className="text-[6px] font-mono text-white/40 uppercase tracking-tighter animate-pulse">
                          {marketData[coin].botStatus}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="mb-3 h-10 flex items-center">
                  <AP mode="wait">
                    {marketData[coin]?.price ? (
                      <m.div key={marketData[coin].price} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -5, opacity: 0 }}>
                        <div className={`text-xl font-black font-mono tracking-tighter ${getPriceColor(coin)}`}>
                          ${marketData[coin].price?.toLocaleString(undefined, { minimumFractionDigits: getDecimals(coin) })}
                        </div>
                        {marketData[coin]?.gain !== null && marketData[coin]?.gain !== undefined && (
                          <div className={`text-[9px] font-mono font-bold mt-0.5 ${marketData[coin].gain! >= 0 ? 'text-[var(--color-crypto-green)] glow-text-green' : 'text-[var(--color-crypto-red)]'}`}>
                            {marketData[coin].gain! >= 0 ? '+' : ''}{marketData[coin].gain!.toFixed(1)}%
                          </div>
                        )}
                      </m.div>
                    ) : (
                      <div className="text-[10px] font-mono text-white/10 animate-pulse">BOOTING...</div>
                    )}
                  </AP>
                </div>

                {/* Technical Indicators */}
                {marketData[coin]?.price && (
                  <div className="flex items-center gap-3 mb-3 text-[7px] font-mono whitespace-nowrap overflow-hidden opacity-50">
                    <div className="flex items-center gap-1">
                      <span className="text-white/40">RSI</span>
                      <span className={marketData[coin]?.rsiValue! > 65 ? 'text-red-400' : marketData[coin]?.rsiValue! < 35 ? 'text-green-400' : 'text-white/80'}>
                        {marketData[coin]?.rsiValue?.toFixed(0) || '--'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-white/40">VOLA</span>
                      <span className="text-white/80">{marketData[coin]?.volatility ? (marketData[coin].volatility! * 100).toFixed(2) + '%' : '--'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-white/40">ATR</span>
                      <span className="text-white/80">{marketData[coin]?.atr ? marketData[coin].atr!.toFixed(getDecimals(coin)) : '--'}</span>
                    </div>
                  </div>
                )}

                {/* Manual trade buttons removed */}
              </div>
            ))}
            
            <Link href="/markets" className="glass-panel p-4 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center hover:bg-white/[0.02] text-white/10 hover:text-white/40 transition-all">
              <PlusCircle size={18} className="mb-1" />
              <span className="text-[8px] font-mono uppercase font-bold text-center leading-tight">Edit<br/>Dashboard</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-3 glass-panel rounded-2xl border border-white/5 flex flex-col h-[480px]">
          <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex gap-4">
              {["signals", "trades"].map((tab) => (
                <button key={tab} onClick={() => setActiveLogTab(tab as any)} className={`text-[9px] font-mono uppercase tracking-widest transition-all ${activeLogTab === tab ? 'text-white border-b border-white pb-1' : 'text-white/20 hover:text-white/40'}`}>
                  {tab}
                </button>
              ))}
            </div>
            <button onClick={downloadLogs} className="p-1 text-white/20 hover:text-white transition-all rounded">
              <Download size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            <AP mode="popLayout">
              {(activeLogTab === "signals" ? signalsLog : tradeHistory).map((log: any) => (
                <m.div key={log.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex justify-between items-center text-[10px] font-mono pb-2 border-b border-white/[0.03] min-h-[32px]">
                  <div className="flex flex-col">
                    <span className="font-bold text-white/90">{log.coin}</span>
                    <span className="text-[7px] opacity-20">{log.time}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                      {log.totalUSDT && (
                        <span className={`text-[9px] font-black ${log.action === 'SELL' ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
                          {log.action === 'SELL' ? '+' : '-'}${log.totalUSDT}
                        </span>
                      )}
                      <span className={(log.signal === 'BUY' || log.action === 'BUY') ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}>
                        {log.signal || log.action}
                      </span>
                    </div>
                    <span className="text-[7px] opacity-40">
                      {log.amount ? `${log.amount} @ $${log.price}` : `$${log.price}`}
                    </span>
                  </div>
                </m.div>
              ))}
            </AP>
            {(activeLogTab === "signals" ? signalsLog.length : tradeHistory.length) === 0 && (
              <div className="text-center py-24 text-[8px] font-mono text-white/5 uppercase tracking-widest">No Events</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <TradeMap />
          <HoldingsTable />
        </div>
        <div className="lg:col-span-5">
          <TriangulationTool />
        </div>
      </div>
      <NotificationOverlay />
    </div>
  );
}
