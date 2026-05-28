
"use client";

import React, { useState, useRef, useEffect } from "react";
import { Activity, PlusCircle, Zap, Download, ChevronDown, XCircle, TrendingUp, TrendingDown, RefreshCw, BarChart2, Cpu } from "lucide-react";
import { motion as m, AnimatePresence as AP } from "framer-motion";
import { useTradingEngine, BotStrategy, SAFE_RESERVE, MAX_OPEN_POSITIONS, Candle } from "@/context/TradingContext";
import { STRATEGY_INFO } from "@/lib/strategies";
import TradeMap from "./TradeMap";
import TriangulationTool from "./TriangulationTool";
import MainCandleChart from "./MainCandleChart";
import HoldingsTable from "./HoldingsTable";
import NeuralStatus from "./NeuralStatus";
import Link from "next/link";

const getDecimals = (symbol: string) => {
  if (symbol === "XRP") return 4;
  if (symbol === "BTC" || symbol === "ETH") return 2;
  return 4;
};

function CandleChartMini({ data }: { data: Candle[] }) {
  if (!data || data.length < 2) return <div className="h-10 w-full bg-white/5 rounded-lg animate-pulse" />;
  
  const relevant = data.slice(-20);
  const min = Math.min(...relevant.map(c => c.l));
  const max = Math.max(...relevant.map(c => c.h));
  const range = max - min || 1;
  const h = 40;
  const w = 140;
  const cw = w / 20;

  return (
    <svg width={w} height={h} className="mt-2 overflow-visible">
      {relevant.map((c, i) => {
        const isUp = c.c >= c.o;
        const color = isUp ? "#00c087" : "#ff3b57";
        const x = i * cw;
        const yHigh = ((max - c.h) / range) * h;
        const yLow = ((max - c.l) / range) * h;
        const yOpen = ((max - c.o) / range) * h;
        const yClose = ((max - c.c) / range) * h;
        
        return (
          <g key={i}>
            <line x1={x + cw/2} y1={yHigh} x2={x + cw/2} y2={yLow} stroke={color} strokeWidth="1" opacity={0.5} />
            <rect 
              x={x + 1} y={Math.min(yOpen, yClose)} 
              width={cw - 2} height={Math.max(1, Math.abs(yOpen - yClose))} 
              fill={color} 
            />
          </g>
        );
      })}
    </svg>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-[30px] flex items-center justify-center text-[8px] text-white/5 uppercase font-bold tracking-widest">Collecting Data…</div>;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((d - min) / range) * height,
  }));
  const path = `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`;
  return (
    <div className="h-[30px] w-full mt-1 overflow-hidden">
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <m.path 
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          d={path} 
          fill="none" 
          stroke={color} 
          strokeWidth="1.5" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
      </svg>
    </div>
  );
}

