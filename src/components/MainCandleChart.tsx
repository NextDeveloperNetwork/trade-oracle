"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion as m, AnimatePresence } from "framer-motion";
import { useTradingEngine, Candle } from "@/context/TradingContext";
import { Activity, ChevronDown, TrendingUp, TrendingDown, Zap, Target, BarChart2 } from "lucide-react";

// ─── Binance Pro Palette ─────────────────────────────────────────────────────
const COL = {
  GREEN: "#00ff9d",
  RED: "#ff3e60",
  MA7: "#ffd900",
  MA25: "#00d4ff",
  MA99: "#9d00ff",
  BG: "#07080d",
  HUD: "#0d111b",
  ACCENT: "#f0b90b",
  GRID: "rgba(255,255,255,0.03)",
  CROSSHAIR: "rgba(255,255,255,0.15)",
  TEXT: "rgba(255,255,255,0.6)",
};

const getDecimals = (coin: string) => {
  if (["BTC", "ETH"].includes(coin)) return 2;
  if (["XRP", "ADA", "DUSK", "CELR", "DOGE"].includes(coin)) return 4;
  return 6;
};

const formatPrice = (p: number | undefined, coin: string) => {
  if (p === undefined || p === null) return "--";
  return p.toLocaleString("en-US", {
    minimumFractionDigits: getDecimals(coin),
    maximumFractionDigits: getDecimals(coin),
  });
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function MainCandleChart() {
  const { marketData, activeCoins, tradeHistory, openPositions, currentStrategy, selectedCoin, setSelectedCoin } = useTradingEngine();
  const [isMounted, setIsMounted] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [showCoinDrop, setShowCoinDrop] = useState(false);
  const [chartInterval, setChartInterval] = useState<string>("1s");
  const [histData, setHistData] = useState<Candle[]>([]);
  const [isLoadingHist, setIsLoadingHist] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    
    const handleClickOutside = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowCoinDrop(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (chartInterval === "1s") {
      setHistData([]);
      return;
    }

    const fetchHistory = async () => {
      setIsLoadingHist(true);
      try {
        const symbol = selectedCoin.endsWith("USDT") ? selectedCoin : `${selectedCoin}USDT`;
        const res = await fetch(`/api/binance?type=klines&symbol=${symbol}&interval=${chartInterval}&limit=100`, {
          headers: { "x-oracle-token": "oracle_default_secret_9988" }
        });
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: Candle[] = data.map(k => ({
            t: k[0],
            o: parseFloat(k[1]),
            h: parseFloat(k[2]),
            l: parseFloat(k[3]),
            c: parseFloat(k[4]),
            v: parseFloat(k[5])
          }));
          setHistData(mapped);
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setIsLoadingHist(false);
      }
    };

    fetchHistory();
    const id = setInterval(fetchHistory, 60000); // refresh every minute
    return () => clearInterval(id);
  }, [selectedCoin, chartInterval]);

  const md = marketData[selectedCoin];
  const history = useMemo(() => {
    if (chartInterval === "1s") return md?.candleHistory || [];
    return histData;
  }, [chartInterval, md?.candleHistory, histData]);

  const relevant = useMemo(() => history.slice(-100), [history]);

  // ─── Technical Indicators ──────────────────────────────────────────────────
  const calcMA = (data: Candle[], period: number) =>
    data.map((_, i) =>
      i < period - 1
        ? null
        : data.slice(i - period + 1, i + 1).reduce((s, c) => s + c.c, 0) / period
    );

  const ma7 = useMemo(() => calcMA(relevant, 7), [relevant]);
  const ma25 = useMemo(() => calcMA(relevant, 25), [relevant]);
  const ma99 = useMemo(() => calcMA(relevant, 99), [relevant]);

  const bb = useMemo(() => {
    const period = 20;
    return relevant.map((_, i) => {
      if (i < period - 1) return null;
      const slice = relevant.map(c => c.c).slice(Math.max(0, i - period + 1), i + 1);
      const m = slice.reduce((s, v) => s + v, 0) / period;
      const s = Math.sqrt(slice.reduce((acc, v) => acc + (v - m) ** 2, 0) / period);
      return { m, u: m + 2 * s, l: m - 2 * s };
    });
  }, [relevant]);

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

  if (selectedCoin === "USDT") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#0b0e11] rounded-2xl border border-white/5">
        <BarChart2 size={32} className="text-white/10" />
        <span className="text-[10px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          Stablecoin Base - Select an Asset to View Chart
        </span>
      </div>
    );
  }

  if (relevant.length === 0 || isLoadingHist) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#0b0e11] rounded-2xl border border-white/5">
        <Activity size={32} className="text-white/10 animate-pulse" />
        <span className="text-[10px] font-mono font-black text-white/20 uppercase tracking-[0.2em]">
          {isLoadingHist ? `Loading ${chartInterval} History…` : "Connecting to Binance Stream…"}
        </span>
      </div>
    );
  }

  // ─── Position & Trade Data ────────────────────────────────────────────────
  const myPos = openPositions.find((p) => p.coin === selectedCoin);
  const myTrades = tradeHistory.filter((t) => t.coin === selectedCoin);

  // ─── Chart Geometry ────────────────────────────────────────────────────────
  const width = chartRef.current?.clientWidth || 800;
  const height = 440;
  const PAD = { top: 10, bottom: 70, right: 65, left: 0 };
  const chartH = height - PAD.top - PAD.bottom;
  const chartW = width - PAD.right - PAD.left;

  const validCandles = relevant.filter(c => 
    typeof c.o === 'number' && !isNaN(c.o) &&
    typeof c.c === 'number' && !isNaN(c.c) &&
    typeof c.h === 'number' && !isNaN(c.h) &&
    typeof c.l === 'number' && !isNaN(c.l) &&
    typeof c.v === 'number' && !isNaN(c.v)
  );

  const displayCandles = validCandles;
  const candleCount = displayCandles.length;
  const candleW = Math.max(4, chartW / Math.max(1, candleCount));
  const volZoneH = 60; 

  let min = candleCount > 0 ? Math.min(...displayCandles.map((c) => c.l)) : 0;
  let max = candleCount > 0 ? Math.max(...displayCandles.map((c) => c.h)) : 100;

  // Include entry price in chart range if a position is open
  if (myPos && myPos.entryPrice > 0) {
    min = Math.min(min, myPos.entryPrice * 0.995); // Add 0.5% padding
    max = Math.max(max, myPos.entryPrice * 1.005);
  }

  const range = (max - min) || 1;
  const maxVol = candleCount > 0 ? Math.max(...displayCandles.map((c) => c.v)) : 1;

  const getX = (i: number) => PAD.left + i * candleW;
  const getY = (p: number) => {
    const y = PAD.top + ((max - p) / range) * chartH;
    return isNaN(y) ? 0 : y;
  };

  const lastCandle = displayCandles[candleCount - 1] || { o: 0, c: 0, h: 0, l: 0, v: 0, t: Date.now() };
  const hoverData = hoverIdx !== null && hoverIdx < candleCount ? displayCandles[hoverIdx] : null;
  const displayData = hoverData || lastCandle;
  const isDisplayUp = displayData.c >= displayData.o;

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
    <div className="glass-panel h-full rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl relative border border-white/[0.05]">
        {/* ═══ HEADER BAR ═══════════════════════════════════════════════════════ */}
        <div className="px-6 py-3 border-b border-white/[0.04] flex items-center justify-between bg-black/40 backdrop-blur-3xl z-50 shrink-0">
          <div className="flex items-center gap-6">
            <div className="relative" ref={dropRef}>
              <div 
                className="flex items-center gap-3 cursor-pointer group hover:bg-white/5 py-1 px-3 rounded-xl transition-all"
                onClick={() => setShowCoinDrop(!showCoinDrop)}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                   <Target size={14} className="text-indigo-400" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[14px] font-black text-white tracking-tight leadng-none">{selectedCoin}/USDT</span>
                   <span className="text-[9px] font-mono font-bold text-white/30 uppercase tracking-widest">{chartInterval} TERM</span>
                </div>
                <ChevronDown size={14} className={`text-white/20 transition-transform ${showCoinDrop ? 'rotate-180' : ''}`} />
              </div>

              <AnimatePresence>
                {showCoinDrop && (
                  <m.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 mt-3 w-72 bg-[#0b0e14] border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-2 z-[100] backdrop-blur-3xl"
                  >
                    <div className="p-3 mb-2 border-b border-white/5 flex items-center justify-between">
                       <span className="text-[10px] font-black text-white/40 uppercase tracking-tighter">Switch Asset Bridge</span>
                       <span className="text-[9px] font-mono text-white/20">{activeCoins.length} ACTIVE</span>
                    </div>
                    <div className="max-h-[350px] overflow-y-auto custom-scrollbar flex flex-col gap-1">
                      {activeCoins.map(coin => (
                        <button
                          key={coin}
                          onClick={() => { setSelectedCoin(coin); setShowCoinDrop(false); }}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                            selectedCoin === coin ? "bg-indigo-500/20 text-indigo-400" : "text-white/40 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <div className="flex flex-col items-start">
                            <span className="text-[12px] font-black uppercase">{coin}</span>
                            <span className="text-[8px] font-mono opacity-40">ORACLE_READY</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold">${marketData[coin]?.price?.toLocaleString() || '—'}</span>
                        </button>
                      ))}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-10 w-[1px] bg-white/5" />

            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className={`text-[18px] font-black font-mono leading-none ${isDisplayUp ? "text-[#00ff9d]" : "text-[#ff3e60]"}`}>
                  {formatPrice(displayData.c, selectedCoin)}
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-black font-mono ${sessionChange >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {sessionChange >= 0 ? "+" : ""}{sessionChange.toFixed(2)}%
                  </span>
                  <span className="text-[9px] font-mono text-white/10 uppercase tracking-tighter">Session Delta</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Timeframes */}
            <div className="flex items-center bg-white/[0.03] p-1 rounded-xl border border-white/[0.05] overflow-x-auto no-scrollbar max-w-[280px]">
              {["1s", "5m", "15m", "1h", "4h", "1d", "1w", "1M", "1Y"].map(tf => (
                <button
                  key={tf}
                  onClick={() => setChartInterval(tf === "1Y" ? "1M" : tf)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex-shrink-0 ${
                    chartInterval === (tf === "1Y" ? "1M" : tf) 
                      ? "bg-white text-black shadow-xl" 
                      : "text-white/20 hover:text-white/50"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {currentRSI !== null && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.05] text-[10px] font-black font-mono">
                  <Zap size={10} className={currentRSI > 70 ? "text-red-400" : currentRSI < 30 ? "text-emerald-400" : "text-white/30"} />
                  <span className="text-white/40">RSI</span>
                  <span className={currentRSI > 70 ? "text-red-400" : currentRSI < 30 ? "text-emerald-400" : "text-white"}>{currentRSI.toFixed(1)}</span>
                </div>
              )}
              {md?.signal && md.signal !== "HOLD" && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase animate-pulse border ${
                  md.signal === "BUY" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                }`}>
                  <Activity size={10} />
                  {md.signal} TARGET
                </div>
              )}
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
          {displayCandles.map((c, i) => {
            const x = getX(i);
            const isUp = c.c >= c.o;
            const volH = maxVol > 0 ? Math.max(1, (c.v / maxVol) * volZoneH) : 0;
            if (isNaN(volH)) return null;
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

          {/* ── EMA Ribbon ────────────────────────────────────────────── */}
          <polyline
            fill="none" stroke={COL.MA7} strokeWidth="1.2" strokeLinejoin="round" opacity={0.6}
            points={maPath(ma7)}
          />
          <polyline
            fill="none" stroke={COL.MA25} strokeWidth="1.2" strokeLinejoin="round" opacity={0.4}
            points={maPath(ma25)}
          />
          <polyline
            fill="none" stroke={COL.MA99} strokeWidth="1.2" strokeLinejoin="round" opacity={0.3}
            points={maPath(ma99)}
          />

          {/* ── Candlesticks (Cyber Theme) ────────────────────────────── */}
          {displayCandles.map((c, i) => {
            const x = getX(i);
            const isUp = c.c >= c.o;
            const color = isUp ? COL.GREEN : COL.RED;
            const yO = getY(c.o);
            const yC = getY(c.c);
            const bodyY = Math.min(yO, yC);
            const bodyH = Math.max(1.5, Math.abs(yO - yC));
            const isHovered = hoverIdx === i;

            return (
              <g key={`candle-${i}`}>
                <line
                  x1={x + candleW / 2} y1={getY(c.h)}
                  x2={x + candleW / 2} y2={getY(c.l)}
                  stroke={color} strokeWidth={isHovered ? 2 : 0.8}
                  opacity={isHovered ? 1 : 0.3}
                />
                <rect
                  x={x + 1.5} y={bodyY}
                  width={Math.max(1, candleW - 3)} height={bodyH}
                  fill={isUp ? "transparent" : color}
                  stroke={color} strokeWidth={isHovered ? 2 : 1}
                  rx={0.5}
                />
                {isHovered && (
                  <rect
                    x={x - 2} y={bodyY - 4}
                    width={candleW + 4} height={bodyH + 8}
                    fill={color} opacity={0.1} rx={4}
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
          {displayCandles.map((c, i) => {
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

          {/* ── Bollinger Bands ────────────────────────────────────────── */}
          <path
            fill="rgba(56, 189, 248, 0.03)"
            stroke="rgba(56, 189, 248, 0.15)"
            strokeWidth="0.5"
            d={(() => {
              const upper = bb.map((v, i) => v ? `${getX(i) + candleW / 2},${getY(v.u)}` : "").filter(Boolean);
              const lower = bb.map((v, i) => v ? `${getX(i) + candleW / 2},${getY(v.l)}` : "").filter(Boolean).reverse();
              if (upper.length === 0) return "";
              return `M ${upper.join(" L ")} L ${lower.join(" L ")} Z`;
            })()}
          />

          {/* ── Neural Prediction Cone (Enhanced) ─────────────────────── */}
          {(() => {
            const lookback = 12;
            const slice = relevant.slice(-lookback);
            if (slice.length < lookback) return null;
            
            const avgY = slice.reduce((acc, c) => acc + c.c, 0) / lookback;
            const avgX = lookback / 2;
            let num = 0, den = 0;
            slice.forEach((c, i) => {
              num += (i - avgX) * (c.c - avgY);
              den += (i - avgX) * (i - avgX);
            });
            const m = den === 0 ? 0 : num / den; 
            
            const x1 = getX(relevant.length - 1) + candleW/2;
            const y1 = getY(lastCandle.c);
            const steps = 10;
            const x2 = x1 + (candleW * steps);
            const y2 = getY(lastCandle.c + (m * steps));

            // Standard deviation for cone width
            const s = Math.sqrt(slice.reduce((acc, c) => acc + (c.c - (lastCandle.c + m * (slice.indexOf(c) - 11))) ** 2, 0) / lookback);
            const coneWidth = getY(lastCandle.c - s * 3) - getY(lastCandle.c + s * 3);

            return (
              <g>
                <defs>
                  <linearGradient id="predGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f87171" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Probability Cone */}
                <path 
                  d={`M ${x1},${y1} L ${x2},${y2 - coneWidth/2} L ${x2},${y2 + coneWidth/2} Z`}
                  fill="url(#predGrad)"
                />
                <line 
                  x1={x1} y1={y1} x2={x2} y2={y2} 
                  stroke="#f87171" strokeWidth="1.5" strokeDasharray="4 4" 
                  className="animate-pulse"
                />
                <circle cx={x2} cy={y2} r={3} fill="#f87171" className="animate-ping" />
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
                  {hoverData.v && hoverData.v > 1000 ? (hoverData.v / 1000).toFixed(1) + "K" : (hoverData.v || 0).toFixed(2)}
                </span>
              </div>
              <div className="col-span-2 flex justify-between gap-3">
                <span className="text-white/20">Change</span>
                <span className={`font-bold ${hoverData.c >= hoverData.o ? "text-emerald-400" : "text-red-400"}`}>
                  {hoverData.o > 0 ? ((hoverData.c - hoverData.o) / hoverData.o * 100).toFixed(3) : "0.000"}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM BAR: Coin Switcher + Bot Stats ════════════════════════════ */}
      <div className="bg-white/[0.02] px-6 py-3 flex items-center justify-between border-t border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {activeCoins.map((coin) => {
            const coinData = marketData[coin];
            const change = coinData?.gain;
            return (
              <button
                key={coin}
                onClick={() => setSelectedCoin(coin)}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl text-[10px] font-black whitespace-nowrap transition-all ${
                  selectedCoin === coin
                    ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                    : "text-white/20 hover:text-white/50 bg-white/[0.02] border border-white/[0.03]"
                }`}
              >
                <span>{coin}</span>
                {coinData?.price && (
                  <span className={`text-[9px] font-mono font-bold ${
                    change && change >= 0 ? "text-emerald-400" : "text-red-400"
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
