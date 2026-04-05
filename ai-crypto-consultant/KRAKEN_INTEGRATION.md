# Kraken Trading Integration - Complete

## 🎯 Overview

Successfully integrated Kraken trading capabilities from the ERC-8004 agent folder into the main `ai-crypto-consultant` dashboard. The integration includes:

✅ Real Kraken API client wrapper  
✅ Backend service layer for Kraken operations  
✅ RESTful API endpoints for trading  
✅ Real-time decision engine with momentum strategy  
✅ Paper trading mode support (sandboxed trading)  
✅ Live trading mode (with safety warnings)  

---

## 📁 Files Created/Modified

### New Backend Files

#### 1. **`server/src/services/kraken-service.ts`**
   - Singleton wrapper around KrakenClient
   - Provides safe initialization and error handling
   - Functions:
     - `initializeKrakenClient()` - Initialize on server start
     - `getKrakenClient()` - Get singleton instance
     - `isPaperTradingMode()` - Check if in sandbox mode
     - `getTradingMode()` - Get 'paper' or 'live'
     - `fetchMarketData(pair)` - Get ticker data
     - `fetchAccountBalance()` - Get account balances
     - `executeOrder(order)` - Place trades
     - `fetchOpenOrders()` - List open positions
     - `checkConnectionStatus()` - Health check
     - `calculateOrderVolume(usdAmount, price)` - Size orders

#### 2. **`server/src/services/decision-engine.ts`**
   - Orchestrates real trading decisions using:
     - Real Kraken market data
     - Momentum trading strategy
     - Portfolio constraints
     - Risk management
   - Classes:
     - `DecisionEngine` - Main decision orchestrator
   - Methods:
     - `analyzeAndTrade(symbol)` - Analyze one asset
     - `analyzePortfolio()` - Full portfolio sweep
     - `setMode(mode)` - Control trading state
     - `updateConfig(partial)` - Update settings

#### 3. **Copied to `server/src/` directory:**
   - `exchange/kraken.ts` - KrakenClient implementation
   - `types/index.ts` - Shared TypeScript interfaces
   - `agent/strategy.ts` - Trading strategy implementations

### Modified Backend Files

#### **`server/src/index.ts`**
   - Added imports for kraken-service and decision-engine
   - Initialized KrakenClient on server startup
   - Replaced mock trading loop with real DecisionEngine
   - Added 6 new Kraken API endpoints
   - Updated agent state management
   - Improved server startup logging

---

## 🔌 New API Endpoints

### Status & Mode
**`GET /api/kraken/status`**
```json
{
  "connected": true,
  "mode": "paper",
  "message": "Connected to Kraken paper trading"
}
```

**`GET /api/kraken/mode`**
```json
{
  "mode": "paper",
  "isPaper": true,
  "label": "📄 PAPER TRADING",
  "warning": "Paper trading mode — no real funds affected."
}
```

### Market Data
**`GET /api/kraken/ticker/:pair`**  
Example: `/api/kraken/ticker/XBT%2FUSD`
```json
{
  "pair": "XBT/USD",
  "price": 45230.5,
  "bid": 45229.1,
  "ask": 45231.9,
  "volume": 2340000,
  "vwap": 45200.0,
  "high": 45500.0,
  "low": 45100.0,
  "timestamp": 1711892345000,
  "spread": "0.004"
}
```

### Account Management
**`GET /api/kraken/balance`**  
Fetches real account balances (requires API credentials)
```json
{
  "balances": {
    "XBT": 0.5,
    "ETH": 10.25,
    "USD": 5000.0
  },
  "timestamp": "2026-04-02T10:30:00Z",
  "mode": "paper"
}
```

**`GET /api/kraken/orders`**  
Lists all open orders
```json
{
  "orders": { ... },
  "count": 3,
  "timestamp": "2026-04-02T10:30:00Z",
  "mode": "paper"
}
```

### Order Execution
**`POST /api/kraken/order`**  
Place market or limit orders
```bash
curl -X POST http://localhost:4000/api/kraken/order \
  -H "Content-Type: application/json" \
  -d '{
    "pair": "XBT/USD",
    "type": "buy",
    "ordertype": "market",
    "amount": 1000
  }'
```

Response (paper trading):
```json
{
  "success": true,
  "txid": ["SANDBOX-1711892345000"],
  "descr": { "order": "buy 0.022 XBT/USD" },
  "order": {
    "pair": "XBT/USD",
    "type": "buy",
    "ordertype": "market",
    "amount": 1000,
    "price": "market",
    "volume": "0.022",
    "executedAt": "2026-04-02T10:30:00Z"
  },
  "mode": "paper",
  "warning": "📄 This is a PAPER TRADE - no real funds were used."
}
```

