import type { BotStrategy } from "@/context/TradingContext";

export const STRATEGY_INFO: Record<BotStrategy, { name: string; desc: string; extendedDesc: string; color: string; risk: string }> = {
  SCALPER:    { 
    name: "EMA Scalper",      
    desc: "5/30 EMA crossover",         
    extendedDesc: "High-frequency scalping based on fast (5) and slow (30) EMA crossovers. Executes rapid entries and exits when short-term momentum shifts.",
    color: "text-[var(--color-crypto-green)]", 
    risk: "LOW" 
  },
  TREND:      { 
    name: "Trend Follower",   
    desc: "10-tick momentum tracking",   
    extendedDesc: "Identifies and follows market trends using 10-period momentum indicators combined with ATR (Average True Range) volatility filters.",
    color: "text-blue-400",                   
    risk: "LOW" 
  },
  REVERSION:  { 
    name: "Mean Reversion",   
    desc: "Sell highs, buy dips",        
    extendedDesc: "Bets on the price returning to its 50-period moving average. Buys when significantly below the mean and sells when overextended above.",
    color: "text-orange-400",                 
    risk: "MED" 
  },
  BREAKOUT:   { 
    name: "Breakout Hunter",  
    desc: "20-period high/low breaks",   
    extendedDesc: "Monitors 20-period price channels and executes trades when the price breaks above resistance or below support with volume confirmation.",
    color: "text-yellow-400",                 
    risk: "MED" 
  },
  MOMENTUM:   { 
    name: "RSI Momentum",     
    desc: "Oversold/overbought RSI",     
    extendedDesc: "Uses Relative Strength Index (RSI) to find overextended market conditions. Reverses positions at traditional 30/70 extremes.",
    color: "text-cyan-400",                   
    risk: "MED" 
  },
  VWAP:       { 
    name: "VWAP Trader",      
    desc: "Price vs 50-tick VWAP",       
    extendedDesc: "Utilizes Volume Weighted Average Price (VWAP) as a benchmark. Analyzes the current price relative to volume-weighted institutional averages.",
    color: "text-purple-400",                 
    risk: "LOW" 
  },
  AGGRESSIVE: { 
    name: "Aggressive Bot",   
    desc: "3/20 EMA + RSI combo",        
    extendedDesc: "A high-risk strategy combining very fast 3-period EMAs with 15-period RSI filters for rapid, aggressive entries in volatile markets.",
    color: "text-pink-400",                   
    risk: "HIGH" 
  },
  SWING:      { 
    name: "Swing Trader",     
    desc: "12/50 EMA + Bollinger",       
    extendedDesc: "Medium-term swing trading using 12/50 EMA crosses confirmed by Bollinger Band breakouts to capture larger market movements.",
    color: "text-amber-400",                  
    risk: "MED" 
  },
  HYPER:      { 
    name: "Hyper Scalper",    
    desc: "2/8-tick HF momentum",        
    extendedDesc: "Ultra-fast micro-scalping focusing on 2-tick versus 8-tick momentum. Designed for high volume assets with tight spreads.",
    color: "text-red-400",                    
    risk: "HIGH" 
  },
  SNIPER:     { 
    name: "Sniper Bot",       
    desc: "Bollinger extreme sniper",    
    extendedDesc: "Wait-and-strike approach using 2.5 standard deviation Bollinger Band extremes and RSI 20/80 levels for high-probability reversals.",
    color: "text-rose-400",                   
    risk: "HIGH" 
  },
};
