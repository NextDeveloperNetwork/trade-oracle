"use client";

import React from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { Wallet, ArrowUpRight, ArrowDownRight, XCircle, Power } from "lucide-react";

export default function HoldingsTable() {
  const { balances, marketData, setConvertFromAsset, executeTrade, openPositions } = useTradingEngine();

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
    <div className="glass-panel rounded-3xl border border-white/5 overflow-hidden flex flex-col h-[360px]">
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
              <th className="px-3 sm:px-4 py-3 font-normal">Asset</th>
              <th className="px-3 sm:px-4 py-3 font-normal">Balance</th>
              <th className="px-3 sm:px-4 py-3 font-normal">Entry</th>
              <th className="px-3 sm:px-4 py-3 font-normal">P&L</th>
              <th className="px-3 sm:px-4 py-3 font-normal text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.02]">
            {activeHoldings.map((asset) => {
              const amount = balances[asset];
              const value = calculateUSDTValue(asset, amount);
              const gain = marketData[asset]?.gain;

              // P&L logic
              const positions = openPositions.filter(p => p.coin === asset);
              const totalInvested = positions.reduce((sum, p) => sum + p.invested, 0);
              const totalAmount = positions.reduce((sum, p) => sum + p.amount, 0);
              const avgEntry = totalAmount > 0 ? totalInvested / totalAmount : 0;
              const currentPrice = marketData[asset]?.price || 0;
              const pnlPct = avgEntry > 0 ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;

              return (
                <tr 
                  key={asset} 
                  onClick={() => setConvertFromAsset(asset)}
                  className="hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors group h-[42px] cursor-pointer"
                >
                  <td className="px-3 sm:px-4 py-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded bg-white/5 hidden xs:flex items-center justify-center text-[8px] font-bold group-hover:border-[var(--color-crypto-accent)]/30 border border-transparent transition-all">
                        {asset[0]}
                      </div>
                      <span className="font-bold text-white/80">{asset}</span>
                    </div>
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-white/40">
                    {amount < 0.001 ? amount.toFixed(4) : amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-white/60">
                    {asset === "USDT" ? "—" : avgEntry > 0 ? `$${avgEntry.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  </td>
                  <td className="px-3 sm:px-4 py-2">
                    {asset === "USDT" ? (
                      <span className="text-white/20">$1.00</span>
                    ) : avgEntry > 0 ? (
                      <div className={`font-bold flex flex-col ${pnlPct >= 0 ? 'text-[var(--color-crypto-green)]' : 'text-[var(--color-crypto-red)]'}`}>
                        <span>{pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%</span>
                        <span className="text-[7px] opacity-40 font-normal tracking-tighter">${value.toFixed(2)}</span>
                      </div>
                    ) : (
                      <span className="text-white/5">—</span>
                    )}
                  </td>
                  <td className="px-3 sm:px-4 py-2 text-right">
                    {asset !== "USDT" && (
                      <button
                        onClick={(e) => handleClosePosition(e, asset, value)}
                        className="p-1 px-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500/60 hover:text-red-500 hover:bg-red-500/20 hover:border-red-500/40 transition-all ml-auto"
                      >
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
