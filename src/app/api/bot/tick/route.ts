import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateStrategySignal } from "@/lib/strategies";
import { placeBinanceOrder, getBinanceAccountBalances, BASE_URL } from "@/lib/binance";

const INTERNAL_SECRET = "oracle_default_secret_9988";

export async function GET(req: Request) {
  // 1. Authorization (Permit Vercel Cron, GitHub Actions, or internal token)
  const authHeader = req.headers.get("x-oracle-token") || req.headers.get("Authorization")?.replace("Bearer ", "");
  const cronSecret = process.env.CRON_SECRET;
  
  const isAuthorized =
    !cronSecret ||
    authHeader === cronSecret ||
    authHeader === INTERNAL_SECRET ||
    process.env.NODE_ENV !== "production";

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized access to bot tick" }, { status: 401 });
  }

  try {
    // 2. Fetch Global Config
    const config = await prisma.userConfig.findUnique({ where: { id: "oracle_config" } });
    const isAutoTrading = config?.isLiveMode ? config?.isLiveAutoTrading : config?.isPaperAutoTrading;
    if (!config || !isAutoTrading) {
      return NextResponse.json({ status: "Bot is dormant", isAutoTrading: false });
    }

    // 3. Time Protection
    if (config.runTimer > 0 && config.autoTradeStartedAt) {
      const elapsedMs = Date.now() - new Date(config.autoTradeStartedAt).getTime();
      const durationMs = config.runTimer * 60 * 60 * 1000; // runTimer in hours
      if (elapsedMs > durationMs) {
        // Stop the bot!
        await prisma.userConfig.update({
          where: { id: "oracle_config" },
          data: { 
            isPaperAutoTrading: false, 
            isLiveAutoTrading: false, 
            autoTradeStartedAt: null 
          }
        });
        return NextResponse.json({ status: "Bot timer expired. Shutting down.", isAutoTrading: false });
      }
    }

    const {
      isLiveMode,
      activeCoins,
      strategy = "ORACLE_ELITE",
      timeframe = "1m",
      feeRecovery = 0.2,
      netTarget = 0.5,
      stopLoss = -1.5,
      cooldownMinutes = 15,
      rsiBuyThreshold = 40.0,
      rsiSellThreshold = 60.0,
      allocationPct = 10,
      maxOpenPositions = 100
    } = config;
    const mode = isLiveMode ? "LIVE" : "PAPER";

    // 4. Fetch Current Positions & Recent Liquidations (for Cooldown Guard)
    const cooldownCutoff = new Date(Date.now() - cooldownMinutes * 60 * 1000);
    const [openPositions, recentLiquidations] = await Promise.all([
      prisma.position.findMany({ where: { mode } }),
      prisma.completedTrade.findMany({
        where: {
          mode,
          exitTime: { gte: cooldownCutoff },
          profitPct: { lt: 0 } // Loss exits
        }
      })
    ]);

    const cooldownCoinSet = new Set(recentLiquidations.map((t: any) => t.coin));
    
    // Fetch live USDT balance if live mode is enabled
    let liveUsdtAvailable = 0;
    if (isLiveMode) {
      try {
        const balances = await getBinanceAccountBalances();
        const usdtObj = balances.find((b) => b.asset === "USDT");
        liveUsdtAvailable = usdtObj ? parseFloat(usdtObj.free) : 0;
      } catch (err: any) {
        console.error("Failed to fetch live Binance USDT balance:", err.message);
      }
    }

    // 5. Parallel Klines Processing
    const candlePromises = (activeCoins as string[]).map(async (coin: string) => {
      const symbol = `${coin}USDT`;
      try {
        const res = await fetch(`${BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=50`, { cache: "no-store" });
        if (!res.ok) return { coin, error: `Kline fetch failed (HTTP ${res.status})` };
        const data = await res.json();
        if (!Array.isArray(data)) return { coin, error: "Invalid klines array" };

        const candles = data.map((d: any[]) => ({
          t: d[0], o: parseFloat(d[1]), h: parseFloat(d[2]), l: parseFloat(d[3]), c: parseFloat(d[4]), v: parseFloat(d[5])
        }));
        return { coin, candles };
      } catch (err: any) {
        return { coin, error: err.message || "Network error fetching candles" };
      }
    });

    const candleResults = await Promise.allSettled(candlePromises);
    const results: any[] = [];
    let currentOpenCount = openPositions.length;

    // Track available USDT across the tick loop to prevent over-allocation
    let currentUsdtAvailable = 0;
    if (isLiveMode) {
      currentUsdtAvailable = liveUsdtAvailable;
    } else {
      const paperBal = await prisma.paperBalance.findUnique({ where: { asset: "USDT" } });
      currentUsdtAvailable = paperBal?.amount || 0;
    }

    for (let i = 0; i < candleResults.length; i++) {
      const candleRes = candleResults[i];
      const coin = activeCoins[i];

      if (candleRes.status === "rejected" || !candleRes.value || candleRes.value.error || !candleRes.value.candles) {
        const errMsg = candleRes.status === "rejected" ? candleRes.reason?.message : candleRes.value?.error;
        results.push({ coin, error: errMsg || "Failed to load candles" });
        continue;
      }

      const { candles } = candleRes.value;
      const currentPrice = candles[candles.length - 1].c;
      const position = openPositions.find((p: any) => p.coin === coin);
      const hasPos = !!position;

      // Strategy evaluation
      const evalResult = evaluateStrategySignal(strategy, candles, currentPrice, {
        rsiBuyThreshold,
        rsiSellThreshold,
        feeRecovery,
        netTarget,
        stopLoss,
        position: position ? {
          entryPrice: position.entryPrice,
          amount: position.amount,
          invested: position.invested
        } : undefined
      });

      // ── EXECUTION DISPATCH ──
      try {
        if (evalResult.signal === "BUY" && !hasPos) {
          // Cooldown check
          if (cooldownCoinSet.has(coin)) {
            results.push({
              coin,
              signal: "BUY BLOCKED (COOLDOWN)",
              reason: `Recent stop-loss liquidation within last ${cooldownMinutes} minutes. Cooling down.`
            });
            continue;
          }

          if (currentOpenCount >= maxOpenPositions) {
            results.push({ coin, signal: "BUY SKIPPED", reason: `Max slots ceiling reached (${maxOpenPositions})` });
            continue;
          }

          const allocation = currentUsdtAvailable * (allocationPct / 100);
          const tradeSize = Math.max(11.0, allocation);

          if (currentUsdtAvailable < tradeSize) {
            results.push({
              coin,
              signal: "BUY FAILED",
              reason: `Insufficient USDT balance ($${currentUsdtAvailable.toFixed(2)} < $${tradeSize.toFixed(2)})`
            });
            continue;
          }

          await executeTickTrade("BUY", coin, tradeSize, currentPrice, mode, config);
          currentUsdtAvailable = Math.max(0, currentUsdtAvailable - tradeSize);
          currentOpenCount++;
          results.push({ coin, signal: "BUY EXECUTED", price: currentPrice, strategy, reason: evalResult.reason });

        } else if (evalResult.signal === "SELL" && hasPos && position) {
          await executeTickTrade("SELL", coin, 0, currentPrice, mode, config, position);
          currentOpenCount = Math.max(0, currentOpenCount - 1);
          currentUsdtAvailable += position.amount * currentPrice;
          results.push({ coin, signal: "SELL EXECUTED", price: currentPrice, strategy, reason: evalResult.reason });

        } else {
          results.push({ coin, signal: evalResult.signal, price: currentPrice, strategy, reason: evalResult.reason });
        }
      } catch (tradeErr: any) {
        console.error(`Trade execution error for ${coin}:`, tradeErr.message);
        results.push({ coin, signal: "EXECUTION ERROR", error: tradeErr.message });
      }
    }

    return NextResponse.json({
      status: "Tick completed",
      time: new Date().toISOString(),
      strategy,
      timeframe,
      results
    });

  } catch (err: any) {
    console.error("Bot Tick Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

async function executeTickTrade(action: "BUY" | "SELL", coin: string, usdtAmount: number, price: number, mode: string, config: any, pos?: any) {
  const isLive = mode === "LIVE";
  const activeStrategy = config?.strategy || "ORACLE_ELITE";
  
  if (action === "BUY") {
    if (isLive) {
      // LIVE BUY via Binance API
      const binanceRes = await placeBinanceOrder({
        symbol: `${coin}USDT`,
        side: "BUY",
        type: "MARKET",
        usdtAmount
      });

      const executedQty = parseFloat(binanceRes.executedQty || "0");
      const cumulativeQuoteQty = parseFloat(binanceRes.cummulativeQuoteQty || usdtAmount.toString());
      const avgPrice = executedQty > 0 ? cumulativeQuoteQty / executedQty : price;

      await prisma.$transaction([
        prisma.position.upsert({
          where: { coin_mode: { coin, mode: "LIVE" } },
          update: { entryPrice: avgPrice, amount: executedQty, invested: cumulativeQuoteQty, strategy: activeStrategy },
          create: { coin, entryPrice: avgPrice, amount: executedQty, invested: cumulativeQuoteQty, mode: "LIVE", strategy: activeStrategy }
        }),
        prisma.trade.create({
          data: { coin, action: "BUY", amount: executedQty, price: avgPrice, totalUSDT: cumulativeQuoteQty, mode: "LIVE", strategy: activeStrategy }
        })
      ]);
    } else {
      // PAPER BUY
      const feeRate = (config.feeRecovery ?? 0.2) / 200;
      const feeAmount = usdtAmount * feeRate;
      const netUsdt = usdtAmount - feeAmount;
      const finalAmount = netUsdt / price;

      await prisma.$transaction([
        prisma.paperBalance.update({ where: { asset: "USDT" }, data: { amount: { decrement: usdtAmount } } }),
        prisma.paperBalance.upsert({ 
          where: { asset: coin }, 
          update: { amount: { increment: finalAmount } }, 
          create: { asset: coin, amount: finalAmount } 
        }),
        prisma.position.upsert({
          where: { coin_mode: { coin, mode: "PAPER" } },
          update: { entryPrice: price, amount: finalAmount, invested: usdtAmount, strategy: activeStrategy },
          create: { coin, entryPrice: price, amount: finalAmount, invested: usdtAmount, mode: "PAPER", strategy: activeStrategy }
        }),
        prisma.trade.create({
          data: { coin, action: "BUY", amount: finalAmount, price, totalUSDT: usdtAmount, mode: "PAPER", strategy: activeStrategy }
        })
      ]);
    }
  } else {
    // SELL
    const sellAmount = pos.amount;
    const returnedEstimate = sellAmount * price;
    const feeRate = (config.feeRecovery ?? 0.2) / 200;
    const invested = pos.invested;

    if (isLive) {
      // LIVE SELL via Binance API
      const binanceRes = await placeBinanceOrder({
        symbol: `${coin}USDT`,
        side: "SELL",
        type: "MARKET",
        quantity: sellAmount
      });

      const executedQty = parseFloat(binanceRes.executedQty || sellAmount.toString());
      const cumulativeQuoteQty = parseFloat(binanceRes.cummulativeQuoteQty || returnedEstimate.toString());
      const avgExitPrice = executedQty > 0 ? cumulativeQuoteQty / executedQty : price;
      const fee = cumulativeQuoteQty * feeRate;
      const profit = cumulativeQuoteQty - invested;

      await prisma.$transaction([
        prisma.position.deleteMany({ where: { coin, mode: "LIVE" } }),
        prisma.completedTrade.create({
          data: {
            coin,
            entryTime: pos.entryTime,
            entryPrice: pos.entryPrice,
            exitPrice: avgExitPrice,
            amount: executedQty,
            invested,
            returned: cumulativeQuoteQty,
            fee,
            profit,
            netProfit: profit - fee,
            profitPct: invested > 0 ? ((profit - fee) / invested) * 100 : 0,
            mode: "LIVE",
            strategy: activeStrategy
          }
        }),
        prisma.trade.create({
          data: { coin, action: "SELL", amount: executedQty, price: avgExitPrice, totalUSDT: cumulativeQuoteQty, mode: "LIVE", strategy: activeStrategy }
        })
      ]);
    } else {
      // PAPER SELL
      const returned = sellAmount * price;
      const fee = (invested + returned) * feeRate;
      const profit = returned - invested;

      await prisma.$transaction([
        prisma.paperBalance.update({ where: { asset: "USDT" }, data: { amount: { increment: returned } } }),
        prisma.paperBalance.update({ where: { asset: coin }, data: { amount: 0 } }),
        prisma.position.deleteMany({ where: { coin, mode: "PAPER" } }),
        prisma.completedTrade.create({
          data: {
            coin, entryTime: pos.entryTime, entryPrice: pos.entryPrice, exitPrice: price,
            amount: sellAmount, invested, returned, fee, profit, netProfit: profit - fee,
            profitPct: invested > 0 ? ((profit - fee) / invested) * 100 : 0, mode: "PAPER", strategy: activeStrategy
          }
        }),
        prisma.trade.create({
          data: { coin, action: "SELL", amount: sellAmount, price, totalUSDT: returned, mode: "PAPER", strategy: activeStrategy }
        })
      ]);
    }
  }
}

