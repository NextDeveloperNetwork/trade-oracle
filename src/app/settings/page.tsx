"use client";

import React, { useState, useEffect } from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { Settings, Save, ShieldAlert, Target, TrendingUp, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { motion as m } from "framer-motion";

export default function SettingsPage() {
  const { botSettings, updateBotSettings, resetAll } = useTradingEngine();
  const [localSettings, setLocalSettings] = useState(botSettings);

  useEffect(() => {
    setLocalSettings(botSettings);
  }, [botSettings]);

  const handleSave = async () => {
    await updateBotSettings(localSettings);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-white p-6 sm:p-12 font-sans selection:bg-indigo-500/30">
      <div className="max-w-5xl mx-auto space-y-12 pb-24">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 border-b border-white/5 pb-12">
          <div className="flex items-center gap-6">
            <Link href="/" className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all group hover:scale-105 active:scale-95 shadow-xl">
              <ArrowLeft className="text-white/40 group-hover:text-indigo-400 transition-colors" size={24} />
            </Link>
            <div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
                Oracle <span className="text-indigo-500">Config</span>
              </h1>
              <p className="text-white/30 text-[11px] font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-2">
                <Settings size={12} className="text-indigo-500/50" />
                Neural Strategy Parameters & Risk Shield
              </p>
            </div>
          </div>
          
          <button 
            onClick={handleSave}
            className="group relative px-10 py-5 rounded-2xl bg-indigo-600 overflow-hidden transition-all hover:bg-indigo-500 active:scale-95 shadow-[0_20px_50px_rgba(79,70,229,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-3">
              <Save size={18} className="text-white/80" />
              <span className="font-black uppercase tracking-[0.2em] text-[12px]">Commit Changes</span>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          {/* STRATEGY & TIMEFRAME ARCHITECTURE */}
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="p-10 rounded-[3rem] bg-[#111622] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                <TrendingUp size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-white/90">Strategy Engine</h2>
                <p className="text-xs font-bold text-white/20 uppercase tracking-tighter">Algorithm & Timeframe</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Strategy Selector */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Active Neural Strategy</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { id: "ORACLE_ELITE", name: "Oracle Elite", desc: "Auto RSI + Fee Shield" },
                    { id: "MANUAL_ASSIST", name: "Manual + Auto Exit", desc: "Manual Buy + Auto TP/SL" },
                    { id: "EMA_SCALPER", name: "EMA Scalper", desc: "EMA 9/21 Momentum" },
                    { id: "TREND_FOLLOWER", name: "Trend Follow", desc: "ATR Breakout Channel" }
                  ].map((strat) => (
                    <button
                      key={strat.id}
                      type="button"
                      onClick={() => setLocalSettings({ ...localSettings, strategy: strat.id })}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        (localSettings.strategy || "ORACLE_ELITE") === strat.id
                          ? "bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                          : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="text-[12px] font-black uppercase tracking-wider">{strat.name}</div>
                      <div className="text-[10px] font-mono opacity-60 mt-1">{strat.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Timeframe Selector */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Scanning Timeframe</label>
                <div className="flex gap-2">
                  {["1m", "3m", "5m", "15m", "1h"].map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setLocalSettings({ ...localSettings, timeframe: tf })}
                      className={`flex-1 py-3 rounded-xl font-mono text-[12px] font-bold border transition-all ${
                        (localSettings.timeframe || "1m") === tf
                          ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                          : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]"
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Anti-Revenge Cooldown */}
              <div className="space-y-4 pt-3 border-t border-white/5">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Stop-Loss Cooldown</label>
                    <p className="text-[13px] text-white/60 leading-relaxed max-w-[280px]">
                      Suppresses re-buying a liquidated coin for N minutes to prevent revenge trading into falling knives.
                    </p>
                  </div>
                  <span className="text-3xl font-mono font-black text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                    {localSettings.cooldownMinutes ?? 15}m
                  </span>
                </div>
                <input 
                  type="range" min="0" max="60" step="5" 
                  value={localSettings.cooldownMinutes ?? 15}
                  onChange={(e) => setLocalSettings({...localSettings, cooldownMinutes: parseInt(e.target.value)})}
                  className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-amber-500 hover:bg-white/10 transition-colors"
                />
              </div>
            </div>
          </m.div>

          {/* PROFIT ARCHITECTURE */}
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="p-10 rounded-[3rem] bg-[#111622] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] scale-150 rotate-12 pointer-events-none">
                <Target size={120} />
             </div>

            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner">
                <Target size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-white/90">Growth Engine</h2>
                <p className="text-xs font-bold text-white/20 uppercase tracking-tighter">Profit Targets & Fee Recovery</p>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Net Profit Target</label>
                    <p className="text-[13px] text-white/60 leading-relaxed max-w-[280px]">
                      The clean profit margin you want to keep after all exchange fees are paid. The bot triggers automated exits at this threshold.
                    </p>
                  </div>
                  <span className="text-3xl font-mono font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">{localSettings.netTarget}%</span>
                </div>
                <input 
                  type="range" min="0.1" max="10" step="0.1" 
                  value={localSettings.netTarget ?? 0.5}
                  onChange={(e) => setLocalSettings({...localSettings, netTarget: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-emerald-500 hover:bg-white/10 transition-colors"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Exchange Fee Recovery</label>
                    <p className="text-[13px] text-white/60 leading-relaxed max-w-[280px]">
                      Covers the 0.1% buy and 0.1% sell costs. Correctly setting this ensures your strategy only executes when truly profitable.
                    </p>
                  </div>
                  <span className="text-3xl font-mono font-black text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]">{localSettings.feeRecovery}%</span>
                </div>
                <input 
                  type="range" min="0.1" max="1" step="0.05" 
                  value={localSettings.feeRecovery ?? 0.2}
                  onChange={(e) => setLocalSettings({...localSettings, feeRecovery: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:bg-white/10 transition-colors"
                />
              </div>
            </div>
          </m.div>

          {/* RISK CAPACITY */}
          <m.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="p-10 rounded-[3rem] bg-[#111622] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden lg:col-span-2">
            <div className="flex items-center gap-5">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shadow-inner">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-widest text-white/90">Risk Safeguards & Deployment Ceiling</h2>
                <p className="text-xs font-bold text-white/20 uppercase tracking-tighter">Automatic Shielding & Sizing</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                   <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Hard Stop Loss</label>
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      Instant liquidation trigger to protect capital.
                    </p>
                  </div>
                  <span className="text-3xl font-mono font-black text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">{localSettings.stopLoss}%</span>
                </div>
                <input 
                  type="range" min="-10" max="-0.5" step="0.5" 
                  value={localSettings.stopLoss ?? -1.5}
                  onChange={(e) => setLocalSettings({...localSettings, stopLoss: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-red-500 hover:bg-white/10 transition-colors"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Liquidity Allocation</label>
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      % of available USDT staked per position.
                    </p>
                  </div>
                  <span className="text-3xl font-mono font-black text-amber-500 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">{localSettings.allocationPct}%</span>
                </div>
                <input 
                  type="range" min="1" max="99" step="1" 
                  value={localSettings.allocationPct ?? 10}
                  onChange={(e) => setLocalSettings({...localSettings, allocationPct: parseFloat(e.target.value)})}
                  className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-amber-500 hover:bg-white/10 transition-colors"
                />
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-black text-white/40 uppercase tracking-widest">Deployment Slots</label>
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      Max simultaneous coin positions.
                    </p>
                  </div>
                  <span className="text-3xl font-mono font-black text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.3)]">{localSettings.maxOpenPositions}</span>
                </div>
                <input 
                  type="range" min="1" max="15" step="1" 
                  value={localSettings.maxOpenPositions ?? 5}
                  onChange={(e) => setLocalSettings({...localSettings, maxOpenPositions: parseInt(e.target.value)})}
                  className="w-full h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:bg-white/10 transition-colors"
                />
              </div>
            </div>
          </m.div>

        </div>

        {/* NEURAL EXECUTION PREVIEW */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="lg:col-span-8 p-10 rounded-[3rem] bg-white/[0.03] border border-white/10 flex flex-col gap-8 shadow-inner">
            <div className="flex items-center gap-3">
               <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,1)]" />
               <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/40">Execution Logic Simulator</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-white/20 uppercase font-black">Gross Exit Barrier</span>
                <p className="text-3xl font-mono font-black text-white">{(localSettings.feeRecovery + localSettings.netTarget).toFixed(2)}%</p>
                <div className="h-0.5 w-12 bg-emerald-500/50" />
              </div>
              
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-white/20 uppercase font-black">Risk/Reward Alpha</span>
                <p className="text-3xl font-mono font-black text-white">1 : {(localSettings.netTarget / Math.abs(localSettings.stopLoss)).toFixed(1)}</p>
                <div className="h-0.5 w-12 bg-indigo-500/50" />
              </div>
              
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-white/20 uppercase font-black">Capital Utilization</span>
                <p className="text-3xl font-mono font-black text-amber-400">{(localSettings.allocationPct * localSettings.maxOpenPositions).toFixed(0)}%</p>
                <div className="h-0.5 w-12 bg-amber-500/50" />
              </div>
            </div>
            
            <p className="text-xs text-white/30 font-bold border-t border-white/5 pt-6 leading-relaxed italic">
              Oracle Logic: To secure a <span className="text-emerald-400">+{localSettings.netTarget}%</span> net gain, the engine will attempt to sell assets at a <span className="text-white/60">{(localSettings.feeRecovery + localSettings.netTarget).toFixed(2)}%</span> market increase. If the asset drops to <span className="text-red-400">{localSettings.stopLoss}%</span>, the "Risk Shield" will override all protocols and force a full liquidation.
            </p>
          </m.div>

          {/* DANGER ZONE (SCALED) */}
          <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="lg:col-span-4 p-10 rounded-[3rem] bg-red-500/[0.03] border border-red-500/20 flex flex-col justify-between gap-6 shadow-[inset_0_0_40px_rgba(239,68,68,0.05)]">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <ShieldAlert size={18} className="text-red-500/60" />
                <h3 className="text-red-500/60 font-black uppercase tracking-[0.2em] text-[12px]">System Wipe</h3>
              </div>
              <p className="text-[13px] text-red-500/40 font-bold leading-snug">
                Permanently purge all neural signals, position history, and balance telemetry for the current active environment. This action is irreversible.
              </p>
            </div>
            
            <button 
              onClick={resetAll}
              className="py-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500 hover:text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all hover:scale-[1.02] active:scale-95 shadow-lg"
            >
              Purge Environment
            </button>
          </m.div>
        </div>

      </div>
    </div>
  );
}

