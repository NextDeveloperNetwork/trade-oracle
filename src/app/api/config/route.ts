import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const config = await prisma.userConfig.findUnique({
      where: { id: "oracle_config" }
    });
    
    return NextResponse.json(config || {
      strategy: "MANUAL_ASSIST",
      timeframe: "1m",
      feeRecovery: 0.2,
      netTarget: 0.5,
      stopLoss: -1.5,
      cooldownMinutes: 15,
      rsiBuyThreshold: 40.0,
      rsiSellThreshold: 60.0,
      allocationPct: 10,
      maxOpenPositions: 100,
      activeCoins: ["BTC", "ETH", "XRP"],
      isPaperAutoTrading: false,
      isLiveAutoTrading: false,
      isLiveMode: false,
      runTimer: 0,
    });
  } catch (error: any) {
    console.error("Config fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const existing = await prisma.userConfig.findUnique({
      where: { id: "oracle_config" }
    });

    // Handle starting a new timer if any auto trading is being turned on
    let autoTradeStartedAt = existing?.autoTradeStartedAt;
    const isNowAutoTrading = body.isPaperAutoTrading === true || body.isLiveAutoTrading === true;
    const wasAutoTrading = existing?.isPaperAutoTrading === true || existing?.isLiveAutoTrading === true;

    if (isNowAutoTrading && !wasAutoTrading) {
      autoTradeStartedAt = new Date();
    } else if (!isNowAutoTrading) {
      autoTradeStartedAt = null;
    }

    const strategy = body.strategy || existing?.strategy || "MANUAL_ASSIST";
    const timeframe = body.timeframe || existing?.timeframe || "1m";
    const feeRecovery = body.feeRecovery !== undefined ? parseFloat(body.feeRecovery) : (existing?.feeRecovery ?? 0.2);
    const netTarget = body.netTarget !== undefined ? parseFloat(body.netTarget) : (existing?.netTarget ?? 0.5);
    const stopLoss = body.stopLoss !== undefined ? parseFloat(body.stopLoss) : (existing?.stopLoss ?? -1.5);
    const cooldownMinutes = body.cooldownMinutes !== undefined ? parseInt(body.cooldownMinutes.toString()) : (existing?.cooldownMinutes ?? 15);
    const rsiBuyThreshold = body.rsiBuyThreshold !== undefined ? parseFloat(body.rsiBuyThreshold) : (existing?.rsiBuyThreshold ?? 40.0);
    const rsiSellThreshold = body.rsiSellThreshold !== undefined ? parseFloat(body.rsiSellThreshold) : (existing?.rsiSellThreshold ?? 60.0);
    const allocationPct = body.allocationPct !== undefined ? parseFloat(body.allocationPct) : (existing?.allocationPct ?? 10);
    const maxOpenPositions = body.maxOpenPositions !== undefined ? parseInt(body.maxOpenPositions.toString()) : (existing?.maxOpenPositions ?? 100);
    const isPaperAutoTrading = body.isPaperAutoTrading !== undefined ? body.isPaperAutoTrading : (existing?.isPaperAutoTrading ?? false);
    const isLiveAutoTrading = body.isLiveAutoTrading !== undefined ? body.isLiveAutoTrading : (existing?.isLiveAutoTrading ?? false);
    const isLiveMode = body.isLiveMode !== undefined ? body.isLiveMode : (existing?.isLiveMode ?? false);
    const runTimer = body.runTimer !== undefined ? parseInt(body.runTimer.toString()) : (existing?.runTimer ?? 0);
    const activeCoins = body.activeCoins || existing?.activeCoins || ["BTC", "ETH", "XRP"];

    const configData = {
      strategy,
      timeframe,
      feeRecovery,
      netTarget,
      stopLoss,
      cooldownMinutes,
      rsiBuyThreshold,
      rsiSellThreshold,
      allocationPct,
      maxOpenPositions,
      isPaperAutoTrading,
      isLiveAutoTrading,
      isLiveMode,
      runTimer,
      autoTradeStartedAt,
      activeCoins,
    };

    const savedConfig = await prisma.userConfig.upsert({
      where: { id: "oracle_config" },
      update: configData,
      create: {
        id: "oracle_config",
        ...configData,
      },
    });

    return NextResponse.json(savedConfig);
  } catch (error: any) {
    console.error("Config save error:", error);
    return NextResponse.json({ error: "Failed to update config", details: error.message }, { status: 500 });
  }
}


