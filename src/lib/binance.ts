import crypto from "crypto";

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;
const IS_US = process.env.IS_BINANCE_US === "true";
export const BASE_URL = IS_US ? "https://api.binance.us" : "https://api.binance.com";

// Time offset management
let timeOffset = 0;
let lastOffsetSync = 0;

/**
 * Synchronizes local system time with Binance server time to avoid -1021 INVALID_TIMESTAMP errors.
 */
export async function getBinanceTimestamp(): Promise<number> {
  const now = Date.now();
  if (now - lastOffsetSync > 30_000) {
    try {
      const res = await fetch(`${BASE_URL}/api/v3/time`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        timeOffset = data.serverTime - Date.now();
        lastOffsetSync = Date.now();
      }
    } catch {
      // Use last known offset if sync fails
    }
  }
  return Date.now() + timeOffset;
}

/**
 * Generates an HMAC SHA256 signature for Binance API authentication.
 */
export function generateSignature(queryString: string, secret: string = SECRET_KEY || ""): string {
  return crypto.createHmac("sha256", secret).update(queryString).digest("hex");
}

// In-memory cache for exchange filters (refreshed every 10 minutes)
export interface SymbolFilters {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  tickSize: string;
  stepSize: string;
  minQty: string;
  maxQty: string;
  minNotional: string;
}

let filtersCache: Map<string, SymbolFilters> = new Map();
let lastFilterFetch = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Retrieves exchange metadata & trading filters for a given symbol.
 */
