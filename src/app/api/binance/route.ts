import { NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const BASE_URL = "https://api.binance.com";

function generateSignature(queryString: string) {
  return crypto
    .createHmac("sha256", SECRET_KEY!)
    .update(queryString)
    .digest("hex");
}

export async function GET(req: Request) {
  if (!API_KEY || !SECRET_KEY) {
    return NextResponse.json({ error: "API Keys not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "exchangeInfo") {
    try {
      const [infoRes, tickerRes] = await Promise.all([
        fetch(`${BASE_URL}/api/v3/exchangeInfo`),
        fetch(`${BASE_URL}/api/v3/ticker/24hr`)
      ]);
      
      const infoData = await infoRes.json();
      const tickerData = await tickerRes.json();

      if (infoRes.status === 429 || tickerRes.status === 429) {
        console.error("Binance Rate Limited (429)");
        return NextResponse.json({ error: "Rate limited", retryAfter: infoRes.headers.get("Retry-After") }, { status: 429 });
      }

      if (!infoData.symbols || !Array.isArray(tickerData)) {
        console.error("Invalid Binance API Response", { infoData, tickerData });
        return NextResponse.json([], { status: 200 });
      }

      const tickerMap = new Map();
      tickerData.forEach((t: any) => tickerMap.set(t.symbol, t));

      const pairs = infoData.symbols
        .filter((s: any) => s.quoteAsset === "USDT" && s.status === "TRADING")
        .map((s: any) => {
          const ticker = tickerMap.get(s.symbol) || {};
          return {
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            price: ticker.lastPrice || "0",
            gain: ticker.priceChangePercent || "0",
            volume: ticker.quoteVolume || "0",
            high: ticker.highPrice || "0",
            low: ticker.lowPrice || "0",
          };
        });
        
      return NextResponse.json(pairs);
    } catch (e: any) {
      console.error("Binance Market Fetch Error:", e.message);
      return NextResponse.json([], { status: 200 });
    }
  }

  const timestamp = Date.now();
  const queryString = `timestamp=${timestamp}&recvWindow=60000`;
  const signature = generateSignature(queryString);

  try {
    const response = await fetch(`${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`, {
      headers: {
        "X-MBX-APIKEY": API_KEY,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Binance API Error:", data);
      return NextResponse.json(data, { status: response.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Binance Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch account info" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!API_KEY || !SECRET_KEY) {
    return NextResponse.json({ error: "API Keys not configured" }, { status: 500 });
  }

  try {
    const { symbol, side, quantity, usdtAmount } = await req.json();
    const timestamp = Date.now();
    
    // Binance requirements: Symbol must be uppercase, e.g., BTCUSDT
    const pair = `${symbol}USDT`.toUpperCase();
    
    let queryString = `symbol=${pair}&side=${side.toUpperCase()}&type=MARKET&timestamp=${timestamp}&recvWindow=60000`;
    if (side.toUpperCase() === "BUY" && usdtAmount) {
      // Use quoteOrderQty for buys to bypass LOT_SIZE precision math
      queryString += `&quoteOrderQty=${usdtAmount}`;
    } else {
      queryString += `&quantity=${quantity}`;
    }
    
    const signature = generateSignature(queryString);

    const response = await fetch(`${BASE_URL}/api/v3/order?${queryString}&signature=${signature}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": API_KEY,
      },
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
