import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const config = await prisma.userConfig.findUnique({
      where: { id: "oracle_config" }
    });
    return NextResponse.json(config || {
      feeRecovery: 0.2,
      netTarget: 0.5,
      stopLoss: -1.5,
      allocationPct: 10,
      maxOpenPositions: 5,
      activeCoins: ["BTC", "ETH", "XRP"],
      isAutoTrading: false,
      isLiveMode: false,
      runTimer: 0,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const existing = await prisma.userConfig.findUnique({ where: { id: "oracle_config" } });

    // Handle starting a new timer if isAutoTrading is being turned on
    let autoTradeStartedAt = existing?.autoTradeStartedAt;
    if (body.isAutoTrading === true && !existing?.isAutoTrading) {
      autoTradeStartedAt = new Date();
    } else if (body.isAutoTrading === false) {
      autoTradeStartedAt = null;
    }

    const config = await prisma.userConfig.upsert({
      where: { id: "oracle_config" },
      update: {
        feeRecovery: body.feeRecovery !== undefined ? parseFloat(body.feeRecovery) : (existing?.feeRecovery ?? 0.2),
        netTarget: body.netTarget !== undefined ? parseFloat(body.netTarget) : (existing?.netTarget ?? 0.5),
        stopLoss: body.stopLoss !== undefined ? parseFloat(body.stopLoss) : (existing?.stopLoss ?? -1.5),
        allocationPct: body.allocationPct !== undefined ? parseFloat(body.allocationPct) : (existing?.allocationPct ?? 10),
        maxOpenPositions: body.maxOpenPositions !== undefined ? parseInt(body.maxOpenPositions.toString()) : (existing?.maxOpenPositions ?? 5),
        activeCoins: body.activeCoins || existing?.activeCoins || ["BTC", "ETH", "XRP"],
        isAutoTrading: body.isAutoTrading !== undefined ? body.isAutoTrading : (existing?.isAutoTrading ?? false),
        isLiveMode: body.isLiveMode !== undefined ? body.isLiveMode : (existing?.isLiveMode ?? false),
        runTimer: body.runTimer !== undefined ? parseInt(body.runTimer.toString()) : (existing?.runTimer ?? 0),
        autoTradeStartedAt,
      },
      create: {
        id: "oracle_config",
        feeRecovery: body.feeRecovery !== undefined ? parseFloat(body.feeRecovery) : 0.2,
        netTarget: body.netTarget !== undefined ? parseFloat(body.netTarget) : 0.5,
        stopLoss: body.stopLoss !== undefined ? parseFloat(body.stopLoss) : -1.5,
        allocationPct: body.allocationPct !== undefined ? parseFloat(body.allocationPct) : 10,
        maxOpenPositions: body.maxOpenPositions !== undefined ? parseInt(body.maxOpenPositions.toString()) : 5,
        activeCoins: body.activeCoins || ["BTC", "ETH", "XRP"],
        isAutoTrading: body.isAutoTrading || false,
        isLiveMode: body.isLiveMode || false,
        runTimer: body.runTimer !== undefined ? parseInt(body.runTimer.toString()) : 0,
        autoTradeStartedAt: body.isAutoTrading ? new Date() : null,
      }
    });
    return NextResponse.json(config);
  } catch (error) {
    console.error("Config save error:", error);
    return NextResponse.json({ error: "Failed to update config" }, { status: 500 });
  }
}
