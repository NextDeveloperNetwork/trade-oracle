"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useTradingEngine, Candle } from "@/context/TradingContext";
import { Activity, ChevronDown, TrendingUp, TrendingDown, Zap, Target, BarChart2 } from "lucide-react";

// ─── Binance Pro Palette ─────────────────────────────────────────────────────
const COL = {
  GREEN: "#02c076",
  RED: "#f84960",
  MA7: "#f5c842",
  MA25: "#a855f7",
  MA99: "#3b82f6",
  BG: "#0b0e11",
  HUD: "#161a1e",
  ACCENT: "#f0b90b",
  GRID: "rgba(255,255,255,0.025)",
  CROSSHAIR: "rgba(255,255,255,0.15)",
};

const getDecimals = (coin: string) => {
  if (["BTC", "ETH"].includes(coin)) return 2;
  if (["XRP", "ADA", "DUSK", "CELR", "DOGE"].includes(coin)) return 4;
  return 6;
};

const formatPrice = (p: number, coin: string) =>
  p.toLocaleString("en-US", {
    minimumFractionDigits: getDecimals(coin),
    maximumFractionDigits: getDecimals(coin),
  });

// ─── Component ───────────────────────────────────────────────────────────────
export default function MainCandleChart() {
  const { marketData, activeCoins, tradeHistory, openPositions, currentStrategy } = useTradingEngine();
  const [selectedCoin, setSelectedCoin] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    if (activeCoins.length > 0 && !selectedCoin) setSelectedCoin(activeCoins[0]);
  }, [activeCoins, selectedCoin]);

  const md = marketData[selectedCoin];
  const history = useMemo(() => md?.candleHistory || [], [md?.candleHistory]);
  const relevant = history.slice(-60);

  // ─── Technical Indicators ──────────────────────────────────────────────────
  const calcMA = (data: Candle[], period: number) =>
    data.map((_, i) =>
      i < period - 1
        ? null
        : data.slice(i - period + 1, i + 1).reduce((s, c) => s + c.c, 0) / period
    );

  const ma7 = useMemo(() => calcMA(relevant, 7), [relevant]);
  const ma25 = useMemo(() => calcMA(relevant, 25), [relevant]);

  // RSI for the info panel
  const closes = useMemo(() => relevant.map((c) => c.c), [relevant]);
  const currentRSI = useMemo(() => {
    if (closes.length < 15) return null;
    const period = 14;
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i <= period; i++) {
      const d = closes[i] - closes[i - 1];
      if (d > 0) avgGain += d; else avgLoss -= d;
    }
    avgGain /= period; avgLoss /= period;
    for (let i = period + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
    }
    return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }, [closes]);

  // ─── Loading States ────────────────────────────────────────────────────────
  if (!isMounted) return <div className="h-full bg-[#0b0e11] animate-pulse rounded-2xl border border-white/5" />;

  if (relevant.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#0b0e11] rounded-2xl border border-white/5">
        <Activity size={32} className="text-white/10 animate-pulse" />
        <span className="text-[10px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          Connecting to Binance Stream…
        </span>
      </div>
    );
  }

  // ─── Chart Geometry ────────────────────────────────────────────────────────
  const width = chartRef.current?.clientWidth || 800;
  const height = 440;
  const PAD = { top: 10, bottom: 70, right: 65, left: 0 };
  const chartH = height - PAD.top - PAD.bottom;
  const chartW = width - PAD.right - PAD.left;
  const candleW = Math.max(4, chartW / relevant.length);
  const volZoneH = 60; // pixel height for volume bars

  const min = Math.min(...relevant.map((c) => c.l));
  const max = Math.max(...relevant.map((c) => c.h));
  const range = (max - min) || 0.0001;
  const maxVol = Math.max(...relevant.map((c) => c.v)) || 1;

  const getX = (i: number) => PAD.left + i * candleW;
  const getY = (price: number) => PAD.top + ((max - price) / range) * chartH;

  const lastCandle = relevant[relevant.length - 1];
  const hoverData = hoverIdx !== null && hoverIdx < relevant.length ? relevant[hoverIdx] : null;
  const displayData = hoverData || lastCandle;
  const isDisplayUp = displayData.c >= displayData.o;

  // ─── Position & Trade Data ────────────────────────────────────────────────
  const myPos = openPositions.find((p) => p.coin === selectedCoin);
  const myTrades = tradeHistory.filter((t) => t.coin === selectedCoin);

  // Change % from first to last candle
  const sessionChange = relevant.length > 1
    ? ((lastCandle.c - relevant[0].o) / relevant[0].o) * 100
    : 0;

  // ─── Mouse ────────────────────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!chartRef.current) return;
    const rect = chartRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });
    const idx = Math.floor((x - PAD.left) / candleW);
    setHoverIdx(idx >= 0 && idx < relevant.length ? idx : null);
  };

  // ─── MA Line Path ─────────────────────────────────────────────────────────
  const maPath = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v !== null ? `${getX(i) + candleW / 2},${getY(v)}` : ""))
      .filter(Boolean)
      .join(" ");

  return (
    <div className="h-full rounded-2xl border border-white/[0.06] bg-[#0b0e11] overflow-hidden flex flex-col shadow-2xl relative">
      {/* ═══ HEADER BAR ═══════════════════════════════════════════════════════ */}
      <div className="px-5 py-3 border-b border-white/[0.04] flex items-center justify-between bg-[#161a1e]/90 backdrop-blur-xl z-50 shrink-0">
        {/* Left: Ticker + Price */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 cursor-pointer">
            <span className="text-[16px] font-black text-white tracking-tight">{selectedCoin}/USDT</span>
            <ChevronDown size={12} className="text-white/20" />
          </div>

          <div className="flex items-center gap-3">
            <span className={`text-[15px] font-black font-mono ${isDisplayUp ? "text-[#02c076]" : "text-[#f84960]"}`}>
              {formatPrice(displayData.c, selectedCoin)}
            </span>
            <span className={`text-[11px] font-black font-mono px-2 py-0.5 rounded-md border ${
              sessionChange >= 0
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              {sessionChange >= 0 ? "+" : ""}{sessionChange.toFixed(2)}%
            </span>
          </div>

          {/* OHLC */}
          <div className="hidden lg:flex items-center gap-4 border-l border-white/5 pl-5">
            {[
              { l: "O", v: displayData.o },
              { l: "H", v: displayData.h, col: "#02c076" },
              { l: "L", v: displayData.l, col: "#f84960" },
              { l: "C", v: displayData.c },
            ].map((d) => (
              <div key={d.l} className="flex items-center gap-1">
                <span className="text-[9px] font-black text-white/15">{d.l}</span>
                <span className="text-[11px] font-mono font-bold" style={{ color: d.col || "rgba(255,255,255,0.5)" }}>
                  {formatPrice(d.v, selectedCoin)}
                </span>
              </div>
            ))}
            <div className="flex items-center gap-1 border-l border-white/5 pl-4">
              <span className="text-[9px] font-black text-white/15">VOL</span>
              <span className="text-[11px] font-mono font-bold text-white/40">
                {displayData.v > 1000 ? (displayData.v / 1000).toFixed(1) + "K" : displayData.v.toFixed(1)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 border-l border-white/5 pl-8">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-red-500/40 uppercase tracking-tighter">Neural Projection</span>
              <span className="text-[12px] font-mono font-bold text-red-500">
                ${(() => {
                  const lookback = 10;
                  const slice = relevant.slice(-lookback);
                  if (slice.length < lookback) return "---";
                  const avgY = slice.reduce((acc, c) => acc + c.c, 0) / lookback;
                  const avgX = lookback / 2;
                  let num = 0, den = 0;
                  slice.forEach((c, i) => {
                    num += (i - avgX) * (c.c - avgY);
                    den += (i - avgX) * (i - avgX);
                  });
                  const m = den === 0 ? 0 : num / den;
                  return formatPrice(lastCandle.c + (m * 5), selectedCoin);
                })()}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Info Panel */}
        <div className="flex items-center gap-3">
          {/* RSI Badge */}
          {currentRSI !== null && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black font-mono ${
              currentRSI > 70
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : currentRSI < 30
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  : "bg-white/5 text-white/40 border-white/10"
            }`}>
              <Zap size={10} />
              RSI {currentRSI.toFixed(0)}
            </div>
          )}

          {/* Signal Status */}
          {md?.signal && md.signal !== "HOLD" && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase ${
              md.signal === "BUY"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
              <Target size={10} />
              {md.signal} Signal
            </div>
          )}

          {/* Strategy */}
          <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-black font-mono uppercase">
            {currentStrategy}
          </div>
        </div>
      </div>

      {/* ═══ CHART CANVAS ═════════════════════════════════════════════════════ */}
      <div
        ref={chartRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}
        className="flex-1 relative cursor-crosshair select-none bg-[#0b0e11]"
      >
        {/* MA Legend */}
        <div className="absolute top-2 left-4 flex gap-5 text-[10px] font-bold font-mono z-30 items-center">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full" style={{ background: COL.MA7 }} />
            <span style={{ color: COL.MA7 }}>MA7 {ma7[ma7.length - 1]?.toFixed(getDecimals(selectedCoin))}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full" style={{ background: COL.MA25 }} />
            <span style={{ color: COL.MA25 }}>MA25 {ma25[ma25.length - 1]?.toFixed(getDecimals(selectedCoin))}</span>
          </span>
        </div>

        {/* Y-Axis Labels */}
        <div className="absolute top-0 h-full flex flex-col justify-between pointer-events-none z-30"
          style={{ right: 0, width: PAD.right, paddingTop: PAD.top, paddingBottom: PAD.bottom }}
        >
          {[...Array(8)].map((_, i) => {
            const price = max - (i * (range / 7));
            return (
              <span key={i} className="text-[9px] font-mono text-white/20 text-right pr-2 leading-none">
                {formatPrice(price, selectedCoin)}
              </span>
            );
          })}
        </div>

        <svg width="100%" height="100%" className="relative z-20">
          {/* ── Grid ──────────────────────────────────────────────────── */}
          {[...Array(8)].map((_, i) => (
            <line
              key={`h${i}`}
              x1={0} y1={PAD.top + (i * chartH) / 7}
              x2={chartW} y2={PAD.top + (i * chartH) / 7}
              stroke="white" strokeOpacity="0.025" strokeWidth="0.5"
            />
          ))}
          {[...Array(12)].map((_, i) => (
            <line
              key={`v${i}`}
              x1={PAD.left + (i * chartW) / 12} y1={0}
              x2={PAD.left + (i * chartW) / 12} y2={height}
              stroke="white" strokeOpacity="0.02" strokeWidth="0.5"
            />
          ))}

          {/* ── Volume Bars ───────────────────────────────────────────── */}
          {relevant.map((c, i) => {
            const x = getX(i);
            const isUp = c.c >= c.o;
            const volH = Math.max(1, (c.v / maxVol) * volZoneH);
            return (
              <rect
                key={`vol-${i}`}
                x={x + 1} y={height - PAD.bottom - volH}
                width={Math.max(1, candleW - 2)} height={volH}
                fill={isUp ? COL.GREEN : COL.RED} fillOpacity={0.12}
                rx={1}
              />
            );
          })}

          {/* ── MA Lines ──────────────────────────────────────────────── */}
          <polyline
            fill="none" stroke={COL.MA7} strokeWidth="1.5" strokeLinejoin="round" opacity={0.7}
            points={maPath(ma7)}
          />
          <polyline
            fill="none" stroke={COL.MA25} strokeWidth="1.5" strokeLinejoin="round" opacity={0.5}
            points={maPath(ma25)}
          />

          {/* ── Candlesticks ──────────────────────────────────────────── */}
          {relevant.map((c, i) => {
            const x = getX(i);
            const isUp = c.c >= c.o;
            const color = isUp ? COL.GREEN : COL.RED;
            const yO = getY(c.o);
            const yC = getY(c.c);
            const bodyY = Math.min(yO, yC);
            const bodyH = Math.max(1, Math.abs(yO - yC));
            const isHovered = hoverIdx === i;

            return (
              <g key={`candle-${i}`}>
                {/* Wick */}
                <line
                  x1={x + candleW / 2} y1={getY(c.h)}
                  x2={x + candleW / 2} y2={getY(c.l)}
                  stroke={color} strokeWidth={isHovered ? 2 : 1}
                />
                {/* Body */}
                <rect
                  x={x + 1} y={bodyY}
                  width={Math.max(2, candleW - 2)} height={bodyH}
                  fill={isUp ? COL.BG : color}
                  stroke={color} strokeWidth={isHovered ? 2 : 1.2}
                  rx={0.5}
                />
                {/* Glow on hover */}
                {isHovered && (
                  <rect
                    x={x - 1} y={bodyY - 2}
                    width={candleW + 2} height={bodyH + 4}
                    fill="none" stroke={color} strokeWidth="0.5" opacity={0.4}
                    rx={2}
                  />
                )}
              </g>
            );
          })}

          {/* ── Entry Price Line ──────────────────────────────────────── */}
          {myPos && myPos.entryPrice >= min && myPos.entryPrice <= max && (
            <g>
              <line
                x1={0} y1={getY(myPos.entryPrice)} x2={chartW} y2={getY(myPos.entryPrice)}
                stroke={COL.ACCENT} strokeWidth="1" strokeDasharray="8 4" opacity={0.5}
              />
              <rect x={0} y={getY(myPos.entryPrice) - 9} width={72} height={18} fill={COL.ACCENT} rx={3} opacity={0.9} />
              <text x={6} y={getY(myPos.entryPrice) + 4} fill="#000" fontSize="9" fontWeight="900" fontFamily="monospace">
                ENTRY {formatPrice(myPos.entryPrice, selectedCoin)}
              </text>
              {/* P&L from entry */}
              {(() => {
                const pnl = ((lastCandle.c - myPos.entryPrice) / myPos.entryPrice) * 100;
                const pnlUp = pnl >= 0;
                return (
                  <g>
                    <rect x={75} y={getY(myPos.entryPrice) - 9} width={50} height={18} fill={pnlUp ? COL.GREEN : COL.RED} rx={3} opacity={0.85} />
                    <text x={80} y={getY(myPos.entryPrice) + 4} fill="#fff" fontSize="9" fontWeight="900" fontFamily="monospace">
                      {pnlUp ? "+" : ""}{pnl.toFixed(2)}%
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {/* ── Trade Execution Markers ───────────────────────────────── */}
          {relevant.map((c, i) => {
            const ts = new Date(c.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const trade = myTrades.find((t) => t.time === ts);
            if (!trade) return null;
            const isBuy = trade.action === "BUY";
            const cy = isBuy ? getY(c.l) + 18 : getY(c.h) - 18;
            const col = isBuy ? COL.GREEN : COL.RED;
            return (
              <g key={`trade-${i}`}>
                <circle cx={getX(i) + candleW / 2} cy={cy} r={5} fill={col} opacity={0.9} />
                <text
                  x={getX(i) + candleW / 2} y={cy + 3.5}
                  fill="#fff" fontSize="7" fontWeight="900" textAnchor="middle" fontFamily="monospace"
                >
                  {isBuy ? "B" : "S"}
                </text>
                {/* Glow ring */}
                <circle cx={getX(i) + candleW / 2} cy={cy} r={8} fill="none" stroke={col} strokeWidth="0.5" opacity={0.3} />
              </g>
            );
          })}

          {/* ── Current Price Line ────────────────────────────────────── */}
          <line
            x1={0} y1={getY(lastCandle.c)} x2={chartW} y2={getY(lastCandle.c)}
            stroke={lastCandle.c >= lastCandle.o ? COL.GREEN : COL.RED}
            strokeWidth="1" strokeDasharray="3 3" opacity={0.35}
          />

          {/* ── Neural Prediction Line (RED) ─────────────────────────── */}
          {(() => {
            const lookback = 10;
            const slice = relevant.slice(-lookback);
            if (slice.length < lookback) return null;
            
            // Linear Regression / Momentum Slope
            const avgY = slice.reduce((acc, c) => acc + c.c, 0) / lookback;
            const avgX = lookback / 2;
            let num = 0;
            let den = 0;
            slice.forEach((c, i) => {
              num += (i - avgX) * (c.c - avgY);
              den += (i - avgX) * (i - avgX);
            });
            const m = den === 0 ? 0 : num / den; // Slope
            
            // Project 10 candles forward
            const x1 = getX(relevant.length - 1) + candleW/2;
            const y1 = getY(lastCandle.c);
            const x2 = x1 + (candleW * 5);
            const y2 = getY(lastCandle.c + (m * 5));

            return (
              <g>
                <defs>
                  <linearGradient id="predGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={COL.RED} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={COL.RED} stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <line 
                  x1={x1} y1={y1} x2={x2} y2={y2} 
                  stroke="url(#predGrad)" strokeWidth="2" strokeDasharray="5 3" 
                  className="animate-pulse"
                />
                <circle cx={x2} cy={y2} r={3} fill={COL.RED} className="animate-ping" />
                <text x={x2 + 8} y={y2 + 4} fill={COL.RED} fontSize="9" fontWeight="900" className="opacity-60">
                   PROJECTED
                </text>
              </g>
            );
          })()}

          {/* ── Crosshair ────────────────────────────────────────────── */}
          {hoverIdx !== null && (
            <g>
              <line x1={0} y1={mousePos.y} x2={chartW} y2={mousePos.y} stroke={COL.CROSSHAIR} strokeWidth="0.5" strokeDasharray="4 3" />
              <line x1={mousePos.x} y1={0} x2={mousePos.x} y2={height - PAD.bottom} stroke={COL.CROSSHAIR} strokeWidth="0.5" strokeDasharray="4 3" />
              {/* Price label on Y axis */}
              <rect x={chartW} y={mousePos.y - 10} width={PAD.right} height={20} fill="#1e2329" />
              <text x={chartW + 4} y={mousePos.y + 4} fill="white" fontSize="9" fontFamily="monospace" fontWeight="700">
                {formatPrice(max - ((mousePos.y - PAD.top) / chartH) * range, selectedCoin)}
              </text>
              {/* Time label at bottom */}
              {hoverData && (
                <>
                  <rect x={mousePos.x - 25} y={height - PAD.bottom} width={50} height={16} fill="#1e2329" rx={3} />
                  <text x={mousePos.x} y={height - PAD.bottom + 11} fill="white" fontSize="8" fontFamily="monospace" textAnchor="middle">
                    {new Date(hoverData.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </text>
                </>
              )}
            </g>
          )}
        </svg>

        {/* Live Price Tag (right edge) */}
        <div
          className="absolute z-40 font-mono text-[10px] font-black px-2 py-0.5 rounded-sm shadow-lg"
          style={{
            top: getY(lastCandle.c) - 9,
            right: 0,
            width: PAD.right,
            textAlign: "center",
            backgroundColor: lastCandle.c >= lastCandle.o ? COL.GREEN : COL.RED,
            color: "#000",
            boxShadow: `0 0 12px ${lastCandle.c >= lastCandle.o ? COL.GREEN : COL.RED}55`,
          }}
        >
          {formatPrice(lastCandle.c, selectedCoin)}
        </div>

        {/* ── Hover Tooltip ──────────────────────────────────────────── */}
        {hoverData && (
          <div
            className="absolute z-50 bg-[#1a1f2e]/95 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-xl pointer-events-none"
            style={{
              left: Math.min(mousePos.x + 16, width - 200),
              top: Math.max(mousePos.y - 80, 10),
            }}
          >
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
              <span className="text-[10px] font-mono text-white/30">
                {new Date(hoverData.t).toLocaleTimeString()}
              </span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                hoverData.c >= hoverData.o ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
              }`}>
                {hoverData.c >= hoverData.o ? "BULLISH" : "BEARISH"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[10px] font-mono">
              <div className="flex justify-between gap-3">
                <span className="text-white/20">Open</span>
                <span className="text-white/70 font-bold">{formatPrice(hoverData.o, selectedCoin)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-emerald-400/40">High</span>
                <span className="text-emerald-400/70 font-bold">{formatPrice(hoverData.h, selectedCoin)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-white/20">Close</span>
                <span className="text-white/70 font-bold">{formatPrice(hoverData.c, selectedCoin)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-red-400/40">Low</span>
                <span className="text-red-400/70 font-bold">{formatPrice(hoverData.l, selectedCoin)}</span>
              </div>
              <div className="col-span-2 flex justify-between gap-3 pt-1 border-t border-white/5 mt-1">
                <span className="text-white/20">Volume</span>
                <span className="text-amber-400/70 font-bold">
                  {hoverData.v > 1000 ? (hoverData.v / 1000).toFixed(1) + "K" : hoverData.v.toFixed(2)}
                </span>
              </div>
              <div className="col-span-2 flex justify-between gap-3">
                <span className="text-white/20">Change</span>
                <span className={`font-bold ${hoverData.c >= hoverData.o ? "text-emerald-400" : "text-red-400"}`}>
                  {((hoverData.c - hoverData.o) / hoverData.o * 100).toFixed(3)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM BAR: Coin Switcher + Bot Stats ════════════════════════════ */}
      <div className="bg-[#161a1e] px-4 py-2 flex items-center justify-between border-t border-white/[0.04] shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {activeCoins.map((coin) => {
            const coinData = marketData[coin];
            const change = coinData?.gain;
            return (
              <button
                key={coin}
                onClick={() => setSelectedCoin(coin)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black whitespace-nowrap transition-all ${
                  selectedCoin === coin
                    ? "bg-[#2b3139] text-[#f0b90b] border border-[#f0b90b]/20"
                    : "text-white/25 hover:text-white/50 hover:bg-white/[0.03]"
                }`}
              >
                <span>{coin}</span>
                {coinData?.price && (
                  <span className={`text-[9px] font-mono ${
                    change && change >= 0 ? "text-emerald-400/60" : "text-red-400/60"
                  }`}>
                    {formatPrice(coinData.price, coin)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="hidden md:flex items-center gap-4 text-[9px] font-mono">
          {md?.signal && (
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                md.signal === "BUY" ? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                : md.signal === "SELL" ? "bg-red-400 shadow-[0_0_6px_rgba(248,73,96,0.5)]"
                : "bg-white/20"
              }`} />
              <span className="text-white/30">Signal: <span className="text-white/50 font-bold">{md.signal}</span></span>
            </div>
          )}
          {md?.botStatus && (
            <span className="text-white/20">Bot: <span className="text-amber-400/60 font-bold">{md.botStatus}</span></span>
          )}
          <span className="text-white/15">{relevant.length} candles</span>
        </div>
      </div>
    </div>
  );
}
