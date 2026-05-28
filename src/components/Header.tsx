"use client";

import { useState, useEffect } from "react";
import { useTradingEngine } from "@/context/TradingContext";
import Link from "next/link";
import { Zap, Triangle, Wallet, BarChart3 } from "lucide-react";

export default function Header() {
  const { totalUSDT, isLiveMode } = useTradingEngine();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <nav className="border-b border-[var(--color-crypto-border)] bg-[var(--color-crypto-bg)] fixed w-full top-0 z-50 safe-top h-16" />
    );
  }

  return (
    <nav className="border-b border-white/[0.06] bg-[#0a0f1d]/80 backdrop-blur-2xl fixed w-full top-0 z-50 safe-top shadow-2xl">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex gap-8 items-center">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center p-0.5 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
               <div className="w-full h-full bg-[#0a0f1d] rounded-[9px] flex items-center justify-center">
                 <Zap size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
               </div>
            </div>
            <div className="flex flex-col">
              <span className="text-[15px] font-black tracking-[0.3em] text-white leading-none">ORACLE</span>
              <span className="text-[8px] font-mono font-black text-indigo-400/50 uppercase tracking-widest mt-1">Neural AI Trading</span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/5" />

          <div className="flex items-center gap-8">
            <Link href="/" className="group flex flex-col pt-1">
              <span className="text-[11px] font-black text-white group-hover:text-indigo-400 transition-colors tracking-widest uppercase">Overview</span>
              <div className="h-0.5 w-full bg-indigo-500 mt-1 opacity-100" />
            </Link>
            <Link href="/trades" className="group flex flex-col pt-1">
              <span className="text-[11px] font-black text-white/30 group-hover:text-white transition-colors tracking-widest uppercase">History</span>
              <div className="h-0.5 w-full bg-indigo-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
            <Link href="/markets" className="group flex flex-col pt-1">
              <span className="text-[11px] font-black text-white/30 group-hover:text-white transition-colors tracking-widest uppercase">Ecosystem</span>
              <div className="h-0.5 w-full bg-indigo-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-10">
          {/* Market Pulse Visualization */}
          <div className="hidden lg:flex items-center gap-4">
             <div className="flex flex-col items-end">
               <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Network Pulse</span>
               <div className="flex items-center gap-0.5 mt-1 h-3">
                 {[40, 70, 45, 90, 65, 30, 80].map((h, i) => (
                   <div key={i} className="w-0.5 bg-indigo-500/40 rounded-full animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }} />
                 ))}
               </div>
             </div>
             <div className="h-8 w-px bg-white/5" />
             <div className="flex flex-col items-end">
               <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Integrity</span>
               <span className="text-[10px] font-mono font-black text-emerald-400/70 mt-1">99.98% SEALED</span>
             </div>
          </div>
          
          <div className={`group flex items-center gap-4 px-5 py-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-all cursor-pointer ${isLiveMode ? 'border-orange-500/20' : ''}`}>
            <div className="flex flex-col items-end">
               <span className={`text-[8px] font-black uppercase tracking-widest ${isLiveMode ? 'text-orange-400' : 'text-indigo-400'}`}>
                 {isLiveMode ? 'Live Production' : 'Staging Environment'}
               </span>
               <div className="font-mono font-black text-lg tracking-tighter text-white">
                 <span className="opacity-20 mr-1">$</span>{totalUSDT.toLocaleString('en-US', { minimumFractionDigits: 2 })}
               </div>
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLiveMode ? 'bg-orange-500/10 text-orange-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
              <Wallet size={18} />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
