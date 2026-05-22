"use client";

import { useTradingEngine } from "@/context/TradingContext";
import Link from "next/link";
import { Zap, Triangle, Wallet, BarChart3 } from "lucide-react";

export default function Header() {
  const { totalUSDT } = useTradingEngine();

  return (
    <nav className="border-b border-[var(--color-crypto-border)] bg-[var(--color-crypto-bg)] fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex gap-6 items-center">
          <div className="text-[var(--color-crypto-accent)] font-bold font-mono tracking-widest text-lg border-r border-[var(--color-crypto-border)] pr-6 mr-2">
            ORACLE
          </div>
          <Link href="/" className="text-white transition-colors font-mono text-xs flex items-center gap-2">
            <Zap size={14}/> Dashboard
          </Link>
          <Link href="/trades" className="text-white/60 hover:text-white transition-colors font-mono text-xs flex items-center gap-2 border-l border-white/10 pl-6">
            <BarChart3 size={14}/> Trades
          </Link>
          <Link href="/markets" className="text-white/60 hover:text-white transition-colors font-mono text-xs flex items-center gap-2 border-l border-white/10 pl-6">
            Markets
          </Link>
        </div>
        
        <div className="flex items-center gap-3 bg-[var(--color-crypto-accent)]/10 px-4 py-2 rounded-xl border border-[var(--color-crypto-accent)]/20">
          <Wallet size={16} className="text-[var(--color-crypto-accent)]" />
          <div className="font-mono font-bold text-sm tracking-tight text-white">
            ${totalUSDT.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD
          </div>
        </div>
      </div>
    </nav>
  );
}
