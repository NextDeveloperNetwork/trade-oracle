"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTradingEngine } from "@/context/TradingContext";
import { Crosshair, Shield, Activity, Share2 } from "lucide-react";

export default function TradeMap() {
  const { marketData, balances, activeCoins } = useTradingEngine();
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const coinsToDisplay = activeCoins.length > 0 ? activeCoins : ["BTC", "ETH", "XRP"];

  if (!isMounted) return <div className="rounded-3xl border border-white/[0.1] bg-[#0f172a]/80 backdrop-blur-3xl h-full relative overflow-hidden animate-pulse" />;

  return (
    <div className="rounded-3xl border border-white/[0.1] bg-[#0f172a]/80 backdrop-blur-3xl h-full relative overflow-hidden flex flex-col group">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes radar-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-radar {
          animation: radar-sweep 8s linear infinite;
        }
      ` }} />
      {/* Background Radar Rings */}
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
        <div className="w-[100px] h-[100px] border border-white rounded-full" />
        <div className="w-[200px] h-[200px] border border-white rounded-full absolute" />
        <div className="w-[300px] h-[300px] border border-white rounded-full absolute" />
        <div className="w-[400px] h-[400px] border border-white rounded-full absolute" />
      </div>

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between shrink-0 z-40 bg-[#1e293b]/30">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Share2 size={16} className="text-blue-400" />
          </div>
          <div>
            <span className="text-[12px] font-black text-white tracking-widest uppercase block">Connectivity Radar</span>
            <span className="text-[9px] font-mono text-blue-400/50 uppercase font-black uppercase tracking-widest">Scanning Active Nodes…</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping shadow-[0_0_10px_#10b981]" />
          <span className="text-[10px] font-mono font-black text-emerald-400/70 uppercase">Live Feed</span>
        </div>
      </div>

      {/* Main Radar Area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_70%)]">
        
        {/* Sweeping Radar Beam */}
        <div 
          className="absolute w-1/2 h-1/2 origin-top-left z-10 animate-radar"
          style={{ 
            top: '50%', left: '50%',
            background: 'conic-gradient(from 0deg, rgba(59,130,246,0.15) 0deg, transparent 40deg)',
          }}
        />

        {/* Central Intelligence Core */}
        <div className="relative z-30">
          <motion.div 
            animate={{ 
              scale: [1, 1.05, 1],
              boxShadow: ["0 0 20px rgba(59,130,246,0.1)", "0 0 60px rgba(59,130,246,0.3)", "0 0 20px rgba(59,130,246,0.1)"]
            }}
            transition={{ duration: 3, repeat: Infinity }}
            className="w-32 h-32 rounded-full bg-[#1e293b] border-2 border-blue-500/30 flex flex-col items-center justify-center shadow-2xl"
          >
            <div className="absolute inset-0 rounded-full border-4 border-blue-400/5 animate-[ping_4s_infinite] opacity-30" />
            <Crosshair size={24} className="text-blue-400/40 mb-1" />
            <span className="text-[13px] font-black tracking-widest text-white leading-none">USDT</span>
            <span className="text-[11px] font-mono font-bold text-blue-300/40 mt-1">${isMounted ? (balances.USDT || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0'}</span>
          </motion.div>
        </div>

        {/* Orbiting Satellite Nodes */}
        {coinsToDisplay.map((coin: string, idx: number) => {
          const angle = (idx * (360 / coinsToDisplay.length)) * (Math.PI / 180);
          const radius = 240; // Increased radius
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          const md = marketData[coin];
          const signal = md?.signal || 'HOLD';
          const isAction = signal === 'BUY' || signal === 'SELL';
          
          return (
            <React.Fragment key={coin}>
              {/* Radial Line Path */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" viewBox="-300 -300 600 600">
                <motion.line 
                  x1="0" y1="0" x2={x} y2={y}
                  stroke={isAction ? (signal === 'BUY' ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.08)'}
                  strokeWidth="0.5"
                  initial={{ opacity: 0.1 }}
                  animate={{ opacity: isAction ? 0.6 : 0.1 }}
                />
                <motion.circle 
                  cx={x} cy={y} r="2"
                  fill="rgba(59,130,246,0.2)"
                  animate={{ opacity: [0.1, 0.4, 0.1], scale: [1, 1.5, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: idx * 0.2 }}
                />
              </svg>

              {/* Node Card */}
              <motion.div 
                style={{ left: `calc(50% + ${x}px - 32px)`, top: `calc(50% + ${y}px - 32px)` }}
                className={`absolute w-16 h-16 rounded-2xl bg-[#1e293b]/90 border backdrop-blur-xl flex flex-col items-center justify-center z-40 transition-all duration-700 ${
                  signal === 'BUY' ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]" :
                  signal === 'SELL' ? "border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]" :
                  "border-white/10 group-hover:border-white/20"
                }`}
              >
                <span className="text-[12px] font-black text-white/90">{coin}</span>
                {md?.price && (
                  <span className={`text-[9px] font-mono font-bold ${signal === 'BUY' ? 'text-emerald-400' : signal === 'SELL' ? 'text-red-400' : 'text-white/30'}`}>
                    ${md.price.toFixed(md.price < 1 ? 4 : 2)}
                  </span>
                )}
                {isAction && (
                  <div className={`mt-0.5 text-[8px] font-black px-1.5 rounded-sm ${signal === 'BUY' ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
                    {signal}
                  </div>
                )}
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Footer System Status */}
      <div className="px-6 py-3 border-t border-white/[0.05] flex items-center justify-between bg-[#1e293b]/50 z-40">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest leading-none">Positive Signal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[9px] font-mono font-black text-white/40 uppercase tracking-widest leading-none">Negative Signal</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Activity size={10} className="text-blue-400 animate-pulse" />
          <span className="text-[10px] font-mono font-black text-blue-400/60 uppercase tracking-tighter">Syncing Neural-Market-Data [7.4ms]</span>
        </div>
      </div>
    </div>
  );
}