type NotificationOverlayProps = { notifications: { id: string; msg: string; type: "error" | "info" | "success" }[] };
function NotificationOverlay({ notifications }: NotificationOverlayProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      <AP>
        {notifications.map(n => (
          <m.div
            key={n.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 min-w-[300px] ${
              n.type === "error" ? "bg-red-950/80 border-red-500/40 text-red-100" :
              n.type === "success" ? "bg-green-950/80 border-green-500/40 text-green-100" :
              "bg-blue-950/80 border-blue-500/40 text-blue-100"
            }`}
          >
            <div className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${
              n.type === "error" ? "bg-red-400" : n.type === "success" ? "bg-green-400" : "bg-blue-400"
            }`} />
            <span className="text-[12px] font-mono font-semibold">{n.msg}</span>
          </m.div>
        ))}
      </AP>
    </div>
  );
}

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
    snapshots,
    openPositions,
    resetAll,
    resetPnL,
    removeCoin
  } = useTradingEngine();

  const [usdtInput, setUsdtInput] = useState("");
  const [period, setPeriod] = useState<string>("ALL");
  const [activeLogTab, setActiveLogTab] = useState<"signals" | "trades">("signals");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [contextStrategy, setContextStrategy] = useState<BotStrategy | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const periods = [
    { label: "1m", ms: 60_000 }, { label: "5m", ms: 300_000 },
    { label: "1h", ms: 3_600_000 }, { label: "24h", ms: 86_400_000 },
    { label: "ALL", ms: Infinity },
  ];

  const getPeriodPnL = () => {
    if (period === "ALL") return totalProfit;
    const p = periods.find(x => x.label === period);
    if (!p || snapshots.length === 0) return 0;
    const targetTime = Date.now() - p.ms;
    let closest = snapshots[0];
    let minDiff = Math.abs(snapshots[0].t - targetTime);
    for (const s of snapshots) {
      const diff = Math.abs(s.t - targetTime);
      if (diff < minDiff) { minDiff = diff; closest = s; }
    }
    return totalUSDT - closest.v;
  };

  const periodPnL = getPeriodPnL();

  useEffect(() => {
    setIsMounted(true);
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setContextStrategy(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleUpdateBalance = () => {
    const val = parseFloat(usdtInput);
    if (!isNaN(val)) { setUSDTBalance(val); setUsdtInput(""); }
  };

  const getPriceColor = (coin: string) => {
    const s = marketData[coin];
    if (!s?.price || !s?.prevPrice || s.price === s.prevPrice) return "text-white";
    return s.price > s.prevPrice ? "text-emerald-400" : "text-red-400";
  };

  const downloadLogs = () => {
    const logs = activeLogTab === "signals" ? signalsLog : tradeHistory;
    if (!logs.length) return;
    const headers = Object.keys(logs[0]).join(",");
    const rows = logs.map(l => Object.values(l).join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8," + headers + "\n" + rows));
    link.setAttribute("download", `oracle_${activeLogTab}_${Date.now()}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const pnlPositive = periodPnL >= 0;
  const availableUsdt = Math.max(0, (balances.USDT || 0) - SAFE_RESERVE);

  return (
    <div className="w-full min-h-screen bg-[var(--color-crypto-bg)] text-[var(--color-crypto-text)]">
      <NotificationOverlay notifications={notifications} />

      {/* ── TOP HEADER BAR ─────────────────────────────────────────────── */}
      <header className="border-b border-white/5 bg-[#1e2a4a]/80 backdrop-blur-xl sticky top-0 z-50 px-8 lg:px-12 py-3 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <BarChart2 size={16} className="text-emerald-400" />
            </div>
            <div>
              <div className="text-[13px] font-black tracking-widest text-white uppercase">Crypto Oracle</div>
              <div className="text-[9px] font-mono text-white/30 uppercase tracking-widest">Trading Engine v2</div>
            </div>
          </div>

          {/* Center Stats */}
          <div className="hidden md:flex items-center gap-6">
            <div className="text-center group relative cursor-help">
              <div className="text-[9px] text-[var(--color-crypto-muted)] uppercase tracking-widest font-bold">Total Portfolio</div>
              <div className="text-[15px] font-black font-mono text-[var(--color-crypto-text)]">${isMounted ? totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '0.0000'}</div>
              <div className="text-[8px] text-white/20 uppercase font-black tracking-tighter">Equity + Cash</div>
            </div>
            <div className="w-px h-8 bg-[var(--color-crypto-border)]" />
            <div className="text-center group/pnl">
              <div className="flex items-center justify-center gap-1.5 translate-x-3">
                <div className="text-[9px] text-[var(--color-crypto-muted)] uppercase tracking-widest font-bold">Total P&L</div>
                <button 
                  onClick={() => { if(confirm("Reset P&L to $0.00 base?")) resetPnL(); }}
                  className="opacity-0 group-hover/pnl:opacity-100 p-0.5 rounded bg-white/5 border border-white/10 text-white/20 hover:text-white transition-all"
                  title="Zero-point P&L Baseline"
                >
                  <RefreshCw size={8} />
                </button>
              </div>
              <div className={`text-[15px] font-black font-mono ${totalProfit >= 0 ? "text-[var(--color-crypto-green)]" : "text-[var(--color-crypto-red)]"}`}>
                {totalProfit >= 0 ? "+" : ""}${isMounted ? Math.abs(totalProfit).toFixed(4) : '0.0000'}
              </div>
              <div className="text-[8px] text-white/20 uppercase font-black tracking-tighter">Lifetime Net</div>
            </div>
            <div className="w-px h-8 bg-[var(--color-crypto-border)]" />
            <div className="text-center">
              <div className="text-[9px] text-[var(--color-crypto-muted)] uppercase tracking-widest font-bold">Open Slots</div>
              <div className="text-[15px] font-black font-mono text-[var(--color-crypto-text)]">{openPositions.length}<span className="text-[var(--color-crypto-muted)]">/{MAX_OPEN_POSITIONS}</span></div>
              <div className="text-[8px] text-white/20 uppercase font-black tracking-tighter">Active Trades</div>
            </div>
            <div className="w-px h-8 bg-[var(--color-crypto-border)]" />
            <div className="text-center group relative cursor-help">
              <div className="text-[9px] text-[var(--color-crypto-muted)] uppercase tracking-widest font-bold">Buy Power</div>
              <div className="text-[15px] font-black font-mono text-amber-500">${availableUsdt.toFixed(4)}</div>
              <div className="text-[8px] text-white/20 uppercase font-black tracking-tighter">Cash - $11 Reserve</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Strategy Picker */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[11px] font-mono font-bold"
              >
                <Cpu size={12} className="text-white/40" />
                <span className={STRATEGY_INFO[currentStrategy].color}>{STRATEGY_INFO[currentStrategy].name}</span>
                <ChevronDown size={10} className="text-white/30" />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-[240px] bg-[#1a1f2e] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] z-[110]">
                  {(Object.keys(STRATEGY_INFO) as BotStrategy[]).map((s) => (
                    <button 
                      key={s} 
                      onClick={() => { setStrategy(s); setDropdownOpen(false); setContextStrategy(null); }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextStrategy(prev => prev === s ? null : s);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${currentStrategy === s ? "bg-white/10" : ""}`}
                    >
                      <div className="flex flex-col">
                        <span className={`text-[11px] font-mono font-black ${STRATEGY_INFO[s].color}`}>{STRATEGY_INFO[s].name}</span>
                        <span className="text-[9px] text-white/30 font-mono">{STRATEGY_INFO[s].desc}</span>
                      </div>
                      <span className="text-[8px] font-black px-2 py-0.5 rounded border border-white/20 text-white/40">{STRATEGY_INFO[s].risk}</span>
                    </button>
                  ))}
                  
                  {/* Extended Description Context Panel */}
                  <AP>
                    {contextStrategy && (
                      <m.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="absolute right-[calc(100%+12px)] top-0 w-[240px] bg-[#1a1f2e] border border-white/10 rounded-2xl p-4 shadow-2xl z-[120]"
                      >
                        <div className={`text-[11px] font-black uppercase tracking-widest mb-2 ${STRATEGY_INFO[contextStrategy].color}`}>
                          {STRATEGY_INFO[contextStrategy].name} Analysis
                        </div>
                        <p className="text-[10px] text-white/60 font-mono leading-relaxed">
                          {STRATEGY_INFO[contextStrategy].extendedDesc}
                        </p>
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[8px] text-white/20 uppercase font-black">Risk Profile</span>
                          <span className={`text-[9px] font-black ${
                            STRATEGY_INFO[contextStrategy].risk === 'HIGH' ? 'text-red-400' :
                            STRATEGY_INFO[contextStrategy].risk === 'MED' ? 'text-orange-400' :
                            'text-emerald-400'
                          }`}>
                            {STRATEGY_INFO[contextStrategy].risk}
                          </span>
                        </div>
                      </m.div>
                    )}
                  </AP>
                </div>
              )}
            </div>

            {/* Bot Toggle */}
            <button onClick={toggleAutoTrading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-[11px] font-bold font-mono ${
                isAutoTrading
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
              }`}
            >
              <Zap size={13} fill={isAutoTrading ? "currentColor" : "none"} />
              <span>{isAutoTrading ? "BOT ON" : "BOT OFF"}</span>
            </button>

            {/* Live/Paper Toggle */}
            <button onClick={toggleLiveMode}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-[11px] font-bold font-mono ${
                isLiveMode
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-600 shadow-sm"
                  : "bg-black/5 border-black/5 text-black/40 hover:bg-black/10"
              }`}
            >
              <Activity size={13} />
              <span>{isLiveMode ? "LIVE" : "PAPER"}</span>
            </button>

            {/* Sync */}
            {isLiveMode && (
              <button onClick={syncBalances}
                className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
                title="Sync balances"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT GRID ────────────────────────────────────────── */}
      <div className="px-6 sm:px-8 lg:px-12 py-5 space-y-8">
        
        {/* ROW 1: Swap + Holdings Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 h-[480px]">
            <TriangulationTool />
          </div>
          <div className="lg:col-span-8 h-[480px]">
            <HoldingsTable />
          </div>
        </div>

        {/* ROW 2: DUAL TELEMETRY STREAM (Signals & Trades side-by-side) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Signals Stream */}
          <div className="rounded-[2rem] border border-white/[0.07] bg-[#1a1f2e]/80 backdrop-blur-xl flex flex-col shadow-2xl overflow-hidden h-[360px]">
            <div className="px-8 py-4 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Activity size={14} className="text-indigo-400" />
                <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Market Intelligence</span>
              </div>
              <button onClick={downloadLogs} className="text-[9px] font-black text-white/20 hover:text-white transition-colors uppercase tracking-widest">
                 <Download size={12} className="inline mr-1" /> CSV
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
               <div className="flex flex-col gap-1">
                  {signalsLog.slice(0, 50).map((log: any) => (
                    <m.div key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.05] transition-all group/log">
                      <div className="flex items-center gap-4">
                        <span className="text-[9px] font-mono text-white/10 w-[55px]">{log.time}</span>
                        <div className={`w-1 h-1 rounded-full ${log.signal === "BUY" ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="text-[12px] font-black text-white/80 uppercase tracking-tighter w-[60px]">{log.coin}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${log.signal === "BUY" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}>{log.signal}</span>
                        <span className="text-[10px] text-white/30 truncate max-w-[150px]">{log.reason}</span>
                      </div>
                    </m.div>
                  ))}
                  {signalsLog.length === 0 && <div className="py-20 text-center text-[10px] text-white/5 uppercase font-black">No Signal Stream Detected</div>}
               </div>
            </div>
          </div>

          {/* Trade Records Stream */}
          <div className="rounded-[2rem] border border-white/[0.07] bg-[#1a1f2e]/80 backdrop-blur-xl flex flex-col shadow-2xl overflow-hidden h-[360px]">
            <div className="px-8 py-4 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <Download size={14} className="text-emerald-400" />
                <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Execution Logs</span>
              </div>
              <button onClick={downloadLogs} className="text-[9px] font-black text-white/20 hover:text-white transition-colors uppercase tracking-widest">
                 <Download size={12} className="inline mr-1" /> CSV
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
               <div className="flex flex-col gap-1">
                  {tradeHistory.slice(0, 50).map((th: any) => (
                    <m.div key={th.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.05] transition-all group/log">
                       <div className="flex items-center gap-4">
                        <span className="text-[9px] font-mono text-white/10 w-[55px]">{th.time}</span>
                        <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                        <span className="text-[12px] font-black text-white/80 uppercase tracking-tighter w-[60px]">{th.coin}</span>
                        <span className="text-[10px] font-bold text-white/60">Executed @ ${Number(th.price || 0).toFixed(3)}</span>
                        <span className="text-[9px] text-white/20">V: {Number(th.amount || 0).toFixed(th.amount > 1 ? 2 : 5)}</span>
                      </div>
                      <span className="text-[9px] font-black text-emerald-400/40 uppercase">Success</span>
                    </m.div>
                  ))}
                  {tradeHistory.length === 0 && <div className="py-20 text-center text-[10px] text-white/5 uppercase font-black">No Active Trade Records</div>}
               </div>
            </div>
          </div>
        </div>

        {/* ROW 3: Big Chart + Side Coins (Enhanced) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7">
            <MainCandleChart />
          </div>
          
          <div className="lg:col-span-5 space-y-4">
            <div className="text-[11px] text-white/30 uppercase tracking-[0.4em] font-bold pl-2">Market Intelligence</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
              {activeCoins.map((coin) => {
                const md = marketData[coin];
                const priceUp = md?.price && md?.prevPrice && md.price > md.prevPrice;
                
                // Real Conviction: 0-100 based on RSI proximity to extremes
                const rVal = md?.rsiValue || 50;
                const conviction = Math.min(100, Math.round(Math.abs(rVal - 50) * 2.5));
                
                const balance = balances[coin] || 0;
                const value = balance * (md?.price || 0);

                return (
                  <m.div key={coin}
                    whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.02)" }}
                    className="relative rounded-xl border border-white/[0.05] bg-[#0d121f]/60 p-2 flex flex-col gap-1.5 transition-all shadow-lg overflow-hidden group"
                  >
                    {/* Compact Header: Symbol | Price | Holding */}
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-black text-white/90 tracking-tighter uppercase">{coin}</span>
                        <div className={`text-[12px] font-black font-mono tracking-tighter ${getPriceColor(coin)}`}>
                          {md?.price ? md.price.toLocaleString('en-US', { minimumFractionDigits: getDecimals(coin) }) : '—'}
                        </div>
                      </div>
                      {balance > 0 && (
                        <div className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded uppercase">
                          {balance < 1 ? balance.toFixed(3) : balance.toFixed(1)}
                        </div>
                      )}
                    </div>

                    {/* Nano Stats Line: RSI | ATR | VOL */}
                    <div className="flex items-center justify-between px-1 text-[9px] font-bold border-y border-white/[0.03] py-0.5">
                      <div className="flex gap-2">
                        <span className={md?.rsiValue && md.rsiValue > 70 ? 'text-red-400' : md?.rsiValue && md.rsiValue < 30 ? 'text-emerald-400' : 'text-white/20'}>
                          R:{md?.rsiValue?.toFixed(0) || '—'}
                        </span>
                        <span className="text-white/20">A:{md?.atr ? md.atr.toFixed(getDecimals(coin)).slice(-4) : '—'}</span>
                      </div>
                      <span className="text-white/10 uppercase">V:{md?.volume ? (md.volume / 1000).toFixed(0) + 'k' : '—'}</span>
                    </div>

                    {/* Action Hub & Signal */}
                    <div className="flex items-center justify-between gap-2">
                      <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${
                        md?.signal === "BUY" ? "bg-emerald-500 shadow-emerald-500/50" :
                        md?.signal === "SELL" ? "bg-red-500 shadow-red-500/50" :
                        "bg-white/10 shadow-transparent"
                      }`} title={md?.signal || "HOLD"} />
                      
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] font-black text-white/20 uppercase tracking-tighter">Conviction</span>
                        <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500/50" style={{ width: `${conviction}%` }} />
                        </div>
                      </div>
                      
                      <div className="flex gap-1 flex-1 justify-end opacity-40 group-hover:opacity-100 transition-opacity">
                         <button 
                           onClick={() => executeTrade("BUY", coin, Math.min(availableUsdt, 25))}
                           className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-black uppercase text-white/40 hover:bg-emerald-500 hover:text-black transition-all"
                         >
                           Buy $25
                         </button>
                         <button 
                           onClick={() => executeTrade("SELL", coin, value)}
                           disabled={balance <= 0}
                           className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-black uppercase text-white/40 hover:bg-red-500 hover:text-white transition-all disabled:opacity-0"
                         >
                           Exit
                         </button>
                         <button onClick={() => removeCoin(coin)} className="ml-1 text-white/10 hover:text-red-400">
                           <XCircle size={10} />
                         </button>
                      </div>
                    </div>
                  </m.div>
                );
              })}
              
              <Link href="/markets"
                className="rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center gap-3 p-4 text-white/10 hover:text-white/30 hover:border-white/10 hover:bg-white/[0.01] transition-all"
              >
                <PlusCircle size={16} strokeWidth={1} />
                <span className="text-[9px] font-black uppercase tracking-widest">Connect Node</span>
              </Link>
            </div>

            {/* Compact Paper Load if needed */}
            {!isLiveMode && (
              <div className="rounded-2xl border border-white/[0.07] bg-indigo-500/5 p-4 space-y-3">
                <div className="text-[9px] text-white/20 uppercase font-black">Refill USDT</div>
                <div className="flex items-center gap-2">
                  <input
                    type="number" placeholder="Amt"
                    className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 text-[11px] font-mono text-white focus:outline-none"
                    value={usdtInput}
                    onChange={(e) => setUsdtInput(e.target.value)}
                  />
                  <button onClick={handleUpdateBalance} className="px-3 py-1.5 bg-indigo-600 rounded-lg text-[9px] font-black text-white">REUSE</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
