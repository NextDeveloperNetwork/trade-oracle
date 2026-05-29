"use client";

import React from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { Wallet, XCircle, Power } from "lucide-react";

const getDecimals = (symbol: string) => {
  if (symbol === "XRP") return 5;
  if (symbol === "BTC" || symbol === "ETH") return 3;
  return 5;
};

export default function HoldingsTable() {
  const { balances, marketData, setConvertFromAsset, executeTrade, openPositions, removeCoin, botSettings } = useTradingEngine();
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const activeHoldings = Array.from(new Set([
    ...Object.keys(balances).filter(asset => balances[asset] > 0.00000001),
    ...openPositions.map(p => p.coin)
  ])).filter(asset => {
    // Ghost filter: don't show coins with no balance AND no recorded position
    if (asset === "USDT") return true;
    const balance = balances[asset] || 0;
    const hasPosition = openPositions.some(p => p.coin === asset);
    return balance > 0 || hasPosition;
  }).sort((a, b) => (a === "USDT" ? -1 : b === "USDT" ? 1 : 0));

  const calculateUSDTValue = (asset: string, amount: number) => {
    if (asset === "USDT") return amount;
    const price = marketData[asset]?.price || 0;
    return amount * price;
  };

  const handleClosePosition = async (e: React.MouseEvent, asset: string, usdtValue: number, coinAmount: number) => {
    e.stopPropagation();
    if (asset === "USDT") return;
    // Pass EXACT coin quantity to prevent price-drift rounding errors
    await executeTrade("SELL", asset, usdtValue);
  };

  const handleWipe = (e: React.MouseEvent, asset: string) => {
    e.stopPropagation();
    if (confirm(`Emergency wipe ${asset}? This clears all internal trade records for this coin.`)) {
      removeCoin(asset);
    }
  };

  if (!isMounted) return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] h-[480px] shrink-0 animate-pulse" />;

  return (
    <div className="glass-panel rounded-[2.5rem] h-[480px] flex flex-col overflow-hidden shadow-2xl group/table">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/[0.05] flex items-center justify-between shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
            <Wallet size={14} className="text-amber-400" />
          </div>
          <div>
            <div className="text-[11px] font-black text-white/40 uppercase tracking-widest leading-none">Market Positions</div>
            <div className="text-[9px] font-mono text-white/20 uppercase tracking-tighter mt-1">Live Telemetry Hub</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-6 w-px bg-white/5" />
          <div className="text-right">
            <div className="text-[8px] font-black text-white/20 uppercase">Total Assets</div>
            <div className="text-[12px] font-mono font-black text-white/60">{activeHoldings.length} NODES</div>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left font-mono border-collapse">
          <thead>
            <tr className="text-white/20 border-b border-white/[0.05] bg-white/[0.01] sticky top-0 z-10">
              <th className="pl-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-left">Asset</th>
              <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-left">Balance</th>
              <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-center">Entry V.</th>
              <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-center">Live V.</th>
              <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-center">Fee</th>
              <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-center">ROI %</th>
              <th className="px-4 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-right">P&L Value</th>
              <th className="pr-8 py-5 text-[9px] font-black uppercase tracking-[0.2em] text-right">Ops</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {activeHoldings.map((asset) => {
              const amount = balances[asset] || 0;
              const value = calculateUSDTValue(asset, amount);
              const positions = openPositions.filter(p => p.coin === asset);
              const totalInvested = positions.reduce((sum, p) => sum + p.invested, 0);
              
              // Use the LOCKED entry price directly from the position record
              // For multiple positions: volume-weighted average of entry prices
              const avgEntry = positions.length > 0 
                ? positions.reduce((sum, p) => sum + p.entryPrice * p.amount, 0) / positions.reduce((sum, p) => sum + p.amount, 0)
                : 0;
              
              const currentPrice = marketData[asset]?.price || 0;
              
              // Fee calculation based on config (feeRecovery is round-trip percentage)
              const feeRate = (botSettings.feeRecovery || 0.2) / 100;
              const legCount = positions.length || 1;
              
              // Total fee percentage = (Buy Legs * (feeRate/2)) + (1 Sell Leg * (feeRate/2))
              const combinedFeePercent = (legCount + 1) * (feeRate / 2) * 100;

              const pnlPct = (avgEntry > 0 && currentPrice > 0) ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;
              const netRoi = avgEntry > 0 ? pnlPct - ((value * (feeRate / 2)) / totalInvested * 100) : 0; 
              // Wait, the logic above is a bit complex. Let's simplify:
              // Net P&L = (CurrentValue - TotalInvested) - ExitFee
              // (Entry fees are already accounted for in CurrentValue because we have fewer coins)
              const estExitFee = value * (feeRate / 2);
              const estTotalFee = (totalInvested * (feeRate / 2)) + estExitFee;
              const netProfit = (value - totalInvested) - estExitFee;
              const finalRoi = totalInvested > 0 ? (netProfit / totalInvested) * 100 : 0;

              const isUp = netProfit > 0;
              const hasPosition = avgEntry > 0 && amount > 0;
              const isPriceLoading = asset !== "USDT" && currentPrice === 0;

              return (
                <tr 
                  key={asset}
                  className="group/row hover:bg-white/[0.02] transition-colors relative"
                >
                  {/* Asset */}
                  <td className="pl-8 py-5 cursor-pointer" onClick={() => setConvertFromAsset(asset)}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-500/5 border border-white/[0.05] flex items-center justify-center text-[14px] font-black text-indigo-400 group-hover/row:border-indigo-500/30 group-hover/row:scale-105 transition-all shrink-0">
                        {asset[0]}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[14px] font-black text-white tracking-tighter truncate leading-none uppercase">{asset}</span>
                        <span className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-1">Core Protocol</span>
                      </div>
                    </div>
                  </td>

                  {/* Balance */}
                  <td className="px-4 py-5">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-black text-white/90 font-mono tracking-tighter">
                        {amount < 0.001 ? amount.toFixed(8) : amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </span>
                      <span className="text-[10px] text-white/20 font-black tracking-widest uppercase mt-0.5">${value.toFixed(3)}</span>
                    </div>
                  </td>

                  {/* Entry Value */}
                  <td className="px-4 py-5 text-center">
                    {asset !== "USDT" && totalInvested > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[13px] font-black text-white/90 font-mono tracking-tighter">
                          @{avgEntry.toLocaleString('en-US', { minimumFractionDigits: getDecimals(asset) })}
                        </span>
                        <span className="text-[10px] text-white/30 uppercase font-black tracking-tighter">
                          ${totalInvested.toFixed(2)}
                        </span>
                      </div>
                    ) : <span className="text-white/5">—</span>}
                  </td>

                  {/* Live Value */}
                  <td className="px-4 py-5 text-center">
                    {asset !== "USDT" && currentPrice > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className={`text-[13px] font-black font-mono tracking-tighter ${currentPrice >= (marketData[asset]?.prevPrice || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                          @{currentPrice.toLocaleString('en-US', { minimumFractionDigits: getDecimals(asset) })}
                        </span>
                        <span className="text-[10px] text-white/30 uppercase font-black tracking-tighter">
                          ${value.toFixed(2)}
                        </span>
                      </div>
                    ) : <span className="text-white/5">—</span>}
                  </td>
                  
                  {/* Fee */}
                  <td className="px-4 py-5 text-center">
                    {asset !== "USDT" && currentPrice > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[13px] font-bold text-indigo-400/60 font-mono">
                          ${estTotalFee.toFixed(4)}
                        </span>
                        <span className="text-[7px] text-white/10 uppercase font-black tracking-tighter">Exchange Fee</span>
                      </div>
                    ) : <span className="text-white/5">—</span>}
                  </td>


                  {/* ROI % */}
                  <td className="px-4 py-5 text-center">
                    {asset !== "USDT" && (hasPosition || amount > 0) && currentPrice > 0 ? (
                      (() => {
                        const isPosUp = finalRoi >= 0;
                        return (
                          <div className={`inline-flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl border ${
                            isPosUp ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' : 'bg-red-500/5 text-red-400 border-red-500/20'
                          }`}>
                            <span className="text-[13px] font-black font-mono leading-none">{isPosUp ? '+' : ''}{finalRoi.toFixed(3)}%</span>
                            <span className="text-[7px] font-black uppercase opacity-40 tracking-tighter">NET ROI</span>
                          </div>
                        );
                      })()
                    ) : isPriceLoading ? (
                       <span className="text-white/10 animate-pulse text-[9px] uppercase font-black">Syncing</span>
                    ) : <span className="text-white/5">—</span>}
                  </td>

                  {/* Net P&L */}
                  <td className="px-4 py-5 text-right">
                    {asset !== "USDT" && (hasPosition || amount > 0) && currentPrice > 0 ? (
                      (() => {
                        const isNetUp = netProfit >= 0;
                        return (
                          <div className={`flex flex-col items-end ${isNetUp ? 'text-emerald-400' : 'text-red-400'}`}>
                            <div className="font-black text-[14px] tracking-tighter font-mono">
                              {isNetUp ? '+' : ''}${netProfit.toFixed(3)}
                            </div>
                            <div className="text-[8px] font-black opacity-20 uppercase tracking-widest mt-0.5">P&L VALUE</div>
                          </div>
                        );
                      })()
                    ) : <span className="text-white/5">—</span>}
                  </td>

                  {/* Actions */}
                  <td className="pr-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                      {asset !== "USDT" && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleClosePosition(e, asset, value, amount); }}
                            className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-black transition-all"
                            title="Exit Position"
                          >
                            <Power size={12} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleWipe(e, asset); }}
                            className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-white/20 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                            title="Emergency Wipe"
                          >
                            <XCircle size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {activeHoldings.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2">
            <Wallet size={24} />
            <span className="text-[10px] font-bold uppercase tracking-widest">No Active Positions</span>
          </div>
        )}
      </div>
    </div>
  );
}
