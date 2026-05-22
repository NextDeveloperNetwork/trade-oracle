"use client";

import React from "react";
import { motion } from "framer-motion";
import { useTradingEngine } from "@/context/TradingContext";

export default function TradeMap() {
  const { marketData, balances, activeCoins } = useTradingEngine();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const getSignalColor = (coin: string) => {
    const signal = marketData[coin]?.signal;
    if (signal === "BUY") return "var(--color-crypto-green)";
    if (signal === "SELL") return "var(--color-crypto-red)";
    return "var(--color-crypto-muted)";
  };

  const coinsToDisplay = activeCoins.length > 0 ? activeCoins : ["BTC", "ETH", "XRP"];

  return (
    <div className="glass-panel p-4 sm:p-8 rounded-3xl border border-[var(--color-crypto-border)] min-h-[360px] sm:min-h-[400px] relative overflow-hidden">
      <div className="text-[8px] sm:text-[9px] font-mono text-[var(--color-crypto-muted)] uppercase tracking-[0.4em] mb-6 sm:mb-10 opacity-50">Neural Connectivity Network</div>
      
      <div className="relative h-[300px] flex items-center justify-center">
        {/* Central Hub (USDT) */}
        <motion.div 
          animate={{ 
            boxShadow: [
              "0 0 20px rgba(51,136,255,0.05)", 
              "0 0 50px rgba(51,136,255,0.2)", 
              "0 0 20px rgba(51,136,255,0.05)"
            ],
            scale: [1, 1.05, 1]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white/[0.02] border border-[var(--color-crypto-accent)]/30 flex flex-col items-center justify-center z-20 backdrop-blur-3xl"
        >
          <span className="text-[9px] sm:text-[10px] font-black tracking-[0.2em] text-[var(--color-crypto-accent)] opacity-80">USDT</span>
          <span className="text-[7px] sm:text-[8px] font-mono opacity-30 mt-0.5">${(balances.USDT || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </motion.div>

        {/* Orbiting Coins */}
        {coinsToDisplay.map((coin, idx) => {
          const angle = (idx * (360 / coinsToDisplay.length)) * (Math.PI / 180);
          // Responsive radius
          const radius = isMobile ? 85 : 120;
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
                  left: `calc(50% + ${x}px - ${isMobile ? '20px' : '24px'})`,
                  top: `calc(50% + ${y}px - ${isMobile ? '20px' : '24px'})`
                }}
                animate={{ 
                  borderColor: signal !== "HOLD" ? color : "rgba(255,255,255,0.1)",
                  boxShadow: signal !== "HOLD" ? `0 0 15px ${color}22` : '0 0 0px transparent',
                  background: signal !== "HOLD" ? `${color}11` : "rgba(255,255,255,0.02)",
                }}
                className={`absolute ${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl border flex flex-col items-center justify-center transition-all duration-500 backdrop-blur-xl z-20`}
              >
                <span className="text-[8px] font-black tracking-tight text-white/90">{coin}</span>
                {signal !== "HOLD" && (
                  <motion.span 
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`text-[6px] font-black mt-0.5 ${signal === 'BUY' ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}
                  >
                    {signal}
                  </motion.span>
                )}
              </motion.div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-3 mt-8">
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
