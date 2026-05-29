import { NextResponse } from "next/server";
import crypto from "crypto";

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const IS_US = process.env.IS_BINANCE_US === "true";
const BASE_URL = IS_US ? "https://api.binance.us" : "https://api.binance.com";

let timeOffset = 0;
let lastOffsetSync = 0;

async function getBinanceTimestamp(): Promise<number> {
  const now = Date.now();
  // Re-sync offset every 30 seconds
  if (now - lastOffsetSync > 30_000) {
    try {
      const res = await fetch(`${BASE_URL}/api/v3/time`);
      const data = await res.json();
      timeOffset = data.serverTime - Date.now();
      lastOffsetSync = Date.now();
    } catch {
      // If sync fails, use last known offset
    }
  }
  return Date.now() + timeOffset;
}

function generateSignature(queryString: string, secret: string) {
  return crypto
    .createHmac("sha256", secret)
    .update(queryString)
    .digest("hex");
}


function authenticate(req: Request) {
  const authHeader = req.headers.get("x-oracle-token");
  const INTERNAL_SECRET = "oracle_default_secret_9988";
  const ok = authHeader === INTERNAL_SECRET;
  if (!ok) console.warn("Unauthorized API attempt detected", { received: authHeader });
  return ok;
}

export async function GET(req: Request) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

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

      if (infoRes.status === 451 || tickerRes.status === 451) {
        return NextResponse.json({
          error: "Vercel Region Blocked: Move your function region to Europe (Frankfurt/London) to use binance.com."
        }, { status: 451 });
      }

      if (infoRes.status === 429 || tickerRes.status === 429) {
        console.error("Binance Rate Limited (429)");
        return NextResponse.json({ error: "Rate limited", retryAfter: infoRes.headers.get("Retry-After") }, { status: 429 });
      }

      const infoData = await infoRes.json();
      const tickerData = await tickerRes.json();

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

          // Extract filters
          const priceFilter = s.filters.find((f: any) => f.filterType === "PRICE_FILTER");
          const lotSizeFilter = s.filters.find((f: any) => f.filterType === "LOT_SIZE");
          const notionalFilter = s.filters.find((f: any) => f.filterType === "NOTIONAL") ||
            s.filters.find((f: any) => f.filterType === "MIN_NOTIONAL");

          return {
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            price: ticker.lastPrice || "0",
            gain: ticker.priceChangePercent || "0",
            volume: ticker.quoteVolume || "0",
            high: ticker.highPrice || "0",
            low: ticker.lowPrice || "0",
            filters: {
              tickSize: priceFilter?.tickSize || "0.01",
              stepSize: lotSizeFilter?.stepSize || "0.01",
              minQty: lotSizeFilter?.minQty || "0.01",
              minNotional: notionalFilter?.minNotional || notionalFilter?.notional || "10.0"
            }
          };
        });

      return NextResponse.json(pairs);
    } catch (e: any) {
      console.error("Binance Market Fetch Error:", e.message);
      return NextResponse.json([], { status: 200 });
    }
  }

  if (type === "klines") {
    const symbol = searchParams.get("symbol") || "BTCUSDT";
    const interval = searchParams.get("interval") || "1h";
    const limit = searchParams.get("limit") || "100";
    try {
      const res = await fetch(`${BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e: any) {
      console.error("Klines Fetch Error:", e.message);
      return NextResponse.json({ error: "Failed to fetch klines" }, { status: 500 });
    }
  }

  const timestamp = await getBinanceTimestamp();
  const queryString = `timestamp=${timestamp}&recvWindow=5000`;
  const signature = generateSignature(queryString, SECRET_KEY);

  try {
    const response = await fetch(`${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`, {
      headers: {
        "X-MBX-APIKEY": API_KEY,
      },
    });

    if (response.status === 451) {
      return NextResponse.json({
        error: "Binance blocked this request because your Vercel server is in a restricted region (e.g. USA). Move your Vercel Function region to Europe (Frankfurt or London) in Project Settings."
      }, { status: 451 });
    }

    const data = await response.json();
    if (!response.ok) {
      console.error("Binance API Error:", data);
      return NextResponse.json(data, { status: response.status });
    }

    // Security: Only return balances to the frontend, not full account metadata
    return NextResponse.json({
      balances: data.balances || [],
      accountType: data.accountType
    });
  } catch (error) {
    console.error("Binance Fetch Error:", error);
    return NextResponse.json({ error: "Failed to fetch account info" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  if (!API_KEY || !SECRET_KEY) {
    return NextResponse.json({ error: "API Keys not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { symbol, side, quantity, usdtAmount } = body;

    // 1. STRICT VALIDATION
    if (!["BUY", "SELL"].includes(side?.toUpperCase())) {
      return NextResponse.json({ error: "Invalid trading side" }, { status: 400 });
    }
    if (typeof symbol !== "string" || !/^[A-Z0-9]{2,12}$/.test(symbol.toUpperCase())) {
      return NextResponse.json({ error: "Invalid symbol format" }, { status: 400 });
    }

    const timestamp = await getBinanceTimestamp();
    const upperSym = symbol.toUpperCase();
    const pair = upperSym.endsWith("USDT") ? upperSym : `${upperSym}USDT`;

    let queryString = `symbol=${pair}&side=${side.toUpperCase()}&type=MARKET&timestamp=${timestamp}&recvWindow=5000`;
    if (side.toUpperCase() === "BUY" && usdtAmount) {
      queryString += `&quoteOrderQty=${usdtAmount}`;
    } else {
      queryString += `&quantity=${quantity}`;
    }

    const signature = generateSignature(queryString, SECRET_KEY);

    const response = await fetch(`${BASE_URL}/api/v3/order?${queryString}&signature=${signature}`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Binance Order Error:", { status: response.status, data });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Route POST error:", error.message);
    return NextResponse.json({ error: "Failed to place order" }, { status: 500 });
  }
}
