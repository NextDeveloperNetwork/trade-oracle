"use client";

import React, { useState, useEffect } from "react";
import { useTradingEngine, SAFE_RESERVE } from "@/context/TradingContext";
import { ArrowDownUp, ChevronDown, Wallet } from "lucide-react";

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
      amount: toAsset === "USDT" ? usdtVal.toFixed(2) : (usdtVal / toPrice).toFixed(6),
      usdValue: usdtVal.toFixed(2),
    };
  })();

  const fromBalance = balances[convertFromAsset] || 0;
  const fromUsdValue = convertFromAsset === "USDT" ? fromBalance : fromBalance * (marketData[convertFromAsset]?.price || 0);

  if (!isMounted) return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] h-full shrink-0 animate-pulse" />;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111827]/50 backdrop-blur-xl h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ArrowDownUp size={14} className="text-blue-400" />
          <span className="text-[11px] font-mono font-bold text-white/60 uppercase tracking-widest">Swap</span>
        </div>
        {status === "success" && <span className="text-[10px] font-bold text-emerald-400 animate-pulse">✓ Done</span>}
        {status === "error" && <span className="text-[10px] font-bold text-red-400">✗ Failed</span>}
      </div>

      {/* Body */}
      <div className="flex-1 px-5 py-4 flex flex-col justify-between">
        {/* FROM */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider font-bold">You Pay</span>
            <button onClick={handleMax} className="text-[9px] font-mono font-bold text-blue-400 hover:text-blue-300 transition-colors">MAX</button>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1 bg-transparent text-[20px] font-black font-mono text-white placeholder-white/15 focus:outline-none min-w-0"
            />
            <select
              value={convertFromAsset}
              onChange={(e) => setConvertFromAsset(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] font-mono font-bold text-white appearance-none cursor-pointer hover:bg-white/10 transition-all"
            >
              {assets.map(a => <option key={a} value={a} className="bg-[#1a1f2e]">{a}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-white/25 font-mono">
            <Wallet size={9} />
            <span>{fromBalance < 0.001 ? fromBalance.toFixed(6) : fromBalance.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>
            <span className="text-white/15">≈ ${fromUsdValue.toFixed(2)}</span>
          </div>
        </div>

        {/* SWAP BUTTON */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleFlip}
            className="w-9 h-9 rounded-xl bg-[#1e2536] border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-white/20 transition-all shadow-lg"
          >
            <ArrowDownUp size={14} className="text-white/50" />
          </button>
        </div>

        {/* TO */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 space-y-2">
          <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider font-bold">You Receive</span>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[20px] font-black font-mono text-white/80 min-w-0 truncate">
              {preview ? preview.amount : <span className="text-white/15">0.00</span>}
            </div>
            <select
              value={toAsset}
              onChange={(e) => setToAsset(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] font-mono font-bold text-white appearance-none cursor-pointer hover:bg-white/10 transition-all"
            >
              {assets.map(a => <option key={a} value={a} className="bg-[#1a1f2e]">{a}</option>)}
            </select>
          </div>
          {preview && (
            <div className="text-[9px] text-white/25 font-mono">≈ ${preview.usdValue} USD</div>
          )}
        </div>
      </div>

      {/* Execute */}
      <div className="px-5 pb-4">
        <button
          onClick={handleSwap}
          disabled={status !== "idle" || !preview}
          className={`w-full py-3 rounded-xl font-mono text-[11px] font-black uppercase tracking-widest transition-all ${
            status === "success" ? "bg-emerald-500 text-black" :
            status === "error" ? "bg-red-500 text-white" :
            !preview ? "bg-white/5 text-white/20 cursor-not-allowed" :
            "bg-blue-500 hover:bg-blue-400 text-white shadow-[0_0_20px_rgba(59,130,246,0.2)]"
          }`}
        >
          {status === "success" ? "✓ Swap Complete" : status === "error" ? "✗ Swap Failed" : "Execute Swap"}
        </button>
      </div>
    </div>
  );
}
