"use client";

import { useTradingEngine } from "@/context/TradingContext";
import Link from "next/link";
import { Zap, Triangle, Wallet, BarChart3 } from "lucide-react";

export default function Header() {
  const { totalUSDT, isLiveMode } = useTradingEngine();

  return (
    <nav className="border-b border-[var(--color-crypto-border)] bg-[var(--color-crypto-bg)] fixed w-full top-0 z-50 safe-top">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex gap-4 sm:gap-6 items-center">
          <div className="text-[var(--color-crypto-accent)] font-bold font-mono tracking-widest text-base sm:text-lg border-r border-[var(--color-crypto-border)] pr-4 sm:pr-6 mr-1 sm:mr-2">
            <span className="hidden sm:inline">ORACLE</span>
            <span className="sm:hidden">Ω</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/" className="text-white transition-colors font-mono text-[10px] sm:text-xs flex items-center gap-2">
              <Zap size={14}/> <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <Link href="/trades" className="text-white/60 hover:text-white transition-colors font-mono text-[10px] sm:text-xs flex items-center gap-2 border-l border-white/10 pl-4 sm:pl-6">
              <BarChart3 size={14}/> <span className="hidden sm:inline">Trades</span>
            </Link>
            <Link href="/markets" className="text-white/60 hover:text-white transition-colors font-mono text-[10px] sm:text-xs flex items-center gap-2 border-l border-white/10 pl-4 sm:pl-6">
              <Triangle className="rotate-180" size={14}/> <span className="hidden sm:inline">Markets</span>
            </Link>
          </div>
        </div>
        
        <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border transition-all ${isLiveMode ? 'bg-orange-500/10 border-orange-500/30' : 'bg-[var(--color-crypto-accent)]/10 border-[var(--color-crypto-accent)]/20'}`}>
          <div className="flex flex-col items-end">
             <span className={`text-[6px] font-bold uppercase tracking-widest ${isLiveMode ? 'text-orange-400' : 'text-[var(--color-crypto-accent)]'}`}>
               {isLiveMode ? 'Live' : 'Paper'}
             </span>
             <div className="font-mono font-bold text-[11px] sm:text-sm tracking-tight text-white whitespace-nowrap">
               <span className="hidden xs:inline">$</span>{totalUSDT.toLocaleString(undefined, { minimumFractionDigits: 2 })}
             </div>
          </div>
          <Wallet size={14} className={`${isLiveMode ? 'text-orange-400' : 'text-[var(--color-crypto-accent)]'} shrink-0`} />
        </div>
      </div>
    </nav>
  );
}
