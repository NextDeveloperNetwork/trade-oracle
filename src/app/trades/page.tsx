"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { TrendingUp, TrendingDown, ArrowRightLeft, Download, Filter } from "lucide-react";
import { motion as m, AnimatePresence as AP } from "framer-motion";

export default function TradesPage() {
  const { completedTrades, totalProfit } = useTradingEngine();
  const [filterCoin, setFilterCoin] = useState<string>("ALL");
  const [filterResult, setFilterResult] = useState<"ALL" | "WIN" | "LOSS">("ALL");

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
  const totalTrades = filtered.length;
  const wins = filtered.filter(t => t.profit > 0).length;
  const losses = filtered.filter(t => t.profit <= 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
  const totalPnL = filtered.reduce((sum, t) => sum + t.profit, 0);
  const avgProfit = totalTrades > 0 ? totalPnL / totalTrades : 0;
  const bestTrade = filtered.length > 0 ? filtered.reduce((best, t) => t.profit > best.profit ? t : best, filtered[0]) : null;
  const worstTrade = filtered.length > 0 ? filtered.reduce((worst, t) => t.profit < worst.profit ? t : worst, filtered[0]) : null;

  const downloadCSV = () => {
    if (filtered.length === 0) return;
    const headers = "Coin,Strategy,Entry Time,Exit Time,Entry Price,Exit Price,Amount,Invested,Returned,Profit,Profit%";
    const rows = filtered.map(t =>
      `${t.coin},${t.strategy},${t.entryTime},${t.exitTime},${t.entryPrice.toFixed(4)},${t.exitPrice.toFixed(4)},${t.amount.toFixed(6)},${t.invested.toFixed(2)},${t.returned.toFixed(2)},${t.profit.toFixed(4)},${t.profitPct.toFixed(2)}%`
    ).join("\n");
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `oracle_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Page Title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black font-mono tracking-tight text-white">Trade Operations</h1>
          <p className="text-[10px] font-mono text-white/30 mt-1">Completed round-trip BUY → SELL cycles with P&L breakdown</p>
        </div>
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-xl text-[10px] font-mono text-white/60 hover:text-white transition-all"
        >
          <Download size={12} />
          Export CSV
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Total P&L</div>
          <div className={`text-lg font-black font-mono ${totalPnL >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(4)}
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Trades</div>
          <div className="text-lg font-black font-mono text-white">{totalTrades}</div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Win Rate</div>
          <div className={`text-lg font-black font-mono ${winRate >= 50 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
            {winRate.toFixed(1)}%
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Avg / Trade</div>
          <div className={`text-lg font-black font-mono ${avgProfit >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
            {avgProfit >= 0 ? '+' : ''}${avgProfit.toFixed(4)}
          </div>
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Best Trade</div>
          <div className="text-lg font-black font-mono text-[var(--color-crypto-green)]">
            {bestTrade ? `+$${bestTrade.profit.toFixed(4)}` : '--'}
          </div>
          {bestTrade && <div className="text-[7px] font-mono text-white/20 mt-0.5">{bestTrade.coin}</div>}
        </div>
        <div className="glass-panel p-4 rounded-2xl border border-white/5">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-1">Worst Trade</div>
          <div className="text-lg font-black font-mono text-[var(--color-crypto-red)]">
            {worstTrade ? `${worstTrade.profit >= 0 ? '+' : ''}$${worstTrade.profit.toFixed(4)}` : '--'}
          </div>
          {worstTrade && <div className="text-[7px] font-mono text-white/20 mt-0.5">{worstTrade.coin}</div>}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-white/20" />
          <div className="flex gap-1">
            {coins.map(c => (
              <button
                key={c}
                onClick={() => setFilterCoin(c)}
                className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold transition-all ${
                  filterCoin === c
                    ? 'bg-white text-black'
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1 border-l border-white/10 pl-4">
          {(["ALL", "WIN", "LOSS"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterResult(f)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold transition-all ${
                filterResult === f
                  ? f === "WIN" ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : f === "LOSS" ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-white text-black'
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Trades Table */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/5 text-[8px] font-mono text-white/30 uppercase tracking-widest">
          <div className="col-span-1">Coin</div>
          <div className="col-span-1">Strategy</div>
          <div className="col-span-2">Entry</div>
          <div className="col-span-2">Exit</div>
          <div className="col-span-1 text-right">Invested</div>
          <div className="col-span-1 text-right">Returned</div>
          <div className="col-span-2 text-right">Profit</div>
          <div className="col-span-2 text-right">Return %</div>
        </div>

        {/* Rows */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
          <AP mode="popLayout">
            {filtered.map((t) => (
              <m.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`grid grid-cols-12 gap-2 px-4 py-3 border-b border-white/[0.03] text-[10px] font-mono items-center hover:bg-white/[0.02] transition-colors ${
                  t.profit > 0 ? 'border-l-2 border-l-green-500/30' : t.profit < 0 ? 'border-l-2 border-l-red-500/30' : ''
                }`}
              >
                {/* Coin */}
                <div className="col-span-1 flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[8px] font-bold">
                    {t.coin[0]}
                  </div>
                  <span className="font-bold text-white">{t.coin}</span>
                </div>

                {/* Strategy */}
                <div className="col-span-1">
                  <span className="text-[8px] text-white/40 bg-white/5 px-1.5 py-0.5 rounded">{t.strategy}</span>
                </div>

                {/* Entry */}
                <div className="col-span-2 flex flex-col">
                  <span className="text-white/70">${t.entryPrice.toFixed(4)}</span>
                  <span className="text-[7px] text-white/20">{t.entryTime}</span>
                </div>

                {/* Exit */}
                <div className="col-span-2 flex flex-col">
                  <div className="flex items-center gap-1">
                    <ArrowRightLeft size={8} className="text-white/15" />
                    <span className="text-white/70">${t.exitPrice.toFixed(4)}</span>
                  </div>
                  <span className="text-[7px] text-white/20">{t.exitTime}</span>
                </div>

                {/* Invested */}
                <div className="col-span-1 text-right text-white/50">
                  ${t.invested.toFixed(2)}
                </div>

                {/* Returned */}
                <div className="col-span-1 text-right text-white/50">
                  ${t.returned.toFixed(2)}
                </div>

                {/* Profit */}
                <div className="col-span-2 text-right flex items-center justify-end gap-1.5">
                  {t.profit >= 0 ? (
                    <TrendingUp size={12} className="text-[var(--color-crypto-green)]" />
                  ) : (
                    <TrendingDown size={12} className="text-[var(--color-crypto-red)]" />
                  )}
                  <span className={`font-black ${t.profit >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
                    {t.profit >= 0 ? '+' : ''}${t.profit.toFixed(4)}
                  </span>
                </div>

                {/* Return % */}
                <div className="col-span-2 text-right">
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${
                    t.profitPct >= 0
                      ? 'bg-green-500/10 text-[var(--color-crypto-green)] border border-green-500/20'
                      : 'bg-red-500/10 text-[var(--color-crypto-red)] border border-red-500/20'
                  }`}>
                    {t.profitPct >= 0 ? '+' : ''}{t.profitPct.toFixed(2)}%
                  </span>
                </div>
              </m.div>
            ))}
          </AP>

          {filtered.length === 0 && (
            <div className="text-center py-24 flex flex-col items-center gap-3">
              <ArrowRightLeft size={30} className="text-white/5" />
              <div className="text-[10px] font-mono text-white/10 uppercase tracking-widest">
                {completedTrades.length === 0
                  ? "Waiting for first completed BUY → SELL cycle..."
                  : "No trades match the current filter"}
              </div>
              {completedTrades.length === 0 && (
                <div className="text-[8px] font-mono text-white/5 max-w-sm text-center leading-relaxed">
                  The bot needs to complete a full round-trip: buy a coin, then sell it. 
                  Each completed cycle will appear here with exact profit calculations.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cumulative P&L Bar */}
      {filtered.length > 0 && (
        <div className="mt-4 glass-panel rounded-2xl border border-white/5 p-4">
          <div className="text-[8px] font-mono text-white/30 uppercase tracking-widest mb-3">Cumulative P&L Timeline</div>
          <div className="flex items-end gap-px h-20">
            {filtered.slice().reverse().map((t, i) => {
              const cumulative = filtered.slice().reverse().slice(0, i + 1).reduce((s, tr) => s + tr.profit, 0);
              const maxAbs = Math.max(...filtered.map(tr => Math.abs(tr.profit)), 0.001);
              const height = Math.max(4, Math.abs(t.profit) / maxAbs * 60);
              return (
                <div
                  key={t.id}
                  className="flex-1 min-w-[3px] relative group"
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: t.profit >= 0 ? 'flex-end' : 'flex-start', alignItems: 'center', height: '80px' }}
                >
                  <div
                    className={`w-full rounded-sm transition-all ${t.profit >= 0 ? 'bg-green-500/60' : 'bg-red-500/60'} group-hover:opacity-100 opacity-70`}
                    style={{ height: `${height}px`, marginTop: t.profit >= 0 ? 'auto' : '0' }}
                  />
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block bg-neutral-900 border border-white/10 rounded px-2 py-1 text-[7px] font-mono text-white/80 whitespace-nowrap z-10">
                    {t.coin} {t.profit >= 0 ? '+' : ''}{t.profit.toFixed(4)} | Σ {cumulative >= 0 ? '+' : ''}{cumulative.toFixed(4)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
