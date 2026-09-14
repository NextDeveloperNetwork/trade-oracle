# Trade Oracle 🚀

An autonomous, multi-strategy quantitative algorithmic trading engine and analytics platform engineered for Binance Spot markets.

---

## ⚡ Core Features

- **Multi-Strategy Neural Engine**:
  - `ORACLE_ELITE`: RSI pullbacks + dynamic fee-recovery profit target calculation.
  - `MANUAL_ASSIST`: Manual coin entry with 24/7 automated take-profit and stop-loss risk management.
  - `EMA_SCALPER`: Fast EMA(9) / Slow EMA(21) momentum crossover trend-following.
  - `TREND_FOLLOWER`: Macro EMA(20) trend riding with ATR volatility channels.
- **Dynamic Fee Shield & Minimum Notional Guard**:
  - Calculates exact exchange fees (0.2% round-trip) and adjusts minimum exit prices to guarantee net positive returns.
  - Sub-$10 emergency liquidity flash top-ups ensuring Binance `MIN_NOTIONAL` compliance.
- **Anti-Revenge Stop-Loss Cooldown**:
  - Configurable cooldown window (default: 15 min) after stop-loss liquidations to prevent revenge buying.
- **Real-Time Live Telemetry**:
  - High-frequency Binance WebSocket ticker integration with live P&L, 24h delta, target distance, and margin cushions.
- **24/7 Cloud Automation**:
  - Vercel Cron (`vercel.json`) & GitHub Actions workflow (`.github/workflows/bot-tick.yml`) for automated cloud execution.
- **Paper & Live Trading**:
  - Seamless toggle between sandboxed paper simulation and real Binance Spot execution.

---

## 🛠 Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript
- **Database / ORM**: PostgreSQL (Neon Serverless) via [Prisma ORM](https://www.prisma.io/)
- **Exchange API**: Binance Spot API (HMAC SHA256 / WebSockets)
- **Styling**: Tailwind CSS & Lucide Icons

---

## 🚀 Getting Started

### 1. Installation
```bash
npm install 
```

### 2. Environment Setup
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://..."
BINANCE_API_KEY="your_binance_api_key"
BINANCE_SECRET_KEY="your_binance_secret_key"
CRON_SECRET="your_cron_secret"
```

### 3. Database Migration & Client Generation
```bash
npx prisma db push
npx prisma generate
```

### 4. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## 📄 License
MIT