---

## 🏗️ Architecture

```
ai-crypto-consultant/
├── server/
│   └── src/
│       ├── index.ts                    (Express backend - MODIFIED)
│       ├── services/
│       │   ├── kraken-service.ts       (NEW) Kraken client wrapper
│       │   └── decision-engine.ts      (NEW) Trading decision logic
│       ├── exchange/
│       │   └── kraken.ts               (COPIED) KrakenClient class
│       ├── types/
│       │   └── index.ts                (COPIED) Shared types
│       └── agent/
│           └── strategy.ts             (COPIED) Trading strategies
│
└── src/
    ├── (original frontend code unchanged)
    └── (original client code unchanged)
```

---

## ⚙️ Configuration

### Environment Variables

Create `.env` in the `ai-crypto-consultant` directory:

```bash
# Paper Trading Mode (sandbox - recommended for testing)
KRAKEN_SANDBOX=true
KRAKEN_API_KEY=your_kraken_api_key
KRAKEN_API_SECRET=your_kraken_api_secret

# Port
PORT=4000

# (Optional) Custom Kraken CLI path
KRAKEN_CLI_PATH=/usr/local/bin/kraken
```

### Paper vs Live Trading

**Paper Trading (RECOMMENDED FOR TESTING)**
- Set `KRAKEN_SANDBOX=true`
- No real funds affected
- All orders execute in simulation
- Dashboard shows "📄 PAPER TRADING"

**Live Trading (USE WITH CAUTION)**
- Set `KRAKEN_SANDBOX=false`
- Real API credentials required
- Real orders execute with real funds
- Dashboard shows "💰 LIVE TRADING" with warning

---

## 🔄 Trading Flow

### 1. Server Startup
```
✓ KrakenClient initialized
✓ Trading mode detected (paper/live)
✓ API credentials validated or warned
✓ Decision engine ready
✓ SSE stream initialized
```

### 2. Portfolio Monitoring (every 8 seconds)
```
1. Fetch selected assets
2. Get real market data from Kraken
3. Run momentum strategy analysis
4. Evaluate trade decisions
5. Execute orders if BUY/SELL signals
6. Stream results to frontend
```

### 3. Trade Decision
```
For each selected asset:
  - Fetch live Kraken ticker
  - Analyze momentum (5-sample window)
  - Check bid-ask spread
  - Decide: BUY, SELL, or HOLD
  - If decision ≠ HOLD: Execute order
  - Log to decision stream
```

---

## 🎮 Frontend Integration

The dashboard already has SSE connection for agent decisions. Results now include:

**For HOLD decisions:**
```json
{
  "timestamp": "2026-04-02T10:30:05Z",
  "message": "📊 BTC: HOLD (65% confidence)",
  "decision": {
    "action": "HOLD",
    "asset": "BTC",
    "confidence": 0.65,
    "reasoning": "No clear momentum..."
  },
  "executed": false
}
```

**For executed trades:**
```json
{
  "timestamp": "2026-04-02T10:30:08Z",
  "message": "✅ BUY $500 of ETH at $2350.00",
  "decision": {
    "action": "BUY",
    "asset": "ETH",
    "amount": 500,
    "pair": "ETH/USD"
  },
  "executed": true,
  "txid": ["SANDBOX-1711892348000"],
  "tradingMode": "paper"
}
```

---

## 🛡️ Safety Features

1. **Paper Trading Mode**
   - Enabled by default with `KRAKEN_SANDBOX=true`
   - No real funds transferred
   - Safe testing environment

2. **API Warning Messages**
   - Paper mode: "📄 PAPER TRADING - no real funds affected"
   - Live mode: "💰 LIVE TRADING - Real funds will be transferred"

3. **Error Handling**
   - Kraken CLI check on startup
   - Connection validation
   - Order validation before execution
   - Graceful fallbacks on errors

4. **Logging**
   - Detailed [KrakenService] logs
   - Decision reasoning logged
   - Order execution logged
   - Errors clearly marked

---

## 📋 Trading Strategy

The integrated **MomentumStrategy**:

- **Warm-up phase:** Need 5 price samples before trading
- **Momentum detection:** 
  - BUY if: price rises > 0.5% AND spread < 0.1%
  - SELL if: price falls > 0.5%
  - HOLD otherwise
- **Confidence:** 0.5 to 0.9 based on momentum magnitude
- **Position size:** $100 per trade (configurable)

