import type { BotStrategy } from "@/context/TradingContext";

export const STRATEGY_INFO: Partial<Record<BotStrategy, { name: string; desc: string; extendedDesc: string; color: string; risk: string }>> = {
  ORACLE_ELITE: { 
    name: "Oracle Elite",      
    desc: "Hold until Profit + Fee Recovery",         
    extendedDesc: "Precision-engineered for maximum ROI recovery. Executes trades based on volume-weighted entry points and holds positions until net profit exceeds exchange fees and resale margins. Includes hard stop-loss protection.",
    color: "text-[var(--color-crypto-green)]", 
    risk: "LOW" 
  },
  EMA_SCALPER: {
    name: "EMA Scalper",
    desc: "High-frequency EMA crossovers",
    extendedDesc: "Utilizes exponential moving averages to capture micro-trends in highly liquid markets. Best in low-latency environments.",
    color: "text-indigo-400",
    risk: "MEDIUM"
  },
  TREND_FOLLOWER: {
    name: "Trend Follower",
    desc: "Momentum tracking strategy",
    extendedDesc: "Analyzes macro-trends to ride sustained price movements. Uses ATR-based trailing stops to lock in gains.",
    color: "text-blue-400",
    risk: "MEDIUM"
  }
};
