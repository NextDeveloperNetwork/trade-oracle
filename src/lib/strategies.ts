import type { BotStrategy } from "@/context/TradingContext";

export const STRATEGY_INFO: Record<BotStrategy, { name: string; desc: string; extendedDesc: string; color: string; risk: string }> = {
  ORACLE_ELITE: { 
    name: "Oracle Elite",      
    desc: "Hold until Profit + Fee Recovery",         
    extendedDesc: "Precision-engineered for maximum ROI recovery. Executes trades based on volume-weighted entry points and holds positions until net profit exceeds exchange fees and resale margins. Includes hard stop-loss protection.",
    color: "text-[var(--color-crypto-green)]", 
    risk: "LOW" 
  },
};
