"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { TrendingUp, TrendingDown, ArrowRightLeft, Download, Filter } from "lucide-react";
import { motion as m, AnimatePresence as AP } from "framer-motion";

export default function TradesPage() {
  const { completedTrades, tradeHistory, totalProfit } = useTradingEngine();
  const [filterCoin, setFilterCoin] = useState<string>("ALL");
  const [filterResult, setFilterResult] = useState<"ALL" | "WIN" | "LOSS">("ALL");
  const [activeTab, setActiveTab] = useState<"CYCLES" | "AUDIT">("CYCLES");

  // Unique coins from trades
  const coins = ["ALL", ...Array.from(new Set(completedTrades.map(t => t.coin)))];

  // Filter logic
  const filtered = completedTrades.filter(t => {
    if (filterCoin !== "ALL" && t.coin !== filterCoin) return false;
    if (filterResult === "WIN" && t.profit <= 0) return false;
    if (filterResult === "LOSS" && t.profit >= 0) return false;
    return true;
  });

  // Stats
  const totalCompleted = filtered.length;
  const totalExecutions = tradeHistory.length;
  const wins = filtered.filter(t => t.netProfit > 0).length;
  const winRate = totalCompleted > 0 ? (wins / totalCompleted * 100) : 0;
  const totalGrossPnL = filtered.reduce((sum, t) => sum + t.profit, 0);
  const totalFees = filtered.reduce((sum, t) => sum + (t.fee || 0), 0);
  const totalNetPnL = filtered.reduce((sum, t) => sum + (t.netProfit || t.profit), 0);
  const avgNetProfit = totalCompleted > 0 ? totalNetPnL / totalCompleted : 0;
  const bestTrade = filtered.length > 0 ? filtered.reduce((best, t) => (t.netProfit || t.profit) > (best.netProfit || best.profit) ? t : best, filtered[0]) : null;

  const downloadCSV = () => {
    if (filtered.length === 0) return;
    const headers = "Coin,Strategy,Entry Time,Exit Time,Entry Price,Exit Price,Amount,Invested,Returned,Fee,Gross Profit,Net Profit,Profit%";
    const rows = filtered.map(t =>
      `${t.coin},${t.strategy},${t.entryTime},${t.exitTime},${t.entryPrice.toFixed(4)},${t.exitPrice.toFixed(4)},${t.amount.toFixed(6)},${t.invested.toFixed(2)},${t.returned.toFixed(2)},${(t.fee || 0).toFixed(4)},${t.profit.toFixed(4)},${(t.netProfit || t.profit).toFixed(4)},${t.profitPct.toFixed(2)}%`
    ).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `oracle_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-6 px-3 sm:px-4 mb-10 sm:mb-0">
      {/* Page Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-black font-mono tracking-tight text-white uppercase">Operations</h1>
          <p className="text-[8px] sm:text-[10px] font-mono text-white/30 mt-1">Net Performance & Audit Logs</p>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl text-[9px] font-mono text-white/60 transition-all shrink-0"
        >
          <Download size={12} />
          <span className="hidden xs:inline">EXPORT DATA</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 sm:gap-3 mb-6">
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-white/5">
          <div className="text-[7px] sm:text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Net P&L</div>
          <div className={`text-base sm:text-lg font-black font-mono ${totalNetPnL >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
            {totalNetPnL >= 0 ? '+' : ''}${totalNetPnL.toFixed(3)}
          </div>
        </div>
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-white/5">
          <div className="text-[7px] sm:text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Total Fees</div>
          <div className="text-base sm:text-lg font-black font-mono text-indigo-400">
            ${totalFees.toFixed(3)}
          </div>
        </div>
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-white/5">
          <div className="text-[7px] sm:text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Orders</div>
          <div className="text-base sm:text-lg font-black font-mono text-white">{totalExecutions}</div>
        </div>
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-white/5">
          <div className="text-[7px] sm:text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Net Win Rate</div>
          <div className={`text-base sm:text-lg font-black font-mono ${winRate >= 50 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
            {winRate.toFixed(0)}%
          </div>
        </div>
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-white/5">
          <div className="text-[7px] sm:text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Avg Net/Trade</div>
          <div className={`text-base sm:text-lg font-black font-mono ${avgNetProfit >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
            ${avgNetProfit.toFixed(3)}
          </div>
        </div>
        <div className="glass-panel p-3 sm:p-4 rounded-2xl border border-white/5 hidden sm:block">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Gross best</div>
          <div className="text-lg font-black font-mono text-[var(--color-crypto-green)]">
            {bestTrade ? `+$${bestTrade.profit.toFixed(3)}` : '--'}
          </div>
        </div>
      </div>

      {/* Filters - Scrollable */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <Filter size={10} className="text-white/20 shrink-0" />
          <div className="flex gap-1.5">
            {coins.map(c => (
              <button
                key={c}
                onClick={() => setFilterCoin(c)}
                className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold transition-all whitespace-nowrap ${
                  filterCoin === c ? 'bg-white text-black' : 'bg-white/5 text-white/40'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-4 mr-auto">
          {(["CYCLES", "AUDIT"] as const).map(tab => (
             <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? "bg-indigo-600 text-white shadow-lg" : "bg-white/5 text-white/20 hover:text-white/40"
              }`}
             >
               {tab}
             </button>
          ))}
        </div>

        <div className="flex gap-1.5 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-4">
          {(["ALL", "WIN", "LOSS"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterResult(f)}
              disabled={activeTab === "AUDIT"}
              className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold transition-all ${
                activeTab === "AUDIT" ? "opacity-20 cursor-not-allowed" :
                filterResult === f
                  ? f === "WIN" ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : f === "LOSS" ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white text-black'
                  : 'bg-white/5 text-white/40'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <AP mode="wait">
        {activeTab === "CYCLES" ? (
          <m.div key="cycles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {/* Trades Table - Compact for mobile */}
            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 text-[7px] sm:text-[8px] font-mono text-white/30 uppercase tracking-widest">
                <div className="col-span-3 sm:col-span-1">Coin</div>
                <div className="col-span-2 sm:col-span-1">Strategy</div>
                <div className="col-span-2 sm:col-span-1 text-right">Price</div>
                <div className="hidden sm:block col-span-2">Time</div>
                <div className="hidden sm:block col-span-1 text-right">Fee</div>
                <div className="hidden sm:block col-span-1 text-right">Gross</div>
                <div className="col-span-3 sm:col-span-2 text-right font-black">Net P&L</div>
                <div className="col-span-2 sm:col-span-1 text-right">Return %</div>
              </div>

              {/* Rows */}
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                <AP mode="popLayout">
                  {filtered.map((t) => (
                    <m.div
                      key={t.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`grid grid-cols-12 gap-2 px-4 py-4 border-b border-white/[0.03] text-[9px] sm:text-[10px] font-mono items-center hover:bg-white/[0.02] transition-colors ${
                        (t.netProfit || t.profit) > 0 ? 'border-l-2 border-l-green-500/30' : (t.netProfit || t.profit) < 0 ? 'border-l-2 border-l-red-500/30' : ''
                      }`}
                    >
                      <div className="col-span-3 sm:col-span-1 flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-white/5 hidden xs:flex items-center justify-center text-[8px] font-bold">
                          {t.coin[0]}
                        </div>
                        <span className="font-bold text-white">{t.coin}</span>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-[7px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded truncate inline-block max-w-full">{t.strategy}</span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 text-right">
                        <span className="text-white/70">${t.exitPrice.toFixed(3)}</span>
                      </div>

                      <div className="hidden sm:flex col-span-2 flex-col">
                        <span className="text-white/70">{t.exitTime}</span>
                        <span className="text-[7px] text-white/20">ENTRY {t.entryTime}</span>
                      </div>

                      <div className="hidden sm:block col-span-1 text-right text-indigo-400/60">
                        -${(t.fee || 0).toFixed(3)}
                      </div>

                      <div className="hidden sm:block col-span-1 text-right text-white/40">
                        ${t.profit.toFixed(3)}
                      </div>

                      <div className="col-span-3 sm:col-span-2 text-right flex items-center justify-end gap-1.5">
                        <span className={`font-black ${(t.netProfit || t.profit) >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
                          ${(t.netProfit || t.profit).toFixed(3)}
                        </span>
                      </div>

                      <div className="col-span-2 sm:col-span-1 text-right">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${
                          t.profitPct >= 0 ? 'bg-green-500/10 text-[var(--color-crypto-green)]' : 'bg-red-500/10 text-[var(--color-crypto-red)]'
                        }`}>
                          {t.profitPct >= 0 ? '+' : ''}{t.profitPct.toFixed(3)}%
                        </span>
                      </div>
                    </m.div>
                  ))}
                </AP>

                {filtered.length === 0 && (
                  <div className="text-center py-20 flex flex-col items-center gap-3">
                    <ArrowRightLeft size={24} className="text-white/5" />
                    <div className="text-[8px] font-mono text-white/10 uppercase tracking-widest">
                      No cycles found
                    </div>
                  </div>
                )}
              </div>
            </div>
          </m.div>
        ) : (
          <m.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
             <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 text-[7px] sm:text-[8px] font-mono text-white/30 uppercase tracking-widest">
                  <div className="col-span-3 sm:col-span-1">Action</div>
                  <div className="col-span-3 sm:col-span-2">Asset</div>
                  <div className="col-span-3 col-span-2 text-right">Execution Price</div>
                  <div className="col-span-3 col-span-3 text-right">Volume</div>
                  <div className="col-span-3 col-span-2 text-right">Total USDT</div>
                  <div className="col-span-2 text-right">Timestamp</div>
                </div>
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                  {tradeHistory.map((th) => (
                    <div key={th.id} className="grid grid-cols-12 gap-2 px-4 py-4 border-b border-white/[0.03] text-[9px] sm:text-[10px] font-mono items-center hover:bg-white/[0.02] transition-colors">
                      <div className="col-span-3 sm:col-span-1">
                        <span className={`px-2 py-0.5 rounded-md font-black text-[8px] ${th.action === "BUY" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                          {th.action}
                        </span>
                      </div>
                      <div className="col-span-3 sm:col-span-2 font-bold text-white">{th.coin}</div>
                      <div className="col-span-3 col-span-2 text-right text-white/70">${Number(th.price).toFixed(4)}</div>
                      <div className="col-span-3 col-span-3 text-right text-white/40">{Number(th.amount).toFixed(8)}</div>
                      <div className="col-span-3 col-span-2 text-right text-indigo-400">${Number(th.totalUSDT).toFixed(2)}</div>
                      <div className="col-span-2 text-right text-white/20 text-[8px]">{th.time}</div>
                    </div>
                  ))}
                  {tradeHistory.length === 0 && (
                    <div className="py-20 text-center text-white/10 font-mono text-[10px] uppercase tracking-widest">Awaiting system activity...</div>
                  )}
                </div>
             </div>
          </m.div>
        )}
      </AP>

      {/* Cumulative P&L Bar */}
      {filtered.length > 0 && (
        <div className="mt-4 glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-3">Cumulative Net Timeline</div>
          <div className="flex items-end gap-px h-20 overflow-x-auto no-scrollbar">
            {filtered.slice().reverse().map((t, i) => {
              const val = t.netProfit || t.profit;
              const maxAbs = Math.max(...filtered.map(tr => Math.abs(tr.netProfit || tr.profit)), 0.001);
              const height = Math.max(4, Math.abs(val) / maxAbs * 60);
              return (
                <div
                  key={t.id}
                  className="flex-1 min-w-[4px] sm:min-w-[8px] relative group"
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: val >= 0 ? 'flex-end' : 'flex-start', alignItems: 'center', height: '80px' }}
                >
                  <div
                    className={`w-[80%] rounded-sm transition-all ${val >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'} group-hover:opacity-100 opacity-70`}
                    style={{ height: `${height}px`, marginTop: val >= 0 ? 'auto' : '0' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
