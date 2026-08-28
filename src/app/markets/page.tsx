"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Trash2, TrendingUp, Info, Activity, Star, Sparkles, Zap, ChevronRight } from "lucide-react";
import { useTradingEngine } from "@/context/TradingContext";
import { STRATEGY_INFO } from "@/lib/strategies";
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
  type FilterMode = "all" | "gainers" | "promising" | "volatile";
  const [filterMode, setFilterMode] = useState<FilterMode>("all");

  const ORACLE_AUTH_TOKEN = "oracle_default_secret_9988";

  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("/api/binance?type=exchangeInfo", {
          headers: { "x-oracle-token": ORACLE_AUTH_TOKEN }
        });
        const data = await res.json();
        setAllCoins(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Failed to fetch markets", e);
        setAllCoins([]);
      } finally {
        setLoading(false);
      }
    }
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    let list = Array.isArray(allCoins) ? [...allCoins] : [];

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
    }

    return list.slice(0, 100);
  }, [allCoins, searchTerm, filterMode]);



  return (
    <div className="max-w-7xl mx-auto py-6 sm:py-12 px-4 sm:px-6 mb-20 sm:mb-0">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6 sm:gap-8 mb-8 sm:mb-12">
        <div className="w-full">
          <h1 className="text-2xl sm:text-4xl font-black font-mono tracking-tighter text-white mb-2 uppercase italic flex items-center gap-3">
            <Sparkles className="text-[var(--color-crypto-accent)]" size={24} /> Explorer
          </h1>
          
          <div className="flex overflow-x-auto no-scrollbar items-center gap-2 mt-4 pb-2">
            {[
              { id: 'all', label: 'All', icon: null },
              { id: 'gainers', label: 'Top', icon: <TrendingUp size={10} /> },
              { id: 'volatile', label: 'Vol', icon: <Activity size={10} /> },
              { id: 'promising', label: 'New', icon: <Sparkles size={10} /> },
            ].map(f => (
              <button 
                key={f.id}
                onClick={() => setFilterMode(f.id as FilterMode)}
                className={`px-4 py-2 rounded-xl font-mono text-[9px] tracking-widest uppercase border transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  filterMode === f.id 
                    ? 'bg-white/10 border-white/20 text-white' 
                    : 'border-transparent text-white/40'
                }`}
              >
                {f.icon} {f.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex flex-col gap-3 w-full xl:w-96">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            <input 
              type="text" 
              placeholder="Search pairs..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 font-mono text-xs focus:outline-none focus:border-[var(--color-crypto-accent)] transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Watchlist - Hidden or Moved on small mobile? Let's keep it but make it a grid above or below */}
        <div className="lg:col-span-3 order-2 lg:order-1">
          <div className="glass-panel p-5 rounded-3xl border border-white/5 lg:sticky lg:top-24 bg-white/[0.02]">
            <h2 className="text-[10px] font-mono text-[var(--color-crypto-muted)] uppercase tracking-[0.2em] mb-5 flex items-center gap-2">
              <Star size={12} className="text-yellow-500 fill-yellow-500" /> Watchlist
            </h2>
            <div className="space-y-2 max-h-[400px] lg:max-h-none overflow-y-auto no-scrollbar">
              {activeCoins.map((coin: string) => {
                const balance = balances[coin] || 0;
                const hasBalance = balance > 0;
                const price = marketData[coin]?.price || 0;
                const usdValue = balance * price;
                
                return (
                  <div key={coin} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group transition-all hover:bg-white/10">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-bold">{coin}</span>
                      {hasBalance && <span className="text-[8px] font-mono font-black text-[var(--color-crypto-green)] tracking-tighter">${usdValue.toFixed(3)}</span>}
                    </div>
                    <button 
                      onClick={() => !hasBalance && removeCoin(coin)} 
                      className={`p-2 rounded-lg transition-all ${hasBalance ? 'text-[var(--color-crypto-green)] cursor-default' : 'text-white/10 hover:text-[var(--color-crypto-red)] hover:bg-white/5'}`}
                      disabled={hasBalance}
                    >
                      {hasBalance ? <Activity size={12} className="animate-pulse" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                );
              })}
              {activeCoins.length === 0 && <div className="text-[9px] font-mono text-white/5 text-center py-10 italic">No assets pinned</div>}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 order-1 lg:order-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {loading ? (
              Array(9).fill(0).map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-3xl animate-pulse" />)
            ) : (
              <AnimatePresence mode="popLayout">
                {filtered.map((market) => (
                  <motion.div 
                    layout
                    key={market.symbol}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/5 flex flex-col group hover:border-white/20 transition-all bg-white/[0.01]"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center font-black text-[10px] border border-white/5 group-hover:border-[var(--color-crypto-accent)] transition-colors">
                          {market.baseAsset[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-white tracking-tight">{market.baseAsset}</span>
                          <span className="text-[8px] text-white/20 font-mono uppercase tracking-widest">{market.symbol}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-black font-mono text-white tracking-tighter">
                          ${parseFloat(market.price).toLocaleString(undefined, { 
                            minimumFractionDigits: 3, 
                            maximumFractionDigits: market.price.startsWith("0.00") ? 6 : 3 
                          })}
                        </div>
                        <div className={`text-[9px] font-bold font-mono mt-0.5 ${parseFloat(market.gain) >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
                          {parseFloat(market.gain) >= 0 ? '+' : ''}{parseFloat(market.gain).toFixed(3)}%
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <div className="flex flex-col">
                        <div className="text-[8px] font-mono text-white/20 uppercase tracking-widest">24h Vol</div>
                        <div className="text-[10px] font-mono font-bold text-white/60">${(parseFloat(market.volume) / 1000000).toFixed(1)}M</div>
                      </div>
                      
                      {!activeCoins.includes(market.baseAsset) ? (
                        <button 
                          onClick={() => addCoin(market.baseAsset)}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-[var(--color-crypto-accent)] hover:text-black text-[8px] font-black font-mono uppercase transition-all"
                        >
                          Watch
                        </button>
                      ) : (
                        <div className="px-3 py-1.5 rounded-lg bg-[var(--color-crypto-accent)]/10 text-[var(--color-crypto-accent)] text-[8px] font-black font-mono uppercase border border-[var(--color-crypto-accent)]/20">
                          Active
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {filtered.length === 0 && !loading && (
              <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 opacity-20">
                <Search size={40} />
                <span className="text-[10px] font-mono uppercase tracking-widest">No assets match your filters</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
