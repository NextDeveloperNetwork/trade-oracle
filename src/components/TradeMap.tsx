"use client";

import React from "react";
import { motion } from "framer-motion";
import { useTradingEngine } from "@/context/TradingContext";

export default function TradeMap() {
  const { marketData, balances, activeCoins } = useTradingEngine();

  const getSignalColor = (coin: string) => {
    const signal = marketData[coin]?.signal;
    if (signal === "BUY") return "var(--color-crypto-green)";
    if (signal === "SELL") return "var(--color-crypto-red)";
    return "var(--color-crypto-muted)";
  };

  const coinsToDisplay = activeCoins.length > 0 ? activeCoins : ["BTC", "ETH", "XRP"];

  return (
    <div className="glass-panel p-8 rounded-3xl border border-[var(--color-crypto-border)] min-h-[400px] relative overflow-hidden">
      <div className="text-[10px] font-mono text-[var(--color-crypto-muted)] uppercase tracking-[0.3em] mb-8">System Connectivity Map</div>
      
      <div className="relative h-[300px] flex items-center justify-center">
        {/* Central Hub (USDT) */}
        <motion.div 
          animate={{ boxShadow: ["0 0 20px rgba(51,136,255,0.1)", "0 0 40px rgba(51,136,255,0.3)", "0 0 20px rgba(51,136,255,0.1)"] }}
          transition={{ duration: 4, repeat: Infinity }}
          className="w-24 h-24 rounded-full bg-[var(--color-crypto-accent)]/10 border-2 border-[var(--color-crypto-accent)] flex flex-col items-center justify-center z-10"
        >
          <span className="text-xs font-black tracking-widest text-[var(--color-crypto-accent)]">USDT</span>
          <span className="text-[10px] font-mono opacity-60">${(balances.USDT || 0).toFixed(0)}</span>
        </motion.div>

        {/* Orbiting Coins */}
        {coinsToDisplay.map((coin, idx) => {
          const angle = (idx * (360 / coinsToDisplay.length)) * (Math.PI / 180);
          const radius = 120;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          const signal = marketData[coin]?.signal || "HOLD";
          const color = getSignalColor(coin);

          return (
            <React.Fragment key={coin}>
              {/* Path Line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                <motion.line 
                  x1="50%" y1="50%" 
                  x2={`calc(50% + ${x}px)`} y2={`calc(50% + ${y}px)`}
                  stroke={color}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  initial={{ opacity: 0.2 }}
                  animate={{ 
                    opacity: signal !== "HOLD" ? 0.8 : 0.2,
                    strokeDashoffset: signal === "BUY" ? [0, -20] : signal === "SELL" ? [0, 20] : 0
                  }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
              </svg>

              {/* Coin Node */}
              <motion.div 
                style={{ 
                  left: `calc(50% + ${x}px - 32px)`,
                  top: `calc(50% + ${y}px - 32px)`
                }}
                animate={{ 
                  borderColor: color,
                  boxShadow: signal !== "HOLD" ? `0 0 20px ${color}44` : 'none',
                  scale: signal !== "HOLD" ? 1.1 : 1
                }}
                className="absolute w-16 h-16 rounded-2xl bg-black/40 border border-white/10 flex flex-col items-center justify-center transition-colors backdrop-blur-md"
              >
                <span className="text-[10px] font-bold tracking-tight">{coin}</span>
                <span className={`text-[8px] font-mono mt-1 ${signal === 'BUY' ? 'text-[var(--color-crypto-green)]' : signal === 'SELL' ? 'text-[var(--color-crypto-red)]' : 'text-gray-500'}`}>
                  {signal}
                </span>
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-crypto-green)]" />
          <span className="text-[8px] font-mono uppercase text-[var(--color-crypto-muted)] tracking-wider">Inflow Signal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[var(--color-crypto-red)]" />
          <span className="text-[8px] font-mono uppercase text-[var(--color-crypto-muted)] tracking-wider">Outflow Signal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <span className="text-[8px] font-mono uppercase text-[var(--color-crypto-muted)] tracking-wider">Neutral State</span>
        </div>
      </div>
    </div>
  );
}
