"use client";

import { useState, useEffect, useRef } from "react";
import { useTradingEngine, BotStrategy, MAX_OPEN_POSITIONS, SAFE_RESERVE } from "@/context/TradingContext";
import { STRATEGY_INFO } from "@/lib/strategies";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Wallet, ChevronDown, Cpu, Activity, RefreshCw, Menu, X, LayoutDashboard, History, Globe, Settings, ShieldCheck } from "lucide-react";
import { motion as m, AnimatePresence as AP } from "framer-motion";

export default function Header() {
  const {
    totalUSDT, totalProfit, openPositions, balances,
    isLiveMode, toggleLiveMode,
    isAutoTrading, toggleAutoTrading,
    currentStrategy, setStrategy,
    syncBalances,
    setUSDTBalance,
    botSettings,
    autoTradeStartedAt,
  } = useTradingEngine();

  const [isMounted, setIsMounted] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [refillOpen, setRefillOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [usdtInput, setUsdtInput] = useState("");
  const [contextStrategy, setContextStrategy] = useState<BotStrategy | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const refillRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();

  // Close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setDropdownOpen(false);
    setRefillOpen(false);
  }, [pathname]);

  const availableUsdt = Math.max(0, (balances.USDT || 0) - SAFE_RESERVE);

  useEffect(() => {
    setIsMounted(true);
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setDropdownOpen(false);
        setContextStrategy(null);
      }
      if (refillRef.current && !refillRef.current.contains(target)) {
        setRefillOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navLinks = [
    { href: "/", label: "Overview", icon: <LayoutDashboard size={14} /> },
    { href: "/trades", label: "History", icon: <History size={14} /> },
    { href: "/markets", label: "Ecosystem", icon: <Globe size={14} /> },
    { href: "/settings", label: "Config", icon: <Settings size={14} /> },
  ];

  if (!isMounted) {
    return (
      <nav className="border-b border-[var(--color-crypto-border)] bg-[var(--color-crypto-bg)] fixed w-full top-0 z-50 safe-top h-20" />
    );
  }

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0f1d]/95 backdrop-blur-2xl fixed w-full top-0 z-50 safe-top shadow-2xl">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-4">

        {/* ── LEFT: Logo + Desktop Nav ──────────────────────── */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group cursor-pointer shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center p-0.5 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <div className="w-full h-full bg-[#0a0f1d] rounded-[9px] flex items-center justify-center">
                <Zap size={14} className="sm:w-4 sm:h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] sm:text-[14px] font-black tracking-[0.25em] text-white">ORACLE</span>
              <span className="text-[7px] sm:text-[8px] font-mono font-black text-indigo-400/50 uppercase tracking-widest mt-0.5">AI Engine</span>
            </div>
          </Link>

          <div className="h-6 sm:h-8 w-px bg-white/5 hidden md:block" />

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-5 lg:gap-6">
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

        {/* ── CENTER: Key Stats (Desktop & Wide Tablets) ──────── */}
        <div className="hidden xl:flex items-center gap-5 flex-1 justify-center max-w-xl">
          <div className="flex items-center gap-4 lg:gap-5 px-4 lg:px-5 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Portfolio</div>
              <div className="text-[12px] lg:text-[13px] font-black font-mono text-white">
                ${totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-5 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Total P&L</div>
              <div className={`text-[12px] lg:text-[13px] font-black font-mono ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(3)}
              </div>
            </div>
            <div className="h-5 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Slots</div>
              <div className="text-[12px] lg:text-[13px] font-black font-mono text-white">
                {openPositions.length}<span className="text-white/30">/{MAX_OPEN_POSITIONS}</span>
              </div>
            </div>
            <div className="h-5 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Buy Power</div>
              <div className="text-[12px] lg:text-[13px] font-black font-mono text-amber-400">
                ${availableUsdt.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Controls & Actions ───────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Strategy Picker (Desktop/Tablet) */}
          <div className="relative hidden sm:block" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] sm:text-[11px] font-mono font-bold"
            >
              <Cpu size={12} className="text-white/40 shrink-0" />
              <span className={`truncate max-w-[110px] lg:max-w-none ${STRATEGY_INFO[currentStrategy]?.color || "text-white"}`}>
                {STRATEGY_INFO[currentStrategy]?.name || "UNKNOWN"}
              </span>
              <ChevronDown size={10} className="text-white/30 shrink-0" />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-[260px] bg-[#0d1117] border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] z-[200] overflow-hidden">
                {(Object.keys(STRATEGY_INFO) as BotStrategy[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStrategy(s); setDropdownOpen(false); setContextStrategy(null); }}
                    onContextMenu={(e) => { e.preventDefault(); setContextStrategy(prev => prev === s ? null : s); }}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-left border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${currentStrategy === s ? "bg-white/10" : ""}`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className={`text-[11px] font-mono font-black truncate ${STRATEGY_INFO[s]?.color || "text-white"}`}>{STRATEGY_INFO[s]?.name || "UNKNOWN"}</span>
                      <span className="text-[9px] text-white/30 font-mono truncate">{STRATEGY_INFO[s]?.desc || "No Description"}</span>
                    </div>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-white/20 text-white/40 shrink-0">{STRATEGY_INFO[s]?.risk || "???"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bot Toggle & Timer */}
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={toggleAutoTrading}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border transition-all text-[10px] sm:text-[11px] font-bold font-mono ${
                isAutoTrading
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              <Zap size={12} fill={isAutoTrading ? "currentColor" : "none"} className="shrink-0" />
              <span>{isAutoTrading ? "BOT ON" : "BOT OFF"}</span>
            </button>
            <AP>
              {isAutoTrading && botSettings.runTimer > 0 && autoTradeStartedAt && (
                <m.div 
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-[8px] sm:text-[9px] font-mono font-black text-white/40 flex items-center gap-1"
                >
                  <Activity size={7} className="text-emerald-500/50" />
                  <Countdown startTime={autoTradeStartedAt} hours={botSettings.runTimer} />
                </m.div>
              )}
            </AP>
          </div>

          {/* Live/Paper Toggle */}
          <button
            onClick={toggleLiveMode}
            className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border transition-all text-[10px] sm:text-[11px] font-bold font-mono ${
              isLiveMode
                ? "bg-orange-500/15 border-orange-500/30 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.1)]"
                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            <Activity size={12} className="shrink-0" />
            <span>{isLiveMode ? "LIVE" : "PAPER"}</span>
          </button>

          {/* Refill (Paper only - Desktop) */}
          {!isLiveMode && (
            <div className="relative hidden md:block" ref={refillRef}>
              <button
                onClick={() => setRefillOpen(!refillOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-all text-[11px] font-bold font-mono ${
                  refillOpen ? "bg-indigo-500 border-indigo-400 text-white" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                }`}
                title="Refill Paper Balance"
              >
                <RefreshCw size={12} className={refillOpen ? "animate-spin" : ""} />
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
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              title="Sync live balances"
            >
              <RefreshCw size={13} />
            </button>
          )}

          {/* Mobile Menu Hamburger Toggle (Visible on md and smaller) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all ml-1"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* ── MOBILE / TABLET DRAWER (Collapsible) ─────────────── */}
      <AP>
        {mobileMenuOpen && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/[0.06] bg-[#070b14]/98 backdrop-blur-3xl px-4 py-5 shadow-2xl overflow-hidden"
          >
            <div className="space-y-5">
              
              {/* Mobile Stats Breakdown */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Portfolio</span>
                  <span className="text-[14px] font-black font-mono text-white">
                    ${totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Total P&L</span>
                  <span className={`text-[14px] font-black font-mono ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(3)}
                  </span>
                </div>
                <div className="flex flex-col pt-2 border-t border-white/5">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Active Slots</span>
                  <span className="text-[12px] font-black font-mono text-white/80">
                    {openPositions.length} / {MAX_OPEN_POSITIONS}
                  </span>
                </div>
                <div className="flex flex-col items-end pt-2 border-t border-white/5">
                  <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">Buy Power</span>
                  <span className="text-[12px] font-black font-mono text-amber-400">
                    ${availableUsdt.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Mobile Strategy Picker */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Active Neural Strategy</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(STRATEGY_INFO) as BotStrategy[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setStrategy(s); }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        currentStrategy === s
                          ? "bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                          : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className={`text-[11px] font-mono font-black truncate ${STRATEGY_INFO[s]?.color || "text-white"}`}>
                        {STRATEGY_INFO[s]?.name}
                      </div>
                      <div className="text-[8px] font-mono opacity-50 truncate mt-0.5">{STRATEGY_INFO[s]?.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Navigation Links */}
              <div className="space-y-1 pt-2 border-t border-white/5">
                <label className="text-[9px] font-black text-white/40 uppercase tracking-widest px-1">Pages</label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {navLinks.map(({ href, label, icon }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${
                          isActive
                            ? "bg-indigo-600/20 border-indigo-500/40 text-white"
                            : "bg-white/[0.02] border-white/5 text-white/40 hover:bg-white/[0.05] hover:text-white"
                        }`}
                      >
                        {icon}
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Paper Refill Helper */}
              {!isLiveMode && (
                <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Refill USDT..."
                    value={usdtInput}
                    onChange={(e) => setUsdtInput(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={() => {
                      const val = parseFloat(usdtInput);
                      if (!isNaN(val)) {
                        setUSDTBalance(val);
                        setUsdtInput("");
                        setMobileMenuOpen(false);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                  >
                    Set
                  </button>
                </div>
              )}

            </div>
          </m.div>
        )}
      </AP>
    </nav>
  );
}

function Countdown({ startTime, hours }: { startTime: string; hours: number }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const target = new Date(startTime).getTime() + hours * 60 * 60 * 1000;
    
    const update = () => {
      const now = Date.now();
      const diff = target - now;
      
      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);

      const parts = [];
      if (d > 0) parts.push(`${d}d`);
      if (h > 0 || d > 0) parts.push(`${h}h`);
      parts.push(`${m}m`);
      parts.push(`${s}s`);
      
      setTimeLeft(parts.join(" "));
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startTime, hours]);

  return <span>{timeLeft}</span>;
}
