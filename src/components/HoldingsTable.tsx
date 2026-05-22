"use client";

import React from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { Wallet, ArrowUpRight, ArrowDownRight, XCircle, Power } from "lucide-react";

export default function HoldingsTable() {
  const { balances, marketData, setConvertFromAsset, executeTrade } = useTradingEngine();

  // Assets with balance > 0
  const activeHoldings = Object.keys(balances)
    .filter(asset => balances[asset] > 0.00000001)
    .sort((a, b) => (a === "USDT" ? -1 : b === "USDT" ? 1 : 0));

  const calculateUSDTValue = (asset: string, amount: number) => {
    if (asset === "USDT") return amount;
    const price = marketData[asset]?.price || 0;
    return amount * price;
  };

  const handleClosePosition = async (e: React.MouseEvent, asset: string, value: number) => {
    e.stopPropagation(); // Don't trigger row click
    if (asset === "USDT") return;
    await executeTrade("SELL", asset, value);
  };

  // Fixed 10 lines logic
  const totalRows = 10;
  const paddingRows = Math.max(0, totalRows - activeHoldings.length);

  return (
    <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden flex flex-col h-[480px]">
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <h3 className="text-[10px] font-mono text-white/30 uppercase tracking-[0.3em] flex items-center gap-2">
          <Wallet size={12} className="text-[var(--color-crypto-accent)]" /> Active Holdings
        </h3>
        <div className="text-[8px] font-mono text-white/10 uppercase">HODL Dashboard</div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left font-mono text-[10px]">
          <thead className="sticky top-0 bg-black/90 backdrop-blur-md z-10">
            <tr className="text-white/20 uppercase tracking-widest border-b border-white/5">
              <th className="px-5 py-3 font-normal">Asset</th>
              <th className="px-5 py-3 font-normal">Balance</th>
              <th className="px-5 py-3 font-normal">USD Value</th>
              <th className="px-5 py-3 font-normal">24h</th>
              <th className="px-5 py-3 font-normal text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {activeHoldings.map((asset) => {
              const amount = balances[asset];
              const value = calculateUSDTValue(asset, amount);
              const gain = marketData[asset]?.gain;

              return (
                <tr 
                  key={asset} 
                  onClick={() => setConvertFromAsset(asset)}
                  className="hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors group h-[48px] cursor-pointer"
                >
                  <td className="px-5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center text-[9px] font-bold group-hover:border-[var(--color-crypto-accent)]/30 border border-transparent transition-all">
                        {asset[0]}
                      </div>
                      <span className="font-bold text-white/80">{asset}</span>
                    </div>
                  </td>
                  <td className="px-5 py-2 text-white/50">
                    {amount < 0.001 ? amount.toFixed(6) : amount.toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  </td>
                  <td className="px-5 py-2 font-bold text-white/90">
                    ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-2">
                    {asset === "USDT" ? (
                      <span className="text-white/5">—</span>
                    ) : gain !== undefined && gain !== null ? (
                      <div className={`font-bold ${gain >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
                        {gain >= 0 ? '+' : ''}{gain.toFixed(1)}%
                      </div>
                    ) : (
                      <span className="text-white/5">...</span>
                    )}
                  </td>
                  <td className="px-5 py-2 text-right">
                    {asset !== "USDT" && (
                      <button
                        onClick={(e) => handleClosePosition(e, asset, value)}
                        className="p-1 px-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500/60 hover:text-red-500 hover:bg-red-500/20 hover:border-red-500/40 transition-all flex items-center gap-1 ml-auto group/btn"
                      >
                        <span className="text-[8px] font-black uppercase tracking-tighter opacity-0 group-hover/btn:opacity-100 transition-opacity">Close</span>
                        <Power size={10} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            
            {/* Empty space padding */}
            {Array(paddingRows).fill(0).map((_, i) => (
              <tr key={`pad-${i}`} className="h-[48px] opacity-0 pointer-events-none">
                <td colSpan={5} className="px-5 py-2">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
