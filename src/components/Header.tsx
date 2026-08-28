"use client";

import { useState, useEffect, useRef } from "react";
import { useTradingEngine, MAX_OPEN_POSITIONS, SAFE_RESERVE } from "@/context/TradingContext";
import { STRATEGY_INFO } from "@/lib/strategies";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap, Wallet, Cpu, Activity, RefreshCw, Menu, X, LayoutDashboard, History, Globe, Settings } from "lucide-react";
import { motion as m, AnimatePresence as AP } from "framer-motion";

export default function Header() {
  const {
    totalUSDT, totalProfit, openPositions, balances,
    isLiveMode, toggleLiveMode,
    isAutoTrading, toggleAutoTrading,
    syncBalances,
    setUSDTBalance,
    botSettings,
    autoTradeStartedAt,
  } = useTradingEngine();

  const [isMounted, setIsMounted] = useState(false);
  const [refillOpen, setRefillOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [usdtInput, setUsdtInput] = useState("");
  
  const refillRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Automatically close mobile menu on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setRefillOpen(false);
  }, [pathname]);

  const availableUsdt = Math.max(0, (balances.USDT || 0) - SAFE_RESERVE);

  useEffect(() => {
    setIsMounted(true);
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (refillRef.current && !refillRef.current.contains(target)) {
        setRefillOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navLinks = [
    { href: "/", label: "Overview", icon: <LayoutDashboard size={16} /> },
    { href: "/trades", label: "History", icon: <History size={16} /> },
    { href: "/markets", label: "Ecosystem", icon: <Globe size={16} /> },
    { href: "/settings", label: "Config", icon: <Settings size={16} /> },
  ];

  if (!isMounted) {
    return (
      <nav className="border-b border-[var(--color-crypto-border)] bg-[var(--color-crypto-bg)] fixed w-full top-0 z-50 safe-top h-16 sm:h-20" />
    );
  }

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0f1d]/95 backdrop-blur-2xl fixed w-full top-0 z-50 safe-top shadow-2xl">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">

        {/* ── LEFT: Logo + Navigation Links ──────────────────── */}
        <div className="flex items-center gap-6 shrink-0">
          <Link href="/" className="flex items-center gap-3 group cursor-pointer shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center p-0.5 shadow-[0_0_20px_rgba(99,102,241,0.25)]">
              <div className="w-full h-full bg-[#0a0f1d] rounded-[9px] flex items-center justify-center">
                <Zap size={15} className="text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[14px] font-black tracking-[0.25em] text-white">ORACLE</span>
              <span className="text-[7.5px] sm:text-[8px] font-mono font-black text-indigo-400/50 uppercase tracking-widest mt-0.5">Neural AI Trading</span>
            </div>
          </Link>

          <div className="h-7 w-px bg-white/5 hidden md:block" />

          {/* Desktop Navigation Links */}
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

        {/* ── CENTER: Key Stats (Desktop only) ───────────────── */}
        <div className="hidden lg:flex items-center gap-5 flex-1 justify-center max-w-xl">
          <div className="flex items-center gap-5 px-5 py-2 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Portfolio</div>
              <div className="text-[13px] font-black font-mono text-white">
                ${totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-5 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Total P&L</div>
              <div className={`text-[13px] font-black font-mono ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(3)}
              </div>
            </div>
            <div className="h-5 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Slots</div>
              <div className="text-[13px] font-black font-mono text-white">
                {openPositions.length}<span className="text-white/30">/{MAX_OPEN_POSITIONS}</span>
              </div>
            </div>
            <div className="h-5 w-px bg-white/5" />
            <div className="text-center">
              <div className="text-[8px] text-white/25 uppercase tracking-widest font-black">Buy Power</div>
              <div className="text-[13px] font-black font-mono text-amber-400">
                ${availableUsdt.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Desktop Controls (Hidden on Small Screen) ── */}
        <div className="hidden md:flex items-center gap-2 shrink-0">

          {/* Strategy Indicator Badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] font-mono font-bold text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.1)]">
            <Cpu size={12} className="text-amber-400" />
            <span>Manual + Auto Exit</span>
          </div>

          {/* Bot Toggle & Timer */}
          <div className="flex flex-col items-end gap-0.5">
            <button
              onClick={toggleAutoTrading}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[11px] font-bold font-mono ${
                isAutoTrading
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                  : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              <Zap size={12} fill={isAutoTrading ? "currentColor" : "none"} />
              <span>{isAutoTrading ? "BOT ON" : "BOT OFF"}</span>
            </button>
            <AP>
              {isAutoTrading && botSettings.runTimer > 0 && autoTradeStartedAt && (
                <m.div 
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="text-[9px] font-mono font-black text-white/40 flex items-center gap-1"
                >
                  <Activity size={8} className="text-emerald-500/50" />
                  <Countdown startTime={autoTradeStartedAt} hours={botSettings.runTimer} />
                </m.div>
              )}
            </AP>
          </div>

          {/* Live/Paper Toggle */}
          <button
            onClick={toggleLiveMode}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[11px] font-bold font-mono ${
              isLiveMode
                ? "bg-orange-500/15 border-orange-500/30 text-orange-400 shadow-[0_0_12px_rgba(249,115,22,0.1)]"
                : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/70"
            }`}
          >
            <Activity size={12} />
            <span>{isLiveMode ? "LIVE" : "PAPER"}</span>
          </button>

          {/* Refill (Paper only) */}
          {!isLiveMode && (
            <div className="relative" ref={refillRef}>
              <button
                onClick={() => setRefillOpen(!refillOpen)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all text-[11px] font-bold font-mono ${
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
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
              title="Sync live balances"
            >
              <RefreshCw size={13} />
            </button>
          )}

          {/* Portfolio Pill */}
          <div className={`hidden xl:flex items-center gap-3 px-3.5 py-1.5 rounded-2xl border transition-all ${isLiveMode ? "border-orange-500/30 bg-orange-500/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
            <div className="flex flex-col items-end">
              <span className={`text-[7.5px] font-black uppercase tracking-widest ${isLiveMode ? "text-orange-400" : "text-indigo-400"}`}>
                {isLiveMode ? "Production" : "Staging"}
              </span>
              <div className="font-mono font-black text-sm tracking-tight text-white leading-none mt-0.5">
                ${totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isLiveMode ? "bg-orange-500/20 text-orange-400" : "bg-indigo-500/10 text-indigo-400"}`}>
              <Wallet size={13} />
            </div>
          </div>
        </div>

        {/* ── SMALLSCREEN: Hamburger Button ONLY ─────────────── */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all active:scale-95"
            aria-label="Toggle Full Menu"
          >
            {mobileMenuOpen ? <X size={20} className="text-indigo-400" /> : <Menu size={20} />}
          </button>
        </div>

      </div>

      {/* ── SMALLSCREEN FULL MENU SHEET (Slide-Down Drawer) ── */}
      <AP>
        {mobileMenuOpen && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="md:hidden border-t border-white/[0.08] bg-[#070b14]/98 backdrop-blur-3xl px-5 py-6 shadow-2xl overflow-y-auto max-h-[calc(100vh-4rem)]"
          >
            <div className="space-y-6">

              {/* 1. MASTER BOT & MODE CONTROLS */}
              <div className="space-y-3">
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">Master Controls</div>
                <div className="grid grid-cols-2 gap-3">
                  {/* Bot Toggle Button */}
                  <button
                    onClick={toggleAutoTrading}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                      isAutoTrading
                        ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                        : "bg-white/5 border-white/10 text-white/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap size={16} fill={isAutoTrading ? "currentColor" : "none"} />
                      <span className="text-[13px] font-black font-mono">{isAutoTrading ? "BOT ACTIVE" : "BOT OFF"}</span>
                    </div>
                    {isAutoTrading && botSettings.runTimer > 0 && autoTradeStartedAt && (
                      <div className="text-[9px] font-mono font-bold text-white/50 mt-1">
                        <Countdown startTime={autoTradeStartedAt} hours={botSettings.runTimer} />
                      </div>
                    )}
                  </button>

                  {/* Live / Paper Toggle Button */}
                  <button
                    onClick={toggleLiveMode}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all ${
                      isLiveMode
                        ? "bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.2)]"
                        : "bg-indigo-500/20 border-indigo-500/50 text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity size={16} />
                      <span className="text-[13px] font-black font-mono">{isLiveMode ? "LIVE BINANCE" : "PAPER SIM"}</span>
                    </div>
                    <span className="text-[9px] font-mono opacity-60 mt-1">{isLiveMode ? "Real Funds" : "Virtual $10,000"}</span>
                  </button>
                </div>
              </div>

              {/* 2. STRATEGY STATUS */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className="text-amber-400" />
                    <span className="text-[13px] font-mono font-black text-amber-400">Manual Entry + Auto Exit</span>
                  </div>
                  <span className="text-[8px] font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">ACTIVE</span>
                </div>
                <p className="text-[11px] text-white/70 leading-relaxed font-mono">
                  You buy coins manually. Bot guards open positions and triggers automatic TP/SL exits 24/7.
                </p>
              </div>

              {/* 3. LIVE PORTFOLIO TELEMETRY PANEL */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="text-[9px] font-black text-white/30 uppercase tracking-widest">Live Portfolio Stats</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Total Value</span>
                    <span className="text-[16px] font-black font-mono text-white mt-0.5">
                      ${totalUSDT.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Total P&L</span>
                    <span className={`text-[16px] font-black font-mono mt-0.5 ${totalProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {totalProfit >= 0 ? "+" : ""}${totalProfit.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex flex-col pt-2 border-t border-white/5">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Active Slots</span>
                    <span className="text-[13px] font-black font-mono text-white/80 mt-0.5">
                      {openPositions.length} / {MAX_OPEN_POSITIONS}
                    </span>
                  </div>
                  <div className="flex flex-col items-end pt-2 border-t border-white/5">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">Buy Power</span>
                    <span className="text-[13px] font-black font-mono text-amber-400 mt-0.5">
                      ${availableUsdt.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. NAVIGATION PAGES */}
              <div className="space-y-2.5 pt-2 border-t border-white/5">
                <div className="text-[9px] font-black text-white/40 uppercase tracking-widest">Navigation</div>
                <div className="grid grid-cols-2 gap-2">
                  {navLinks.map(({ href, label, icon }) => {
                    const isActive = pathname === href;
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-[11px] font-black uppercase tracking-wider transition-all ${
                          isActive
                            ? "bg-indigo-600/20 border-indigo-500/50 text-white shadow-[0_0_12px_rgba(99,102,241,0.2)]"
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

              {/* 5. TOOLING: REFILL OR SYNC */}
              <div className="pt-2 border-t border-white/5">
                {!isLiveMode ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Refill Paper USDT..."
                      value={usdtInput}
                      onChange={(e) => setUsdtInput(e.target.value)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[12px] font-mono text-white focus:outline-none focus:border-indigo-500"
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
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-colors shrink-0"
                    >
                      Set
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { syncBalances(); setMobileMenuOpen(false); }}
                    className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 font-mono text-[11px] font-bold"
                  >
                    <RefreshCw size={14} />
                    <span>Sync Live Balances from Binance</span>
                  </button>
                )}
              </div>

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