export async function getSymbolFilters(symbol: string): Promise<SymbolFilters | null> {
  const now = Date.now();
  const upperSymbol = symbol.toUpperCase();

  if (filtersCache.has(upperSymbol) && now - lastFilterFetch < CACHE_TTL_MS) {
    return filtersCache.get(upperSymbol) || null;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/v3/exchangeInfo?symbol=${upperSymbol}`, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 451) {
        throw new Error("Vercel Region Blocked (451): Binance API is blocked in US regions. Use a European region (Frankfurt/London).");
      }
      if (res.status === 429) {
        throw new Error("Binance Rate Limited (429). Please wait before retrying.");
      }
      return null;
    }

    const data = await res.json();
    const symbolInfo = data.symbols?.[0];
    if (!symbolInfo) return null;

    const priceFilter = symbolInfo.filters.find((f: any) => f.filterType === "PRICE_FILTER");
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === "LOT_SIZE");
    const notionalFilter =
      symbolInfo.filters.find((f: any) => f.filterType === "NOTIONAL") ||
      symbolInfo.filters.find((f: any) => f.filterType === "MIN_NOTIONAL");

    const parsedFilters: SymbolFilters = {
      symbol: symbolInfo.symbol,
      baseAsset: symbolInfo.baseAsset,
      quoteAsset: symbolInfo.quoteAsset,
      tickSize: priceFilter?.tickSize || "0.01",
      stepSize: lotSizeFilter?.stepSize || "0.00001",
      minQty: lotSizeFilter?.minQty || "0.00001",
      maxQty: lotSizeFilter?.maxQty || "9000000.0",
      minNotional: notionalFilter?.minNotional || notionalFilter?.notional || "10.0",
    };

    filtersCache.set(upperSymbol, parsedFilters);
    lastFilterFetch = now;
    return parsedFilters;
  } catch (error: any) {
    console.error(`Error fetching Binance filters for ${symbol}:`, error.message);
    return null;
  }
}

/**
 * Calculates the number of decimal places represented by a step or tick string (e.g. "0.00100" -> 3).
 */
export function getPrecision(incrementStr: string): number {
  const numStr = parseFloat(incrementStr).toString();
  if (numStr.includes(".")) {
    return numStr.split(".")[1].length;
  }
  return 0;
}

/**
 * Rounds a quantity down to the nearest stepSize precision required by LOT_SIZE.
 * Truncating prevents ordering slightly more than balance or min lot step limits.
 */
export function formatQuantity(quantity: number | string, stepSize: string | number): string {
  const qtyNum = typeof quantity === "string" ? parseFloat(quantity) : quantity;
  const stepNum = typeof stepSize === "string" ? parseFloat(stepSize) : stepSize;

  if (isNaN(qtyNum) || qtyNum <= 0) return "0";
  if (isNaN(stepNum) || stepNum <= 0) return qtyNum.toString();

  const precision = getPrecision(stepSize.toString());
  // Floor to nearest stepSize
  const stepped = Math.floor(qtyNum / stepNum) * stepNum;
  // Fix precision floating point issues
  return stepped.toFixed(precision);
}

/**
 * Rounds a price to the tickSize precision required by PRICE_FILTER.
 */
export function formatPrice(price: number | string, tickSize: string | number): string {
  const priceNum = typeof price === "string" ? parseFloat(price) : price;
  const tickNum = typeof tickSize === "string" ? parseFloat(tickSize) : tickSize;

  if (isNaN(priceNum) || priceNum <= 0) return "0";
  if (isNaN(tickNum) || tickNum <= 0) return priceNum.toString();

  const precision = getPrecision(tickSize.toString());
  const rounded = Math.round(priceNum / tickNum) * tickNum;
  return rounded.toFixed(precision);
}

export interface OrderInput {
  symbol: string;
  side: "BUY" | "SELL";
  type?: "MARKET" | "LIMIT";
  quantity?: number | string;
  usdtAmount?: number | string; // quoteOrderQty for MARKET buys
  price?: number | string;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface ValidatedOrderResult {
  valid: boolean;
  error?: string;
  formattedParams?: Record<string, string>;
  filters?: SymbolFilters;
}

/**
 * Validates order inputs against live Binance symbol filters (LOT_SIZE, PRICE_FILTER, MIN_NOTIONAL).
 */
export async function validateAndFormatOrder(order: OrderInput): Promise<ValidatedOrderResult> {
  const pair = order.symbol.toUpperCase().endsWith("USDT")
    ? order.symbol.toUpperCase()
    : `${order.symbol.toUpperCase()}USDT`;

  const orderType = (order.type || "MARKET").toUpperCase();

  const filters = await getSymbolFilters(pair);
  if (!filters) {
    return { valid: false, error: `Could not retrieve trading rules for symbol ${pair}` };
  }

  const formattedParams: Record<string, string> = {
    symbol: pair,
    side: order.side.toUpperCase(),
    type: orderType,
  };

  const minNotional = parseFloat(filters.minNotional);
  const minQty = parseFloat(filters.minQty);
  const maxQty = parseFloat(filters.maxQty);

  // MARKET ORDER logic
  if (orderType === "MARKET") {
    if (order.side.toUpperCase() === "BUY" && order.usdtAmount) {
      const usdt = typeof order.usdtAmount === "string" ? parseFloat(order.usdtAmount) : order.usdtAmount;
      if (usdt < minNotional) {
        return {
          valid: false,
          error: `Order amount $${usdt.toFixed(2)} is below minimum required order value of $${minNotional.toFixed(2)} USDT for ${pair}`,
          filters,
        };
      }
      formattedParams.quoteOrderQty = usdt.toFixed(2);
    } else if (order.quantity) {
      const rawQty = typeof order.quantity === "string" ? parseFloat(order.quantity) : order.quantity;
      const formattedQty = formatQuantity(rawQty, filters.stepSize);
      const qtyNum = parseFloat(formattedQty);

      if (qtyNum < minQty) {
        return {
          valid: false,
          error: `Order quantity ${formattedQty} is below minimum allowed quantity ${filters.minQty} for ${pair}`,
          filters,
        };
      }
      if (qtyNum > maxQty) {
        return {
          valid: false,
          error: `Order quantity ${formattedQty} exceeds maximum allowed quantity ${filters.maxQty} for ${pair}`,
          filters,
        };
      }

      formattedParams.quantity = formattedQty;
    } else {
      return { valid: false, error: "Either quantity or usdtAmount (quoteOrderQty) must be provided for MARKET order." };
    }
  }

  // LIMIT ORDER logic
  if (orderType === "LIMIT") {
    if (!order.price) {
      return { valid: false, error: "Limit orders require a price parameter." };
    }
    if (!order.quantity) {
      return { valid: false, error: "Limit orders require a quantity parameter." };
    }

    const formattedPrice = formatPrice(order.price, filters.tickSize);
    const rawQty = typeof order.quantity === "string" ? parseFloat(order.quantity) : order.quantity;
    const formattedQty = formatQuantity(rawQty, filters.stepSize);

    const priceNum = parseFloat(formattedPrice);
    const qtyNum = parseFloat(formattedQty);
    const notionalValue = priceNum * qtyNum;

    if (qtyNum < minQty) {
      return { valid: false, error: `Quantity ${formattedQty} is below minimum allowed ${filters.minQty}`, filters };
    }
    if (notionalValue < minNotional) {
      return {
        valid: false,
        error: `Total limit order value $${notionalValue.toFixed(2)} is below minimum required value $${minNotional.toFixed(2)}`,
        filters,
      };
    }

    formattedParams.price = formattedPrice;
    formattedParams.quantity = formattedQty;
    formattedParams.timeInForce = order.timeInForce || "GTC";
  }

  return { valid: true, formattedParams, filters };
}

/**
 * Places a validated trading order on Binance Spot API.
 */
export async function placeBinanceOrder(order: OrderInput) {
  if (!API_KEY || !SECRET_KEY) {
    throw new Error("Binance API keys are not configured in environment variables.");
  }

  // 1. Validate & Format against exchange filters
  const validation = await validateAndFormatOrder(order);
  if (!validation.valid || !validation.formattedParams) {
    throw new Error(validation.error || "Order validation failed.");
  }

  // 2. Build signed query string
  const timestamp = await getBinanceTimestamp();
  const queryParams = new URLSearchParams({
    ...validation.formattedParams,
    timestamp: timestamp.toString(),
    recvWindow: "5000",
  });

  const queryString = queryParams.toString();
  const signature = generateSignature(queryString, SECRET_KEY);
  const fullUrl = `${BASE_URL}/api/v3/order?${queryString}&signature=${signature}`;

  // 3. Send request to Binance
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      "X-MBX-APIKEY": API_KEY,
    },
    cache: "no-store",
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 451) {
      throw new Error("Vercel Region Blocked (451): Move server region to Europe in Vercel settings.");
    }
    if (response.status === 429) {
      throw new Error("Binance Rate Limit Exceeded (429). Please reduce request frequency.");
    }
    const msg = data.msg || data.error || JSON.stringify(data);
    throw new Error(`Binance API Error (${data.code || response.status}): ${msg}`);
  }

  return data;
}

/**
 * Fetches account balance for all assets or a specific asset directly from Binance.
 */
export async function getBinanceAccountBalances() {
  if (!API_KEY || !SECRET_KEY) {
    throw new Error("Binance API keys not configured.");
  }

  const timestamp = await getBinanceTimestamp();
  const queryString = `timestamp=${timestamp}&recvWindow=5000`;
  const signature = generateSignature(queryString, SECRET_KEY);

  const res = await fetch(`${BASE_URL}/api/v3/account?${queryString}&signature=${signature}`, {
    headers: { "X-MBX-APIKEY": API_KEY },
    cache: "no-store",
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.msg || "Failed to fetch Binance account balance");
  }

  return data.balances as Array<{ asset: string; free: string; locked: string }>;
}
