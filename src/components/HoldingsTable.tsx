"use client";

import React from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { Wallet, XCircle, Power } from "lucide-react";

const getDecimals = (symbol: string) => {
  if (symbol === "XRP") return 4;
  if (symbol === "BTC" || symbol === "ETH") return 2;
  return 4;
};

export default function HoldingsTable() {
  const { balances, marketData, setConvertFromAsset, executeTrade, openPositions, removeCoin } = useTradingEngine();
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
    await executeTrade("SELL", asset, usdtValue, false, coinAmount);
  };

  const handleWipe = (e: React.MouseEvent, asset: string) => {
    e.stopPropagation();
    if (confirm(`Emergency wipe ${asset}? This clears all internal trade records for this coin.`)) {
      removeCoin(asset);
    }
  };

  if (!isMounted) return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] h-[480px] shrink-0 animate-pulse" />;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111827]/50 backdrop-blur-xl h-[480px] flex flex-col overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Wallet size={14} className="text-amber-400" />
          <span className="text-[11px] font-mono font-bold text-white/60 uppercase tracking-widest">Holdings</span>
        </div>
        <div className="text-[9px] font-mono font-black text-white/20 uppercase tracking-tighter">Total Assets: {activeHoldings.length}</div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left font-mono border-collapse">
          <thead>
            <tr className="text-white/30 border-b border-white/[0.06] bg-[#1f2937]/90 backdrop-blur-md sticky top-0 z-10">
              <th className="pl-6 py-4 text-[10px] font-black uppercase tracking-widest text-left w-[16%]">Asset</th>
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-left w-[12%]">Holdings</th>
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-center w-[10%]">Entry</th>
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-center w-[10%]">Live</th>
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-center w-[12%]">Exch Fee</th>
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-center w-[14%]">ROI %</th>
              <th className="px-3 py-4 text-[10px] font-black uppercase tracking-widest text-right w-[12%]">Net P&L</th>
              <th className="pr-6 py-4 text-[10px] font-black uppercase tracking-widest text-right w-[14%]">Op Hub</th>
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
              
              // Leg-aware fee calculation (0.1% per buy leg + 0.1% for estimated sell)
              const legCount = positions.length || 1;
              const roundTripFeePercent = (legCount + 1) * 0.1;

              const pnlPct = (avgEntry > 0 && currentPrice > 0) ? ((currentPrice - avgEntry) / avgEntry) * 100 : 0;
              const netRoi = avgEntry > 0 ? pnlPct - roundTripFeePercent : 0;
              const isUp = netRoi > 0;
              const hasPosition = avgEntry > 0 && amount > 0;
              const isPriceLoading = asset !== "USDT" && currentPrice === 0;

              return (
                <tr 
                  key={asset}
                  className="group hover:bg-white/[0.04] border-b border-white/[0.02] last:border-0 transition-colors"
                >
                  {/* Asset */}
                  <td className="pl-6 py-4 cursor-pointer" onClick={() => setConvertFromAsset(asset)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-[12px] font-black text-indigo-400 group-hover:scale-110 transition-transform shrink-0">
                        {asset[0]}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[14px] font-bold text-white tracking-tight truncate">{asset}</span>
                        <span className="text-[9px] text-white/30 uppercase font-bold truncate">Network</span>
                      </div>
                    </div>
                  </td>

                  {/* Balance */}
                  <td className="px-3 py-4">
                    <div className="flex flex-col">
                      <span className="text-[13px] font-black text-white/90">
                        {amount < 0.001 ? amount.toFixed(8) : amount.toLocaleString('en-US', { maximumFractionDigits: 6 })}
                      </span>
                      <span className="text-[10px] text-white/30 font-bold tracking-tight">${value.toFixed(4)}</span>
                    </div>
                  </td>

                  {/* Entry Price */}
                  <td className="px-3 py-4 text-center">
                    {asset !== "USDT" && avgEntry > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[13px] font-bold text-white/60">
                          ${avgEntry.toLocaleString('en-US', { minimumFractionDigits: getDecimals(asset) })}
                        </span>
                        <span className="text-[8px] text-white/20 uppercase font-black">Initial Entry</span>
                      </div>
                    ) : <span className="text-white/10">—</span>}
                  </td>

                  {/* Live Price */}
                  <td className="px-3 py-4 text-center">
                    {asset !== "USDT" && currentPrice > 0 ? (
                      <div className="flex flex-col items-center">
                        <span className={`text-[13px] font-black ${currentPrice >= (marketData[asset]?.prevPrice || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                          ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: getDecimals(asset) })}
                        </span>
                        <span className="text-[8px] text-white/20 uppercase font-black">Market Hub</span>
                      </div>
                    ) : <span className="text-white/10">—</span>}
                  </td>

                  {/* Binance Conversion Interest (Fees) */}
                  <td className="px-3 py-4 text-center">
                    {asset !== "USDT" ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[12px] font-bold text-amber-500/60">
                          ${(value * 0.001 * (legCount + 1)).toFixed(4)}
                        </span>
                        <span className="text-[7px] text-white/20 uppercase font-black">Exch Interest</span>
                      </div>
                    ) : <span className="text-white/10">—</span>}
                  </td>

                  {/* ROI % (Leg-Aware Fee Calculation) */}
                  <td className="px-3 py-4 text-center">
                    {asset !== "USDT" && (hasPosition || amount > 0) && currentPrice > 0 ? (
                      (() => {
                        const effectiveEntry = avgEntry > 0 ? avgEntry : currentPrice;
                        const rawPnl = ((currentPrice - effectiveEntry) / effectiveEntry) * 100;
                        const displayRoi = avgEntry > 0 ? (rawPnl - roundTripFeePercent) : 0;
                        const isPosUp = displayRoi >= 0;
                        return (
                          <div className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-full border ${
                            isPosUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'bg-red-500/10 text-red-400 border-red-500/20'
                          }`}>
                            <span className="text-[12px] font-black">{isPosUp ? '+' : ''}{displayRoi.toFixed(4)}%</span>
                            <span className="text-[7px] font-black uppercase opacity-40">Net ( {legCount}x+1 )</span>
                          </div>
                        );
                      })()
                    ) : isPriceLoading ? (
                       <span className="text-white/10 animate-pulse text-[9px] uppercase font-bold tracking-tighter">Syncing…</span>
                    ) : <span className="text-white/10">—</span>}
                  </td>

                  {/* Net P&L (Balance-Weighted Calculation) */}
                  <td className="px-3 py-4 text-right">
                    {asset !== "USDT" && (hasPosition || amount > 0) && currentPrice > 0 ? (
                      (() => {
                        // Use the current balance * avgEntry to get the "Intrinsic Cost" of the coins you hold
                        const effectiveEntry = avgEntry > 0 ? avgEntry : currentPrice;
                        const intrinsicCost = amount * effectiveEntry;
                        const estimatedSellFee = value * 0.001;
                        
                        // Net Profit = (Current Market Value - Intrinsic Entry Cost) - Sell Fee
                        const netProfit = (value - intrinsicCost) - estimatedSellFee;
                        const isNetUp = netProfit >= 0;
                        return (
                          <div className={`flex flex-col items-end ${isNetUp ? 'text-emerald-400' : 'text-red-400'}`}>
                            <div className="font-black text-[13px] tracking-tighter">
                              {isNetUp ? '+' : '-'}${Math.abs(netProfit).toFixed(4)}
                            </div>
                            <div className="text-[8px] font-bold opacity-20 uppercase tracking-tighter">Net Hub Yield</div>
                          </div>
                        );
                      })()
                    ) : isPriceLoading ? (
                       <span className="text-white/10 animate-pulse text-[9px]">Loading…</span>
                    ) : <span className="text-white/5">—</span>}
                  </td>

                  {/* Actions Proper Column */}
                  <td className="pr-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5 font-sans">
                      {asset !== "USDT" && (
                        <>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleClosePosition(e, asset, value, amount); }}
                            className="w-7 h-7 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"
                            title="Exit Position"
                          >
                            <Power size={11} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleWipe(e, asset); }}
                            className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 text-white/30 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
                            title="Emergency Wipe"
                          >
                            <XCircle size={11} />
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
