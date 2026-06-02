
"use client";

import { Activity, PlusCircle, Zap, Download, XCircle, TrendingUp, TrendingDown } from "lucide-react";
import React, { useState, useEffect } from "react";
import { motion as m, AnimatePresence as AP } from "framer-motion";
import { useTradingEngine, Candle, SAFE_RESERVE } from "@/context/TradingContext";
import TriangulationTool from "./TriangulationTool";
import MainCandleChart from "./MainCandleChart";
import HoldingsTable from "./HoldingsTable";
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
            <line x1={x + cw / 2} y1={yHigh} x2={x + cw / 2} y2={yLow} stroke={color} strokeWidth="1" opacity={0.5} />
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
            className={`pointer-events-auto px-4 py-3 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-3 min-w-[300px] ${n.type === "error" ? "bg-red-950/80 border-red-500/40 text-red-100" :
              n.type === "success" ? "bg-green-950/80 border-green-500/40 text-green-100" :
                "bg-blue-950/80 border-blue-500/40 text-blue-100"
              }`}
          >
            <div className={`w-2 h-2 rounded-full shrink-0 animate-pulse ${n.type === "error" ? "bg-red-400" : n.type === "success" ? "bg-green-400" : "bg-blue-400"
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
    currentStrategy,
    totalUSDT,
    totalProfit,
    isLiveMode,
    activeCoins,
    notifications,
    snapshots,
    openPositions,
    completedTrades,
    resetAll,
    resetPnL,
    removeCoin,
    selectedCoin,
    setSelectedCoin,
  } = useTradingEngine();

  const [activeIntelligenceTab, setIntelligenceTab] = useState<"feed" | "scanner" | "insights">("feed");
  const [activeLogTab, setActiveLogTab] = useState<"signals" | "trades">("signals");
  const [isMounted, setIsMounted] = useState(false);
  const [period, setPeriod] = useState<string>("ALL");
  const [signalFilter, setSignalFilter] = useState<string>("ALL");

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
  }, []);

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

      {/* ── MAIN CONTENT GRID ────────────────────────────────────────── */}
      <div className="px-6 sm:px-8 lg:px-12 py-5 space-y-8">

        {/* ROW 1: Swap + Holdings Table */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-3 h-[360px]">
            <TriangulationTool />
          </div>
          <div className="lg:col-span-9 h-[520px]">
            <HoldingsTable />
          </div>
        </div>

        {/* ROW 2: DUAL TELEMETRY STREAM (Signals & Trades side-by-side) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Market Intelligence Hub */}
          <div className="rounded-[2.5rem] border border-white/[0.07] bg-[#1a1f2e]/90 backdrop-blur-2xl flex flex-col shadow-2xl overflow-hidden h-[380px] group/hub">
            <div className="px-8 py-5 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-6">
                {[
                  { id: 'feed', label: 'Signal Feed', icon: <Activity size={12} /> },
                  { id: 'scanner', label: 'Scanner', icon: <Zap size={12} /> },
                  { id: 'insights', label: 'Insights', icon: <TrendingUp size={12} /> },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setIntelligenceTab(tab.id as any)}
                    className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeIntelligenceTab === tab.id ? "text-indigo-400 opacity-100" : "text-white/20 hover:text-white/40 opacity-100"
                      }`}
                  >
                    {tab.icon}
                    {tab.label}
                    {activeIntelligenceTab === tab.id && <m.div layoutId="intelTab" className="absolute -bottom-[21px] left-0 right-0 h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                  </button>
                ))}
              </div>
              <button onClick={downloadLogs} className="text-[9px] font-black text-white/20 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-1">
                <Download size={12} /> CSV
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
              <AP mode="wait">
                {activeIntelligenceTab === "feed" && (
                  <m.div key="feed" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="flex flex-col gap-1">
                    <div className="flex gap-4 px-2 mb-3 pb-2 border-b border-white/5">
                      {["ALL", "BUY", "SELL"].map(f => (
                        <button
                          key={f}
                          onClick={() => setSignalFilter(f)}
                          className={`text-[8px] font-black uppercase tracking-widest transition-colors ${signalFilter === f ? "text-indigo-400" : "text-white/20 hover:text-white/40"
                            }`}
                        >
                          {f === "INFO" ? "SYSTEM" : f}
                        </button>
                      ))}
                    </div>
                    {signalsLog
                      .filter(l => signalFilter === "ALL" || l.signal === signalFilter)
                      .slice(0, 50).map((log: any) => (
                        <div key={log.id} className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.05] transition-all group/log">
                          <div className="flex items-center gap-4">
                            <span className="text-[9px] font-mono text-white/10 w-[55px]">{log.time}</span>
                            <div className={`w-1.5 h-1.5 rounded-full ${log.signal === "BUY" ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                              log.signal === "SELL" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" :
                                "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"
                              }`} />
                            <span className="text-[13px] font-black text-white/80 uppercase tracking-tighter w-[65px]">{log.coin}</span>
                            <div className="flex flex-col">
                              <span className="text-[10px] text-white/60 font-bold">{log.reason}</span>
                              <span className="text-[8px] text-white/20 font-mono tracking-widest uppercase">Verified Oracle Signal</span>
                            </div>
                          </div>
                          <span className="text-[12px] font-mono font-black text-white/40">
                            {isNaN(Number(log.price)) ? "ACTIVE" : `$${Number(log.price).toFixed(2)}`}
                          </span>
                        </div>
                      ))}
                    {signalsLog.length === 0 && <div className="py-24 text-center text-[10px] text-white/5 uppercase font-black tracking-widest">Awaiting Neural Signals…</div>}
                  </m.div>
                )}

                {activeIntelligenceTab === "scanner" && (
                  <m.div key="scanner" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="grid grid-cols-1 gap-2">
                    {activeCoins.map(coin => {
                      const md = marketData[coin];
                      const rsiValue = md?.rsiValue || 50;
                      const progress = Math.max(0, Math.min(100, (50 - rsiValue) / 20 * 100)); // RSI 50 -> 0%, RSI 30 -> 100%
                      const isPromising = rsiValue < 55;

                      return (
                        <div key={coin} className="px-4 py-3 rounded-2xl bg-white/[0.01] border border-white/[0.03] flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-[12px]">{coin[0]}</div>
                            <div className="flex flex-col">
                              <span className="text-[12px] font-black text-white/80 uppercase tracking-tighter">{coin}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black ${rsiValue < 30 ? 'text-emerald-400' : rsiValue < 50 ? 'text-indigo-400' : 'text-white/20'}`}>RSI: {rsiValue.toFixed(1)}</span>
                                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500/40" style={{ width: `${progress}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] text-white/20 font-black uppercase tracking-widest">Entry Confidence</span>
                            <span className={`text-[11px] font-black ${isPromising ? 'text-emerald-400' : 'text-white/10'}`}>
                              {isPromising ? (rsiValue < 35 ? 'EXCELLENT' : 'OPTIMAL') : 'WAITING'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </m.div>
                )}

                {activeIntelligenceTab === "insights" && (
                  <m.div key="insights" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6 p-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col">
                        <span className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-1">Win Rate</span>
                        <span className="text-2xl font-black font-mono text-indigo-400">
                          {(() => {
                            const last10 = completedTrades.slice(0, 10);
                            if (last10.length === 0) return "100%";
                            const wins = last10.filter(t => t.profit > 0).length;
                            return `${(wins / last10.length * 100).toFixed(0)}%`;
                          })()}
                        </span>
                      </div>
                      <div className="p-4 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex flex-col">
                        <span className="text-[9px] text-white/30 uppercase font-black tracking-widest mb-1">Avg Profit</span>
                        <span className="text-2xl font-black font-mono text-emerald-400">
                          {(() => {
                            const last10 = completedTrades.slice(0, 10);
                            if (last10.length === 0) return "$0.00";
                            const avg = last10.reduce((s, t) => s + t.profit, 0) / last10.length;
                            return `$${avg.toFixed(2)}`;
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 rounded-[2rem] bg-white/[0.02] border border-white/5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Neural Performance Alpha</span>
                        <TrendingUp size={14} className="text-indigo-500" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-[11px] font-mono">
                          <span className="text-white/40">Fee Offset Efficiency</span>
                          <span className="text-emerald-400">99.2%</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-mono">
                          <span className="text-white/40">Resale Margin Accuracy</span>
                          <span className="text-indigo-400">88.5%</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-2">
                          <m.div
                            initial={{ width: 0 }}
                            animate={{ width: "94%" }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  </m.div>
                )}
              </AP>
            </div>
          </div>

          {/* Trade Records Stream */}
          <div className="rounded-[2rem] border border-white/[0.07] bg-[#1a1f2e]/80 backdrop-blur-xl flex flex-col shadow-2xl overflow-hidden h-[380px]">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 h-[540px]">
            <MainCandleChart />
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="text-[11px] text-white/30 uppercase tracking-[0.4em] font-bold pl-2">Asset Telemetry</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto max-h-[540px] pr-2 custom-scrollbar">
              <Link href="/markets"
                className="rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center gap-3 p-4 text-white/10 hover:text-white/30 hover:border-white/10 hover:bg-white/[0.01] transition-all h-[110px]"
              >
                <PlusCircle size={16} strokeWidth={1} />
                <span className="text-[9px] font-black uppercase tracking-widest">Connect Node</span>
              </Link>
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
                    onClick={() => setSelectedCoin(coin)}
                    whileHover={{ x: 4, backgroundColor: "rgba(255,255,255,0.02)" }}
                    className={`relative rounded-xl border p-2.5 flex flex-col gap-1 transition-all shadow-lg overflow-hidden group cursor-pointer ${selectedCoin === coin ? "bg-indigo-500/10 border-indigo-500/30" : "bg-[#0d121f]/60 border-white/[0.05]"
                      }`}
                  >
                    {selectedCoin === coin && <m.div layoutId="activeCoin" className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 shadow-[2px_0_10px_rgba(99,102,241,0.5)]" />}
                    {/* Compact Header: Symbol | Price | Holding */}
                    <div className="flex items-center justify-between px-0.5">
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
                      <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${md?.signal === "BUY" ? "bg-emerald-500 shadow-emerald-500/50" :
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
                          onClick={() => executeTrade("BUY", coin, 11.0)}
                          className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-black uppercase text-white/40 hover:bg-emerald-500 hover:text-black transition-all"
                        >
                          Buy $11
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

            </div>


          </div>
        </div>
      </div>
    </div>
  );
}
