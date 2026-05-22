"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/context/TradingContext";
import { ArrowRightLeft, RefreshCw, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function TriangulationTool() {
  const { balances, marketData, activeCoins, executeTriangulation, convertFromAsset, setConvertFromAsset } = useTradingEngine();
  const [toAsset, setToAsset] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const assets = ["USDT", ...activeCoins];

  const handleSwap = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    
    setStatus("idle"); // reset state before swap
    const success = await executeTriangulation(convertFromAsset, toAsset, val);
    if (success) {
      setStatus("success");
      setAmount("");
      setTimeout(() => setStatus("idle"), 2000);
    } else {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 2000);
    }
  };

  const calculatePreview = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return "0.00";
    
    let usdtVal = 0;
    if (convertFromAsset === "USDT") usdtVal = val;
    else {
      const price = marketData[convertFromAsset]?.price || 0;
      usdtVal = val * price;
    }

    if (toAsset === "USDT") return usdtVal.toFixed(2);
    const toPrice = marketData[toAsset]?.price || 0;
    return toPrice > 0 ? (usdtVal / toPrice).toFixed(4) : "0.00";
  };

  return (
    <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-white/5 h-[360px] flex flex-col bg-white/[0.01]">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <h3 className="text-[10px] sm:text-[11px] font-mono text-white/30 uppercase tracking-[0.3em] flex items-center gap-2">
          <ArrowRightLeft size={12} className="text-blue-400" /> CONVERSION
        </h3>
        <Zap size={10} className="text-yellow-500 animate-pulse" />
      </div>

      <div className="flex-1 space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <label className="text-[8px] uppercase font-mono text-white/20 ml-2 tracking-widest">Source</label>
          <div className="flex gap-2">
            <select 
              value={convertFromAsset} 
              onChange={(e) => setConvertFromAsset(e.target.value)}
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-[10px] font-mono text-white appearance-none"
            >
              {assets.map(a => <option key={a} value={a} className="bg-neutral-900">{a}</option>)}
            </select>
            <input 
              type="number" 
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-1/2 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-[10px] font-mono text-white focus:border-blue-500/50"
            />
          </div>
          <div className="flex items-center justify-between px-2">
            <div className="text-[8px] font-mono text-white/10">{balances[convertFromAsset]?.toLocaleString() || 0} {convertFromAsset}</div>
            <button 
              onClick={() => {
                const available = balances[convertFromAsset] || 0;
                const safeAmount = convertFromAsset === "USDT" ? Math.max(0, available - 10.0) : available;
                setAmount(safeAmount.toString());
              }}
              className="text-[8px] font-mono font-bold text-blue-400/80 hover:text-blue-400"
            >
              MAX
            </button>
          </div>
        </div>

        <div className="flex justify-center -my-2 relative z-10">
          <button 
            onClick={() => {
              const temp = convertFromAsset;
              setConvertFromAsset(toAsset);
              setToAsset(temp);
            }}
            className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
          >
            <RefreshCw size={12} className="text-white/30" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="text-[8px] uppercase font-mono text-white/20 ml-2 tracking-widest">Target</label>
          <select 
            value={toAsset} 
            onChange={(e) => setToAsset(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-[10px] font-mono text-white appearance-none"
          >
            {assets.map(a => <option key={a} value={a} className="bg-neutral-900">{a}</option>)}
          </select>
          <div className="mt-2 p-3 sm:p-4 rounded-2xl bg-white/[0.02] border border-white/[0.05]">
            <div className="text-[7px] uppercase font-mono text-white/20 mb-1">Receipt Estimate</div>
            <div className="text-base sm:text-lg font-black font-mono text-blue-400">
              {calculatePreview()} <span className="text-[9px] text-white/20 font-normal">{toAsset}</span>
            </div>
          </div>
        </div>
      </div>

      <button 
        onClick={handleSwap}
        disabled={status !== "idle"}
        className={`w-full py-4 mt-6 rounded-2xl font-mono text-[10px] font-black uppercase tracking-widest transition-all ${
          status === "success" ? "bg-green-500 text-black" : 
          status === "error" ? "bg-red-500 text-white" : 
          "bg-blue-600 hover:bg-blue-500 text-white"
        }`}
      >
        {status === "success" ? "SUCCESS" : status === "error" ? "FAILED" : "EXECUTE SWAP"}
      </button>
    </div>
  );
}
