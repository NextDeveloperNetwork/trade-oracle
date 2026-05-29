import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") || "PAPER";
    const trades = await prisma.completedTrade.findMany({
      where: { mode },
      orderBy: { exitTime: "desc" },
      take: 200
    });
    return NextResponse.json(trades);
  } catch (error) {
    console.error("GET completed-trades error:", error);
    return NextResponse.json({ error: "Failed to fetch completed trades" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const trade = await prisma.completedTrade.create({
      data: {
        coin: body.coin,
        entryTime: new Date(body.entryTime),
        exitTime: new Date(),
        entryPrice: parseFloat(body.entryPrice),
        exitPrice: parseFloat(body.exitPrice),
        amount: parseFloat(body.amount),
        invested: parseFloat(body.invested),
        returned: parseFloat(body.returned),
        fee: parseFloat(body.fee || 0),
        profit: parseFloat(body.profit),
        netProfit: parseFloat(body.netProfit || 0),
        profitPct: parseFloat(body.profitPct),
        strategy: body.strategy,
        mode: body.mode || "PAPER",
      }
    });
    return NextResponse.json(trade);
  } catch (error) {
    console.error("POST completed-trades error:", error);
    return NextResponse.json({ error: "Failed to record completed trade" }, { status: 500 });
  }
}