---

## 🚀 How to Use

### 1. Setup
```bash
# Navigate to ai-crypto-consultant
cd ai-crypto-consultant

# Install dependencies
npm install
cd server && npm install
cd ../client && npm install

# Create .env file with paper trading settings
echo "KRAKEN_SANDBOX=true" > .env
echo "KRAKEN_API_KEY=your_key" >> .env
echo "KRAKEN_API_SECRET=your_secret" >> .env
```

### 2. Prerequisites
- **Kraken CLI installed**: https://github.com/kraken-oss/kraken-cli
  ```bash
  curl -sSL https://github.com/kraken-oss/kraken-cli/releases/latest/download/install.sh | sh
  ```

### 3. Start Backend
```bash
cd ai-crypto-consultant/server
npm run dev
# Output: AI Crypto Agent backend running on http://localhost:4000
# 📄 PAPER TRADING (Sandbox) enabled
```

### 4. Test Endpoints
```bash
# Check Kraken status
curl http://localhost:4000/api/kraken/status

# Get trading mode
curl http://localhost:4000/api/kraken/mode

# Fetch Bitcoin price
curl http://localhost:4000/api/kraken/ticker/XBT%2FUSD

# Get account balance
curl http://localhost:4000/api/kraken/balance

# Place a paper trade
curl -X POST http://localhost:4000/api/kraken/order \
  -d '{"pair":"XBT/USD","type":"buy","ordertype":"market","amount":100}'
```

### 5. Start Dashboard
```bash
cd ai-crypto-consultant/client
npm run dev
# Opens dashboard with real Kraken data + agent decisions
```

---

## 📊 Monitoring

### Agent Decision Log (SSE Stream)
- Real-time trading decisions flowing to dashboard
- Shows momentum analysis for each asset
- Displays executed trades with transaction IDs
- Paper/Live mode clearly marked

### API Endpoints
- Health checks: `/api/kraken/status`
- Mode indicator: `/api/kraken/mode`  
- Real prices: `/api/kraken/ticker/{pair}`
- Balances: `/api/kraken/balance`
- Orders: `/api/kraken/orders`

---

## 🔐 Security Notes

1. **API Keys**
   - Never commit `.env` to Git
   - Use environment variables only
   - Consider using Kraken IP whitelist

2. **Paper vs Live**
   - Default to PAPER TRADING
   - Require explicit `KRAKEN_SANDBOX=false` for live
   - Dashboard shows clear mode indicator

3. **Order Validation**
   - Check market data before sizing
   - Validate pair, amount, type
   - Log all executions

---

## ✅ Integration Checklist

- [x] Copy Kraken client code
- [x] Setup types and interfaces
- [x] Create service layer (kraken-service.ts)
- [x] Create decision engine (decision-engine.ts)
- [x] Add API endpoints (6 new ones)
- [x] Replace mock trading with real decisions
- [x] Add paper trading support
- [x] Add trading mode indicator
- [x] Error handling and logging
- [x] Type safety (no TypeScript errors)
- [x] Documentation

---

## 📚 Next Steps

1. **API Key Setup**: Get Kraken API keys from https://www.kraken.com/features/api
2. **Kraken CLI**: Install the Kraken CLI binary
3. **Environment Config**: Create `.env` with credentials
4. **Start Services**: Run backend and check logs
5. **Test Endpoints**: Verify API endpoints work
6. **Monitor Agent**: Watch decision log in dashboard
7. **Deploy**: When confident, enable live trading

---

## 🐛 Troubleshooting

**"Kraken CLI binary not found"**
- Install CLI: https://github.com/kraken-oss/kraken-cli/releases
- Or set `KRAKEN_CLI_PATH=/path/to/kraken`

**"No API credentials set"**
- This is a warning, not an error
- Public commands (ticker) will work
- Private commands (balance, orders) will fail
- Set KRAKEN_API_KEY and KRAKEN_API_SECRET in .env

**"Failed to fetch ticker"**
- Check network connection
- Verify Kraken API is accessible
- Try a different pair from krakenPairMap

**Paper trades not executing**
- Ensure `KRAKEN_SANDBOX=true`
- Check decision engine logs
- Verify portfolio has selected assets

---

## 📞 Support

All integration code is in `/server/src/`:
- Services: `services/kraken-service.ts`, `services/decision-engine.ts`
- Exchange: `exchange/kraken.ts`
- Types: `types/index.ts`
- Strategy: `agent/strategy.ts`

Check logs for detailed error messages and decision reasoning.

---

**Integration completed successfully!** 🎉
