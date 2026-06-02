"use client";

import React, { useState, useEffect } from "react";
import { useTradingEngine, SAFE_RESERVE } from "@/context/TradingContext";
import { ArrowDownUp, Zap, Wallet } from "lucide-react";
import { motion as m, AnimatePresence } from "framer-motion";

export default function TriangulationTool() {
  const { balances, marketData, activeCoins, executeTriangulation, convertFromAsset, setConvertFromAsset } = useTradingEngine();
  const [toAsset, setToAsset] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [isMounted, setIsMounted] = useState(false);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const assets = ["USDT", ...activeCoins];

  const handleSwap = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0 || status !== "idle") return;
    setStatus("loading");
    const success = await executeTriangulation(convertFromAsset, toAsset, val);
    setStatus(success ? "success" : "error");
    if (success) setAmount("");
    setTimeout(() => setStatus("idle"), 2200);
  };

  const handleFlip = () => {
    if (convertFromAsset === toAsset || isFlipping) return;
    setIsFlipping(true);
    const temp = convertFromAsset;
    setConvertFromAsset(toAsset);
    setToAsset(temp);
    setTimeout(() => setIsFlipping(false), 400);
  };

  const handleMax = () => {
    const available = balances[convertFromAsset] || 0;
    const safe = convertFromAsset === "USDT" ? Math.max(0, available - SAFE_RESERVE) : available;
    setAmount(safe > 0 ? safe.toFixed(6).replace(/\.?0+$/, "") : "");
  };

  const preview = (() => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return null;
    const fromPrice = convertFromAsset === "USDT" ? 1 : (marketData[convertFromAsset]?.price || 0);
    const toPrice = toAsset === "USDT" ? 1 : (marketData[toAsset]?.price || 0);
    if (!fromPrice || !toPrice) return null;
    const usdtVal = val * fromPrice;
    const outAmount = toAsset === "USDT" ? usdtVal : usdtVal / toPrice;
    const rate = fromPrice / toPrice;
    return { amount: outAmount, usdValue: usdtVal, rate };
  })();

  const fromBalance = balances[convertFromAsset] || 0;
  const fromUsd = convertFromAsset === "USDT" ? fromBalance : fromBalance * (marketData[convertFromAsset]?.price || 0);
  const fmtBal = (b: number) => b < 0.001 ? b.toFixed(6) : b < 1000 ? b.toLocaleString("en-US", { maximumFractionDigits: 4 }) : b.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const fmtOut = (n: number) => n < 0.0001 ? n.toFixed(8) : n < 1 ? n.toFixed(6) : n < 1000 ? n.toFixed(4) : n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  if (!isMounted) return <div className="rounded-[2rem] border border-white/[0.07] bg-white/[0.02] h-full animate-pulse" />;

  const canExecute = status === "idle" && !!preview;
  const btnClass = status === "success"
    ? "bg-emerald-500 text-black border-emerald-400/50 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
    : status === "error"
    ? "bg-red-500/90 text-white border-red-400/40 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
    : status === "loading"
    ? "bg-indigo-600/60 text-white/60 border-indigo-500/30 cursor-wait"
    : canExecute
    ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-indigo-500/40 hover:from-indigo-500 hover:to-violet-500 shadow-[0_0_28px_rgba(99,102,241,0.3)] hover:shadow-[0_0_36px_rgba(99,102,241,0.45)] cursor-pointer"
    : "bg-white/[0.03] text-white/15 border-white/[0.05] cursor-not-allowed";

  return (
    <div className="relative rounded-[2rem] h-full flex flex-col overflow-hidden shadow-2xl border border-white/[0.08]"
      style={{ background: "linear-gradient(160deg, #12172a 0%, #0d111e 60%, #10152a 100%)" }}
    >
      {/* Ambient glow top */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="relative px-5 pt-5 pb-3 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/25 flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.15)]">
            <ArrowDownUp size={12} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-[10px] font-black text-white/70 uppercase tracking-[0.25em] leading-none">Convert</div>
            <div className="text-[8px] font-mono text-indigo-500/60 uppercase tracking-widest mt-0.5">Instant Swap</div>
          </div>
        </div>
        <AnimatePresence>
          {status === "success" && (
            <m.div initial={{ opacity: 0, scale: 0.7, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/25 rounded-lg px-2 py-0.5"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Done</span>
            </m.div>
          )}
          {status === "error" && (
            <m.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-[8px] font-black text-red-400 uppercase tracking-widest bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-0.5"
            >✗ Failed</m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent shrink-0" />

      {/* ── BODY ───────────────────────────────────────── */}
      <div className="flex-1 px-4 py-3 flex flex-col gap-2 min-h-0">

        {/* FROM BLOCK */}
        <div className="rounded-2xl bg-white/[0.025] border border-white/[0.06] p-3.5 hover:border-indigo-500/20 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black text-white/25 uppercase tracking-[0.25em]">From</span>
            <button onClick={handleMax}
              className="text-[8px] font-black text-indigo-400/70 hover:text-indigo-300 transition-colors uppercase tracking-wider px-1.5 py-0.5 rounded-md hover:bg-indigo-500/10"
            >MAX</button>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSwap()}
              className="flex-1 bg-transparent text-[22px] font-black font-mono text-white placeholder-white/10 focus:outline-none min-w-0 tracking-tighter"
            />
            <div className="relative shrink-0">
              <select
                value={convertFromAsset}
                onChange={(e) => setConvertFromAsset(e.target.value)}
                className="appearance-none bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-black text-[11px] font-mono rounded-xl pl-3 pr-6 py-1.5 cursor-pointer hover:bg-indigo-500/20 transition-all outline-none"
              >
                {assets.map(a => <option key={a} value={a} className="bg-[#0d111b] text-white">{a}</option>)}
              </select>
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[9px] text-white/20 font-mono">
              <Wallet size={8} className="text-white/15" />
              <span>{fmtBal(fromBalance)}</span>
            </div>
            <span className="text-[8px] font-mono text-white/15">${fromUsd.toFixed(2)}</span>
          </div>
        </div>

        {/* FLIP BUTTON */}
        <div className="flex justify-center -my-0.5 relative z-10">
          <m.button
            onClick={handleFlip}
            animate={{ rotate: isFlipping ? 180 : 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="w-8 h-8 rounded-xl bg-[#0d111b] border border-white/[0.08] flex items-center justify-center hover:border-indigo-500/30 hover:bg-indigo-500/10 transition-all shadow-xl group"
          >
            <ArrowDownUp size={13} className="text-white/25 group-hover:text-indigo-400 transition-colors" />
          </m.button>
        </div>

        {/* TO BLOCK */}
        <div className="rounded-2xl bg-white/[0.015] border border-white/[0.05] p-3.5 hover:border-violet-500/15 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black text-white/25 uppercase tracking-[0.25em]">To</span>
            <span className="text-[8px] font-mono text-white/15 uppercase tracking-wider">Est. Yield</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-[22px] font-black font-mono min-w-0 truncate tracking-tighter">
              <AnimatePresence mode="wait">
                {preview ? (
                  <m.span key={preview.amount} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-white"
                  >{fmtOut(preview.amount)}</m.span>
                ) : (
                  <span className="text-white/10">0.00</span>
                )}
              </AnimatePresence>
            </div>
            <div className="relative shrink-0">
              <select
                value={toAsset}
                onChange={(e) => setToAsset(e.target.value)}
                className="appearance-none bg-violet-500/10 border border-violet-500/20 text-violet-300 font-black text-[11px] font-mono rounded-xl pl-3 pr-6 py-1.5 cursor-pointer hover:bg-violet-500/20 transition-all outline-none"
              >
                {assets.map(a => <option key={a} value={a} className="bg-[#0d111b] text-white">{a}</option>)}
              </select>
              <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="8" height="5" viewBox="0 0 8 5" fill="none"><path d="M1 1l3 3 3-3" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </div>
          {preview ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[8px] font-mono text-emerald-400/60">≈ ${preview.usdValue.toFixed(2)} USD</span>
              <span className="text-[8px] font-mono text-white/15">1 {convertFromAsset} = {fmtOut(preview.rate)} {toAsset}</span>
            </div>
          ) : (
            <div className="mt-2 h-[14px]" />
          )}
        </div>

        {/* RATE BAR — only shown when preview is active */}
        <AnimatePresence>
          {preview && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] px-3 py-2 flex items-center justify-between">
                <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Fee</span>
                <span className="text-[8px] font-mono text-white/30">~0.1% · ${(preview.usdValue * 0.001).toFixed(3)}</span>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── EXECUTE BUTTON ─────────────────────────────── */}
      <div className="px-4 pb-4 shrink-0">
        <m.button
          onClick={handleSwap}
          disabled={!canExecute}
          whileTap={canExecute ? { scale: 0.97 } : {}}
          className={`w-full py-3 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] border transition-all duration-200 flex items-center justify-center gap-2 ${btnClass}`}
        >
          {status === "loading" ? (
            <>
              <m.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-indigo-400"
              />
              <span>Processing…</span>
            </>
          ) : status === "success" ? (
            <span>✓ Exchange Complete</span>
          ) : status === "error" ? (
            <span>✗ Retry</span>
          ) : (
            <>
              <Zap size={13} className="shrink-0" />
              <span>Execute Swap</span>
            </>
          )}
        </m.button>
      </div>
    </div>
  );
}
