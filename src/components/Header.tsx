"use client";

import { useState, useEffect, useRef } from "react";
import { useTradingEngine, BotStrategy, MAX_OPEN_POSITIONS, SAFE_RESERVE } from "@/context/TradingContext";
import { STRATEGY_INFO } from "@/lib/strategies";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Wallet, ChevronDown, Cpu, Activity, RefreshCw } from "lucide-react";
import { motion as m, AnimatePresence as AP } from "framer-motion";

export default function Header() {
  const {
    totalUSDT, totalProfit, openPositions, balances,
    isLiveMode, toggleLiveMode,
    isAutoTrading, toggleAutoTrading,
    currentStrategy, setStrategy,
    syncBalances,
    setUSDTBalance,
  } = useTradingEngine();

  const [isMounted, setIsMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [refillOpen, setRefillOpen] = useState(false);
  const [usdtInput, setUsdtInput] = useState("");
  const [contextStrategy, setContextStrategy] = useState<BotStrategy | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const refillRef = useRef<HTMLDivElement>(null);
  
  const dropdownOpenRef = useRef(dropdownOpen);
  const refillOpenRef = useRef(refillOpen);
  useEffect(() => { dropdownOpenRef.current = dropdownOpen; }, [dropdownOpen]);
  useEffect(() => { refillOpenRef.current = refillOpen; }, [refillOpen]);

  const pathname = usePathname();

  const availableUsdt = Math.max(0, (balances.USDT || 0) - SAFE_RESERVE);

  useEffect(() => {
    setIsMounted(true);
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        if (dropdownOpenRef.current) {
          setDropdownOpen(false);
          setContextStrategy(null);
        }
      }
      if (refillRef.current && !refillRef.current.contains(target)) {
        if (refillOpenRef.current) {
          setRefillOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navLinks = [
    { href: "/", label: "Overview" },
    { href: "/trades", label: "History" },
    { href: "/markets", label: "Ecosystem" },
    { href: "/settings", label: "Config" },
  ];

  if (!isMounted) {
    return (
      <nav className="border-b border-[var(--color-crypto-border)] bg-[var(--color-crypto-bg)] fixed w-full top-0 z-50 safe-top h-20" />
    );
  }

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0f1d]/90 backdrop-blur-2xl fixed w-full top-0 z-50 safe-top shadow-2xl">
      <div className="max-w-[1920px] mx-auto px-6 h-20 flex items-center justify-between gap-4">

        {/* ── LEFT: Logo + Nav ───────────────────────────────── */}
        <div className="flex items-center gap-6 shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center p-0.5 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <div className="w-full h-full bg-[#0a0f1d] rounded-[9px] flex items-center justify-center">
                <Zap size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-black tracking-[0.3em] text-white">ORACLE</span>
              <span className="text-[8px] font-mono font-black text-indigo-400/50 uppercase tracking-widest mt-0.5">Neural AI Trading</span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/5" />

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link key={href} href={href} className="group flex flex-col pt-1">
                  <span className={`text-[11px] font-black tracking-widest uppercase transition-colors ${isActive ? "text-white" : "text-white/30 group-hover:text-white"}`}>
                    {label}
                  </span>
                  <div className={`h-0.5 w-full bg-indigo-500 mt-1 transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`} />
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── CENTER: Key Stats ─────────────────────────────── */}
        <div className="hidden lg:flex items-center gap-5 flex-1 justify-center">
          <div className="flex items-center gap-5 px-5 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Portfolio</div>
              <div className="text-[13px] font-black font-mono text-white">
                ${totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
              </div>
            </div>
            <div className="h-6 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Total P&L</div>
              <div className={`text-[13px] font-black font-mono ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(3)}
              </div>
            </div>
            <div className="h-6 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Slots</div>
              <div className="text-[13px] font-black font-mono text-white">
                {openPositions.length}<span className="text-white/30">/{MAX_OPEN_POSITIONS}</span>
              </div>
            </div>
            <div className="h-6 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Buy Power</div>
              <div className="text-[13px] font-black font-mono text-amber-400">
                ${availableUsdt.toFixed(3)}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Controls ───────────────────────────────── */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Strategy Picker */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[11px] font-mono font-bold"
            >
              <Cpu size={12} className="text-white/40" />
              <span className={STRATEGY_INFO[currentStrategy]?.color || "text-white"}>{STRATEGY_INFO[currentStrategy]?.name || "UNKNOWN"}</span>
              <ChevronDown size={10} className="text-white/30" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-[240px] bg-[#0d1117] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] z-[200]">
                {(Object.keys(STRATEGY_INFO) as BotStrategy[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStrategy(s); setDropdownOpen(false); setContextStrategy(null); }}
                    onContextMenu={(e) => { e.preventDefault(); setContextStrategy(prev => prev === s ? null : s); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors first:rounded-t-2xl last:rounded-b-2xl ${currentStrategy === s ? "bg-white/10" : ""}`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-mono font-black ${STRATEGY_INFO[s]?.color || "text-white"}`}>{STRATEGY_INFO[s]?.name || "UNKNOWN"}</span>
                      <span className="text-[9px] text-white/30 font-mono">{STRATEGY_INFO[s]?.desc || "No Description"}</span>
                    </div>
                    <span className="text-[8px] font-black px-2 py-0.5 rounded border border-white/20 text-white/40">{STRATEGY_INFO[s]?.risk || "???"}</span>
                  </button>
                ))}
                <AP>
                  {contextStrategy && (
                    <m.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="absolute right-[calc(100%+12px)] top-0 w-[240px] bg-[#0d1117] border border-white/10 rounded-2xl p-4 shadow-2xl z-[210]"
                    >
                      <div className={`text-[11px] font-black uppercase tracking-widest mb-2 ${STRATEGY_INFO[contextStrategy]?.color || "text-white"}`}>
                        {STRATEGY_INFO[contextStrategy]?.name || "Strategy"} Analysis
                      </div>
                      <p className="text-[10px] text-white/60 font-mono leading-relaxed">
                        {STRATEGY_INFO[contextStrategy]?.extendedDesc || "No extended details available for this strategy."}
                      </p>
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[8px] text-white/20 uppercase font-black">Risk Profile</span>
                        <span className={`text-[9px] font-black ${
                          STRATEGY_INFO[contextStrategy]?.risk === "HIGH" ? "text-red-400" :
                          STRATEGY_INFO[contextStrategy]?.risk === "MED" ? "text-orange-400" :
                          "text-emerald-400"
                        }`}>{STRATEGY_INFO[contextStrategy]?.risk || "N/A"}</span>
                      </div>
                    </m.div>
                  )}
                </AP>
              </div>
            )}
          </div>

          {/* Bot Toggle */}
          <button
            onClick={toggleAutoTrading}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[11px] font-bold font-mono ${
              isAutoTrading
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            <Zap size={13} fill={isAutoTrading ? "currentColor" : "none"} />
            <span>{isAutoTrading ? "BOT ON" : "BOT OFF"}</span>
          </button>

          {/* Live/Paper Toggle */}
          <button
            onClick={toggleLiveMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[11px] font-bold font-mono ${
              isLiveMode
                ? "bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.1)]"
                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            <Activity size={13} />
            <span>{isLiveMode ? "LIVE" : "PAPER"}</span>
          </button>

          {/* Refill (Paper only) */}
          {!isLiveMode && (
            <div className="relative" ref={refillRef}>
              <button
                onClick={() => setRefillOpen(!refillOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[11px] font-bold font-mono ${
                  refillOpen ? "bg-indigo-500 border-indigo-400 text-white" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                }`}
              >
                <RefreshCw size={13} className={refillOpen ? "animate-spin" : ""} />
                <span>REFILL</span>
              </button>

              <AP>
                {refillOpen && (
                  <m.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-[200px] bg-[#0d1117] border border-white/10 rounded-2xl p-4 shadow-2xl z-[200]"
                  >
                    <div className="text-[9px] text-white/20 uppercase font-black mb-3">Refill Paper Balance</div>
                    <div className="flex flex-col gap-2">
                      <input
                        type="number"
                        placeholder="Amount"
                        value={usdtInput}
                        onChange={(e) => setUsdtInput(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-lg px-3 py-2 text-[12px] font-mono text-white focus:outline-none focus:border-indigo-500/50"
                      />
                      <button
                        onClick={() => {
                          const val = parseFloat(usdtInput);
                          if (!isNaN(val)) {
                            setUSDTBalance(val);
                            setUsdtInput("");
                            setRefillOpen(false);
                          }
                        }}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors"
                      >
                        Set Balance
                      </button>
                    </div>
                  </m.div>
                )}
              </AP>
            </div>
          )}

          {/* Sync (Live only) */}
          {isLiveMode && (
            <button
              onClick={syncBalances}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              title="Sync live balances"
            >
              <RefreshCw size={14} />
            </button>
          )}

          {/* Portfolio / Mode pill */}
          <div className={`hidden xl:flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${isLiveMode ? "border-orange-500/30 bg-orange-500/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
            <div className="flex flex-col items-end">
              <span className={`text-[8px] font-black uppercase tracking-widest ${isLiveMode ? "text-orange-400" : "text-indigo-400"}`}>
                {isLiveMode ? "Live Production" : "Staging Environment"}
              </span>
              <div className="font-mono font-black text-base tracking-tighter text-white leading-none mt-0.5">
                <span className="opacity-20 mr-0.5">$</span>{totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isLiveMode ? "bg-orange-500/20 text-orange-400" : "bg-indigo-500/10 text-indigo-400"}`}>
              <Wallet size={16} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
