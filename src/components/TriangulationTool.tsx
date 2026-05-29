"use client";

import React, { useState, useEffect } from "react";
import { useTradingEngine, SAFE_RESERVE } from "@/context/TradingContext";
import { ArrowDownUp, ChevronDown, Wallet, Zap } from "lucide-react";
import { motion as m } from "framer-motion";

export default function TriangulationTool() {
  const { balances, marketData, activeCoins, executeTriangulation, convertFromAsset, setConvertFromAsset } = useTradingEngine();
  const [toAsset, setToAsset] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const assets = ["USDT", ...activeCoins];

  const handleSwap = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    setStatus("idle");
    const success = await executeTriangulation(convertFromAsset, toAsset, val);
    setStatus(success ? "success" : "error");
    if (success) setAmount("");
    setTimeout(() => setStatus("idle"), 2000);
  };

  const handleFlip = () => {
    if (convertFromAsset === toAsset) return;
    const temp = convertFromAsset;
    setConvertFromAsset(toAsset);
    setToAsset(temp);
  };

  const handleMax = () => {
    const available = balances[convertFromAsset] || 0;
    const safeAmount = convertFromAsset === "USDT" ? Math.max(0, available - SAFE_RESERVE) : available;
    setAmount(safeAmount.toString());
  };

  const preview = (() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return null;
    const fromPrice = convertFromAsset === "USDT" ? 1 : (marketData[convertFromAsset]?.price || 0);
    const toPrice = toAsset === "USDT" ? 1 : (marketData[toAsset]?.price || 0);
    if (!fromPrice || !toPrice) return null;
    const usdtVal = val * fromPrice;
    return {
      amount: toAsset === "USDT" ? usdtVal.toFixed(3) : (usdtVal / toPrice).toFixed(7),
      usdValue: usdtVal.toFixed(3),
    };
  })();

  const fromBalance = balances[convertFromAsset] || 0;
  const fromUsdValue = convertFromAsset === "USDT" ? fromBalance : fromBalance * (marketData[convertFromAsset]?.price || 0);

  if (!isMounted) return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] h-full shrink-0 animate-pulse" />;

  return (
    <div className="glass-panel rounded-[2.5rem] h-full flex flex-col overflow-hidden shadow-2xl group/swap">
      {/* Header */}
      <div className="px-8 py-5 border-b border-white/[0.05] flex items-center justify-between shrink-0 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <ArrowDownUp size={14} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-[11px] font-black text-white/40 uppercase tracking-widest leading-none">Asset Conversion</div>
            <div className="text-[9px] font-mono text-white/20 uppercase tracking-tighter mt-1">Triangulation engine</div>
          </div>
        </div>
        {status === "success" && <m.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-[9px] font-black text-emerald-400 uppercase bg-emerald-400/10 px-2 py-1 rounded-lg">✓ SYNCED</m.span>}
        {status === "error" && <span className="text-[9px] font-black text-red-500 uppercase">✗ FAILED</span>}
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 flex flex-col justify-between">
        {/* FROM */}
        <div className="rounded-3xl bg-white/[0.01] border border-white/[0.05] p-5 space-y-4 transition-all hover:bg-white/[0.02] hover:border-white/[0.1] group/input">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none">DEBIT ASSET</span>
            <button onClick={handleMax} className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest">MAX POWER</button>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-[24px] font-black font-mono text-white placeholder-white/5 focus:outline-none min-w-0 tracking-tighter"
            />
            <select
              value={convertFromAsset}
              onChange={(e) => setConvertFromAsset(e.target.value)}
              className="bg-white/5 border border-white/[0.05] rounded-xl px-4 py-2 text-[12px] font-black font-mono text-white appearance-none cursor-pointer hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all outline-none"
            >
              {assets.map(a => <option key={a} value={a} className="bg-[#0d111b]">{a}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.03] pt-3">
            <div className="flex items-center gap-2 text-[10px] text-white/20 font-black uppercase tracking-tighter">
              <Wallet size={10} className="text-white/10" />
              <span>{fromBalance < 0.001 ? fromBalance.toFixed(8) : fromBalance.toLocaleString('en-US', { maximumFractionDigits: 6 })} {convertFromAsset}</span>
            </div>
            <span className="text-[10px] font-black text-white/10 font-mono tracking-widest uppercase">AVAILABLE</span>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div className="flex justify-center -my-3 relative z-10">
          <button
            onClick={handleFlip}
            className="w-10 h-10 rounded-2xl bg-[#0d111b] border border-white/[0.05] flex items-center justify-center hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all shadow-2xl group/flip"
          >
            <ArrowDownUp size={16} className="text-white/20 group-hover/flip:text-indigo-400 group-hover/flip:rotate-180 transition-all duration-500" />
          </button>
        </div>

        {/* TO */}
        <div className="rounded-3xl bg-white/[0.01] border border-white/[0.05] p-5 space-y-4 hover:bg-white/[0.02] transition-all">
          <span className="text-[9px] font-black text-white/20 uppercase tracking-widest leading-none">CREDIT ASSET</span>
          <div className="flex items-center gap-4">
            <div className="flex-1 text-[24px] font-black font-mono text-white/40 min-w-0 truncate tracking-tighter">
              {preview ? <span className="text-white">{preview.amount}</span> : "0.000000"}
            </div>
            <select
              value={toAsset}
              onChange={(e) => setToAsset(e.target.value)}
              className="bg-white/5 border border-white/[0.05] rounded-xl px-4 py-2 text-[12px] font-black font-mono text-white appearance-none cursor-pointer hover:bg-indigo-500/10 hover:border-indigo-500/30 transition-all outline-none"
            >
              {assets.map(a => <option key={a} value={a} className="bg-[#0d111b]">{a}</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between border-t border-white/[0.03] pt-3">
            <span className="text-[10px] font-black text-white/10 font-mono tracking-widest uppercase">ESTIMATED YIELD</span>
            {preview && (
              <div className="text-[10px] text-white/40 font-black font-mono uppercase tracking-tighter">
                ≈ ${preview.usdValue} <span className="text-white/10 tracking-widest ml-1 text-[8px]">USD EQUIVALENT</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execute */}
      <div className="px-5 pb-5">
        <button
          onClick={handleSwap}
          disabled={status !== "idle" || !preview}
          className={`w-full py-4 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] transition-all relative overflow-hidden group/btn ${
            status === "success" ? "bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.3)]" :
            status === "error" ? "bg-red-500 text-white" :
            !preview ? "bg-white/5 text-white/10 cursor-not-allowed border border-white/[0.05]" :
            "bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_30px_rgba(99,102,241,0.2)]"
          }`}
        >
          {status === "success" ? "✓ MISSION SUCCESS" : status === "error" ? "✗ SYSTEM FAILURE" : (
            <div className="flex items-center justify-center gap-2">
              <Zap size={14} className="group-hover/btn:animate-pulse" />
              <span>COMMIT EXCHANGE</span>
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
