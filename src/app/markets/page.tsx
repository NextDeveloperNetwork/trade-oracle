"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Trash2, TrendingUp, Info, Activity, Star, Sparkles, Zap } from "lucide-react";
import { useTradingEngine } from "@/context/TradingContext";
import { motion, AnimatePresence } from "framer-motion";

type MarketData = {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: string;
  gain: string;
  volume: string;
  high: string;
  low: string;
};

export default function MarketsPage() {
  const { activeCoins, addCoin, removeCoin, balances, marketData, currentStrategy } = useTradingEngine();
  const [allCoins, setAllCoins] = useState<MarketData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"all" | "gainers" | "promising" | "volatile" | "bot">("all");
  const [selectedBotFilter, setSelectedBotFilter] = useState<string>("SCALPER");

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/binance?type=exchangeInfo");
        const data = await res.json();
        setAllCoins(data);
      } catch (e) {
        console.error("Failed to fetch markets", e);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    let list = [...allCoins];

    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(c => c.baseAsset.toLowerCase().includes(s) || c.symbol.toLowerCase().includes(s));
    }

    if (filterMode === "gainers") {
      list = list.sort((a, b) => parseFloat(b.gain) - parseFloat(a.gain));
    } else if (filterMode === "promising") {
      list = list.filter(c => {
        const gain = parseFloat(c.gain);
        const vol = parseFloat(c.volume);
        return gain > 2 && gain < 12 && vol > 5000000;
      }).sort((a, b) => parseFloat(b.volume) - parseFloat(a.volume));
    } else if (filterMode === "volatile") {
      list = list.sort((a, b) => {
        const spreadA = (parseFloat(a.high) - parseFloat(a.low)) / parseFloat(a.low);
        const spreadB = (parseFloat(b.high) - parseFloat(b.low)) / parseFloat(b.low);
        return spreadB - spreadA;
      });
    } else if (filterMode === "bot") {
      // In a real live app, we'd need history for every single coin to process signals. 
      // Since we don't have socket streams for all 200+ coins, we simulate bot preference 
      // by mapping the strategy's logic conceptually to market stats.
      list = list.filter(c => {
        const gain = parseFloat(c.gain);
        const spread = (parseFloat(c.high) - parseFloat(c.low)) / parseFloat(c.low);
        const price = parseFloat(c.price);
        const high = parseFloat(c.high);
        const low = parseFloat(c.low);
        
        switch (selectedBotFilter) {
          case "SCALPER": return spread > 0.05 && gain > 0; // Needs volatility and uptrend
          case "TREND": return gain > 5; // Strong sustained trend
          case "REVERSION": return gain < -5; // Looking for mean reversion on drops
          case "BREAKOUT": return price > high * 0.98; // Nearing 24h high breakout
          case "MOMENTUM": return gain > 8 && spread > 0.08; // High momentum
          case "VWAP": return spread < 0.03; // Low volatility for VWAP
          case "AGGRESSIVE": return spread > 0.1 && parseFloat(c.volume) > 10000000; // Hyper volatile + liquid
          case "SWING": return gain > -2 && gain < 2; // Sideways consolidation
          case "HYPER": return spread > 0.15; // Maximum spread
          case "SNIPER": return price < low * 1.02; // Near 24h low for sniper bounce
          default: return true;
        }
      });
    }

    return list.slice(0, 80);
  }, [allCoins, searchTerm, filterMode, selectedBotFilter]);

  const STRATEGY_INFO: Record<string, { name: string, desc: string, color: string, risk: string }> = {
    SCALPER:    { name: "EMA Scalper",      desc: "5/30 EMA crossover",         color: "text-[var(--color-crypto-green)]", risk: "LOW" },
    TREND:      { name: "Trend Follower",   desc: "10-tick momentum tracking",   color: "text-blue-400",                   risk: "LOW" },
    REVERSION:  { name: "Mean Reversion",   desc: "Sell highs, buy dips",        color: "text-orange-400",                 risk: "MED" },
    BREAKOUT:   { name: "Breakout Hunter",  desc: "20-period high/low breaks",   color: "text-yellow-400",                 risk: "MED" },
    MOMENTUM:   { name: "RSI Momentum",     desc: "Oversold/overbought RSI",     color: "text-cyan-400",                   risk: "MED" },
    VWAP:       { name: "VWAP Trader",      desc: "Price vs 50-tick VWAP",       color: "text-purple-400",                 risk: "LOW" },
    AGGRESSIVE: { name: "Aggressive Bot",   desc: "3/20 EMA + RSI combo",        color: "text-pink-400",                   risk: "HIGH" },
    SWING:      { name: "Swing Trader",     desc: "12/50 EMA + Bollinger",       color: "text-amber-400",                  risk: "MED" },
    HYPER:      { name: "Hyper Scalper",    desc: "2/8-tick HF momentum",        color: "text-red-400",                    risk: "HIGH" },
    SNIPER:     { name: "Sniper Bot",       desc: "Bollinger extreme sniper",    color: "text-rose-400",                   risk: "HIGH" },
  };

  return (
    <div className="max-w-7xl mx-auto py-12 px-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-8 mb-12">
        <div>
          <h1 className="text-4xl font-black font-mono tracking-tighter text-white mb-2 uppercase italic flex items-center gap-3">
            <Sparkles className="text-[var(--color-crypto-accent)]" /> Market Explorer
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button 
              onClick={() => setFilterMode("all")}
              className={`px-4 py-2 rounded-xl font-mono text-[9px] tracking-widest uppercase border transition-all ${filterMode === 'all' ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-white/40 hover:text-white'}`}
            >
              All Assets
            </button>
            <button 
              onClick={() => setFilterMode("gainers")}
              className={`px-4 py-2 rounded-xl font-mono text-[9px] tracking-widest uppercase border transition-all ${filterMode === 'gainers' ? 'bg-[var(--color-crypto-green)]/10 border-[var(--color-crypto-green)]/30 text-[var(--color-crypto-green)] glow-text-green' : 'border-transparent text-white/40 hover:text-white'}`}
            >
              Top Gainers
            </button>
            <button 
              onClick={() => setFilterMode("volatile")}
              className={`px-4 py-2 rounded-xl font-mono text-[9px] tracking-widest uppercase border transition-all ${filterMode === 'volatile' ? 'bg-orange-500/10 border-orange-500/30 text-orange-400' : 'border-transparent text-white/40 hover:text-white'}`}
            >
              Most Volatile
            </button>
            <button 
              onClick={() => setFilterMode("promising")}
              className={`px-4 py-2 rounded-xl font-mono text-[9px] tracking-widest uppercase border transition-all ${filterMode === 'promising' ? 'bg-violet-500/10 border-violet-500/30 text-violet-400' : 'border-transparent text-white/40 hover:text-white'}`}
            >
              Discovery
            </button>
            
            <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block"></div>

            <button 
              onClick={() => setFilterMode("bot")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-[9px] tracking-widest uppercase border transition-all ${filterMode === 'bot' ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400' : 'border-white/10 text-white/40 hover:text-white hover:border-white/30'}`}
            >
              <Zap size={12} className={filterMode === 'bot' ? 'fill-cyan-400' : ''} />
              AI Bot Matches
            </button>
          </div>
        </div>
        
        <div className="flex flex-col gap-3 w-full xl:w-96">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
            <input 
              type="text" 
              placeholder="Search assets..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 font-mono text-sm focus:outline-none focus:border-[var(--color-crypto-accent)] transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {filterMode === 'bot' && (
            <div className="flex items-center gap-3 bg-cyan-950/30 border border-cyan-500/20 p-3 rounded-xl animate-in fade-in slide-in-from-top-2 group">
              <span className="text-[9px] font-mono text-cyan-400/60 uppercase tracking-widest whitespace-nowrap">Targeting Bot:</span>
              <select 
                value={selectedBotFilter} 
                onChange={(e) => setSelectedBotFilter(e.target.value)}
                className="bg-transparent text-[10px] font-mono font-bold text-cyan-300 outline-none cursor-pointer appearance-none flex-1 hover:text-cyan-200"
              >
                {Object.keys(STRATEGY_INFO).map(s => (
                  <option key={s} value={s} className="bg-neutral-900 text-white">
                    {STRATEGY_INFO[s].name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
        <div className="xl:col-span-3">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 sticky top-24">
            <h2 className="text-[10px] font-mono text-[var(--color-crypto-muted)] uppercase tracking-widest mb-6 flex items-center gap-2">
              <Star size={12} className="text-yellow-500" /> Watchlist
            </h2>
            <div className="space-y-2">
              {activeCoins.map(coin => {
                const balance = balances[coin] || 0;
                const hasBalance = balance > 0;
                const price = marketData[coin]?.price || 0;
                const usdValue = balance * price;
                
                return (
                  <div key={coin} className="flex flex-col p-3 bg-white/5 rounded-xl border border-white/5 group gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold">{coin}</span>
                      <button 
                        onClick={() => !hasBalance && removeCoin(coin)} 
                        disabled={hasBalance}
                        className={`p-1 transition-all ${hasBalance ? 'text-white/10 cursor-not-allowed' : 'opacity-0 group-hover:opacity-100 text-white/20 hover:text-[var(--color-crypto-red)]'}`}
                        title={hasBalance ? "Cannot remove asset with active balance" : "Remove from watchlist"}
                      >
                        {hasBalance ? <Activity size={12} className="animate-pulse" /> : <Trash2 size={12} />}
                      </button>
                    </div>
                    {hasBalance && (
                      <div className="flex items-center justify-between border-t border-white/5 pt-2">
                        <span className="text-[8px] text-white/30 uppercase font-mono">Holding:</span>
                        <span className="text-[9px] font-mono font-black text-[var(--color-crypto-green)]">
                          ${usdValue.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {activeCoins.length === 0 && <div className="text-[9px] font-mono text-white/10 text-center py-8">Empty</div>}
            </div>
          </div>
        </div>

        <div className="xl:col-span-9">
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
            {loading ? (
              Array(12).fill(0).map((_, i) => <div key={i} className="h-28 bg-white/5 rounded-3xl animate-pulse" />)
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((market) => (
                  <motion.div 
                    layout
                    key={market.symbol}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel p-6 rounded-3xl border border-white/5 flex flex-col justify-between group hover:bg-white/[0.04] hover:border-white/20 transition-all cursor-default"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center font-black text-xs border border-white/5 group-hover:border-[var(--color-crypto-accent)]/30 transition-colors">
                          {market.baseAsset[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white tracking-tight">{market.baseAsset}</span>
                          <span className="text-[9px] text-white/20 font-mono uppercase tracking-widest">{market.symbol}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black font-mono text-white">${parseFloat(market.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>
                        <div className="text-[9px] font-mono text-white/30 uppercase mt-1">
                          Range: <span className="text-white/60">{( (parseFloat(market.high)-parseFloat(market.low))/parseFloat(market.low)*100 ).toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div className="flex flex-col">
                        <div className={`text-[11px] font-black font-mono ${parseFloat(market.gain) >= 0 ? 'text-[var(--color-crypto-green)] glow-text-green' : 'text-[var(--color-crypto-red)]'}`}>
                          {parseFloat(market.gain) >= 0 ? '+' : ''}{parseFloat(market.gain).toFixed(2)}%
                        </div>
                        <div className="text-[8px] font-mono text-white/20 uppercase tracking-widest mt-1">
                          Vol: <span className="text-white/40">${(parseFloat(market.volume) / 1000000).toFixed(1)}M</span>
                        </div>
                      </div>
                      
                      {!activeCoins.includes(market.baseAsset) ? (
                        <button 
                          onClick={() => addCoin(market.baseAsset)}
                          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-[var(--color-crypto-accent)] hover:text-black text-[9px] font-black font-mono uppercase transition-all tracking-tighter"
                        >
                          Add Asset
                        </button>
                      ) : (
                        <div className="px-4 py-2 rounded-xl bg-[var(--color-crypto-accent)]/10 text-[var(--color-crypto-accent)] text-[9px] font-black font-mono uppercase border border-[var(--color-crypto-accent)]/20">
                          Pinned
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
