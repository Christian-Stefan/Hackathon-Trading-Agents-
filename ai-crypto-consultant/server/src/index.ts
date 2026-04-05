import express from 'express';
import cors from 'cors';
import axios from 'axios';
import {
  initializeKrakenClient,
  getKrakenClient,
  isPaperTradingMode,
  getTradingMode,
  fetchMarketData,
  fetchAccountBalance,
  executeOrder,
  fetchOpenOrders,
  checkConnectionStatus,
  calculateOrderVolume
} from './services/kraken-service';
import { DecisionEngine, formatDecisionForStream } from './services/decision-engine';
import { getErc8004Status, getErc8004Checkpoints } from './erc8004/service';
import { initializeErc8004Startup } from './erc8004/init';

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

interface Asset {
  id: number;
  symbol: string;
  name: string;
  category: string;
  consensus: string;
  energyPerTx: number;
  teamTransparency: string;
  launchYear: number;
  audited: boolean;
  auditor?: string | null;
  marketCap: number;
  githubActivity: string;
  legitimacyScore: number;
  sustainabilityScore: number;
  exchangeListing: string;
  tokenDistribution: { concentratedSupply: boolean; notes: string };
  githubCommits: number[];
  sustainabilityNotes: string;
  redFlags: { anonymousTeam: boolean; audit: boolean; concentratedSupply: boolean };
  description: string;
}

interface PortfolioState {
  selected: string[];
  allocations: Record<string, number>;
  controls: {
    sustainabilityTarget: number;
    legitimacyMin: number;
    trading: 'running' | 'paused' | 'stopped';
  };
}

const assetList: Asset[] = [
  {
    id: 1,
    symbol: 'BTC',
    name: 'Bitcoin',
    category: 'Established Blue Chips',
    consensus: 'PoW (mix)',
    energyPerTx: 700,
    teamTransparency: 'Pseudonymous',
    launchYear: 2009,
    audited: false,
    auditor: null,
    marketCap: 1200000,
    githubActivity: 'High',
    legitimacyScore: 85,
    sustainabilityScore: 35,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: true, notes: 'Large pools held by early miners and whales.' },
    githubCommits: [120, 110, 95, 130, 100, 115],
    sustainabilityNotes: 'Proof-of-work with mixed renewable energy adoption and ongoing offset initiatives.',
    redFlags: { anonymousTeam: true, audit: false, concentratedSupply: true },
    description: 'Bitcoin is the original crypto store of value with strong legitimacy but low sustainability due to PoW energy use.'
  },
  {
    id: 2,
    symbol: 'ETH',
    name: 'Ethereum',
    category: 'Established Blue Chips',
    consensus: 'PoS',
    energyPerTx: 0.03,
    teamTransparency: 'Public (Consensys)',
    launchYear: 2015,
    audited: true,
    auditor: 'Trail of Bits',
    marketCap: 350000,
    githubActivity: 'Very High',
    legitimacyScore: 95,
    sustainabilityScore: 85,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: false, notes: 'Broad decentralization with multiple staking pools.' },
    githubCommits: [220, 210, 230, 240, 250, 260],
    sustainabilityNotes: 'Low energy usage under PoS, large green legitimacy due to broad developer activity.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Ethereum is the largest smart contract platform, now PoS, with strong legitimacy and sustainability improvements.'
  },
  {
    id: 3,
    symbol: 'SOL',
    name: 'Solana',
    category: 'Emerging Green',
    consensus: 'PoS',
    energyPerTx: 0.001,
    teamTransparency: 'Public',
    launchYear: 2020,
    audited: true,
    auditor: 'CertiK',
    marketCap: 85000,
    githubActivity: 'High',
    legitimacyScore: 88,
    sustainabilityScore: 92,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: false, notes: 'Moderate decentralization across validators.' },
    githubCommits: [80, 85, 90, 95, 100, 110],
    sustainabilityNotes: 'One of the most energy-efficient major L1 networks with fast PoS consensus.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Solana is a fast PoS chain with strong sustainability and growing legitimacy, but still emerging.'
  },
  {
    id: 4,
    symbol: 'ADA',
    name: 'Cardano',
    category: 'High Sustainability',
    consensus: 'PoS',
    energyPerTx: 0.005,
    teamTransparency: 'Public (IOHK)',
    launchYear: 2017,
    audited: true,
    auditor: 'CertiK',
    marketCap: 28000,
    githubActivity: 'Medium',
    legitimacyScore: 90,
    sustainabilityScore: 90,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: false, notes: 'Supply is broadly distributed though staking is centralized in some pools.' },
    githubCommits: [50, 55, 60, 58, 62, 65],
    sustainabilityNotes: 'Cardano emphasizes sustainable PoS and formal research-driven development.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Cardano is a research-first blockchain with strong legitimacy and a highly sustainable PoS design.'
  },
  {
    id: 5,
    symbol: 'ALGO',
    name: 'Algorand',
    category: 'Green & Legit',
    consensus: 'PoS',
    energyPerTx: 0.0002,
    teamTransparency: 'Public',
    launchYear: 2019,
    audited: true,
    auditor: 'CertiK',
    marketCap: 2800,
    githubActivity: 'Medium',
    legitimacyScore: 85,
    sustainabilityScore: 95,
    exchangeListing: 'Kraken, Coinbase',
    tokenDistribution: { concentratedSupply: false, notes: 'Strong decentralization among validators and foundation holdings.' },
    githubCommits: [45, 48, 52, 50, 55, 58],
    sustainabilityNotes: 'Algorand runs a carbon-negative protocol with extremely low per-transaction energy.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Algorand delivers strong sustainability through PoS and carbon-negative initiatives while maintaining a green legitimacy profile.'
  },
  {
    id: 6,
    symbol: 'AVAX',
    name: 'Avalanche',
    category: 'Emerging Green',
    consensus: 'PoS',
    energyPerTx: 0.0005,
    teamTransparency: 'Public',
    launchYear: 2020,
    audited: true,
    auditor: 'Trail of Bits',
    marketCap: 15000,
    githubActivity: 'High',
    legitimacyScore: 88,
    sustainabilityScore: 93,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: false, notes: 'Validator set is active and distributed across ecosystems.' },
    githubCommits: [70, 75, 78, 80, 85, 88],
    sustainabilityNotes: 'Avalanche uses PoS with strong energy efficiency and green governance signals.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Avalanche is a scalable PoS network with strong sustainability scoring and healthy market legitimacy.'
  },
  {
    id: 7,
    symbol: 'DOT',
    name: 'Polkadot',
    category: 'High Sustainability',
    consensus: 'PoS',
    energyPerTx: 0.001,
    teamTransparency: 'Public',
    launchYear: 2020,
    audited: true,
    auditor: 'CertiK',
    marketCap: 12000,
    githubActivity: 'High',
    legitimacyScore: 89,
    sustainabilityScore: 92,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: false, notes: 'Relay chain and parachain economics remain broadly distributed.' },
    githubCommits: [65, 68, 72, 75, 78, 80],
    sustainabilityNotes: 'Polkadot is PoS with a broad validator ecosystem and strong sustainability profile.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Polkadot combines strong legitimacy and PoS sustainability with a diverse parachain ecosystem.'
  },
  {
    id: 8,
    symbol: 'NEAR',
    name: 'Near Protocol',
    category: 'Green & Legit',
    consensus: 'PoS',
    energyPerTx: 0.0001,
    teamTransparency: 'Public',
    launchYear: 2020,
    audited: true,
    auditor: 'CertiK',
    marketCap: 8000,
    githubActivity: 'High',
    legitimacyScore: 87,
    sustainabilityScore: 94,
    exchangeListing: 'Kraken, Coinbase',
    tokenDistribution: { concentratedSupply: false, notes: 'Staking and protocol incentives are well distributed.' },
    githubCommits: [90, 95, 100, 105, 110, 115],
    sustainabilityNotes: 'NEAR is very low energy, with strong commitments to eco-friendly scaling.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'NEAR is a sustainable PoS protocol with high developer activity and a strong green legitimacy story.'
  },
  {
    id: 9,
    symbol: 'XLM',
    name: 'Stellar',
    category: 'High Sustainability',
    consensus: 'PoS',
    energyPerTx: 0.0001,
    teamTransparency: 'Public (Stellar Foundation)',
    launchYear: 2014,
    audited: true,
    auditor: 'CertiK',
    marketCap: 4000,
    githubActivity: 'Medium',
    legitimacyScore: 92,
    sustainabilityScore: 96,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: false, notes: 'Foundation holdings are managed with community governance.' },
    githubCommits: [38, 40, 42, 45, 48, 50],
    sustainabilityNotes: 'Stellar is a highly efficient payments ledger with excellent sustainability credentials.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Stellar is a mature payments protocol with high sustainability and strong foundation governance.'
  },
  {
    id: 10,
    symbol: 'XTZ',
    name: 'Tezos',
    category: 'High Sustainability',
    consensus: 'PoS',
    energyPerTx: 0.00005,
    teamTransparency: 'Public',
    launchYear: 2018,
    audited: true,
    auditor: 'Quantstamp',
    marketCap: 1200,
    githubActivity: 'Medium',
    legitimacyScore: 86,
    sustainabilityScore: 97,
    exchangeListing: 'Kraken, Coinbase, Binance',
    tokenDistribution: { concentratedSupply: false, notes: 'Baking and delegation are broadly available to holders.' },
    githubCommits: [35, 38, 40, 42, 45, 48],
    sustainabilityNotes: 'Tezos is one of the most energy-efficient networks with strong on-chain governance.',
    redFlags: { anonymousTeam: false, audit: true, concentratedSupply: false },
    description: 'Tezos is a low-energy PoS blockchain with mature governance and high environmental scoring.'
  },
  {
    id: 11,
    symbol: 'KAS',
    name: 'Kaspa',
    category: 'Emerging Green',
    consensus: 'PoW (GHOSTDAG)',
    energyPerTx: 0.1,
    teamTransparency: 'Pseudonymous',
    launchYear: 2021,
    audited: false,
    auditor: null,
    marketCap: 3000,
    githubActivity: 'High',
    legitimacyScore: 65,
    sustainabilityScore: 55,
    exchangeListing: 'Binance, Kraken',
    tokenDistribution: { concentratedSupply: false, notes: 'Fast-growing network with active mining pools.' },
    githubCommits: [70, 75, 80, 85, 90, 95],
    sustainabilityNotes: 'Kaspa is PoW but more efficient than older blockchains; mixed sustainability profile.',
    redFlags: { anonymousTeam: true, audit: false, concentratedSupply: false },
    description: 'Kaspa is an emerging PoW network with a mixed sustainability profile and evolving legitimacy.'
  },
  {
    id: 12,
    symbol: 'PEPE',
    name: 'Pepe',
    category: 'Fully Audited',
    consensus: 'ERC-20',
    energyPerTx: 0.03,
    teamTransparency: 'Anonymous',
    launchYear: 2023,
    audited: false,
    auditor: null,
    marketCap: 4200,
    githubActivity: 'Low',
    legitimacyScore: 35,
    sustainabilityScore: 80,
    exchangeListing: 'Binance, Kraken',
    tokenDistribution: { concentratedSupply: true, notes: 'Meme token with large wallet concentration and limited transparency.' },
    githubCommits: [10, 8, 12, 9, 11, 10],
    sustainabilityNotes: 'ERC-20 inherits Ethereum PoS sustainability, but the token’s legitimacy is weak.',
    redFlags: { anonymousTeam: true, audit: false, concentratedSupply: true },
    description: 'Pepe is a meme token with limited transparency, strong sustainability score via Ethereum, and low legitimacy.'
  }
];

const portfolioState: PortfolioState = {
  selected: ['PEPE'],
  allocations: { PEPE: 100 },
  controls: { sustainabilityTarget: 80, legitimacyMin: 70, trading: 'running' }
};

const krakenPairMap: Record<string, string> = {
  ETH: 'ETH/USD',
  SOL: 'SOL/USD',
  ADA: 'ADA/USD',
  ALGO: 'ALGO/USD',
  AVAX: 'AVAX/USD',
  DOT: 'DOT/USD',
  NEAR: 'NEAR/USD',
  XLM: 'XLM/USD',
  XTZ: 'XTZ/USD',
  KAS: 'KAS/USD',
  PEPE: 'PEPE/USD'
};

interface ExecutedTrade {
  timestamp: string;
  symbol: string;
  pair: string;
  action: 'BUY' | 'SELL';
  amountUsd: number;
  priceUsd: number;
  txid: string[];
  source: 'manual' | 'automated';
}

const executedTrades: ExecutedTrade[] = [];

const agentState = {
  trading: 'running' as 'running' | 'paused' | 'stopped',
  sustainabilityTarget: 80,
  legitimacyMin: 70,
  lastDecision: null as null | Record<string, any>,
  listeners: new Set<express.Response>(),
  intervalId: null as NodeJS.Timeout | null,
  decisionEngine: null as DecisionEngine | null
};

function formatDecision(message: string, details: any = {}) {
  return {
    timestamp: new Date().toISOString(),
    message,
    details
  };
}

function broadcastDecision(decision: Record<string, any>) {
  const payload = `data: ${JSON.stringify(decision)}\n\n`;
  for (const res of agentState.listeners) {
    res.write(payload);
  }
  agentState.lastDecision = decision;
}

async function streamAgentDecisions() {
  if (agentState.intervalId) return;

  // Initialize decision engine with current portfolio
  const portfolio = await getPortfolio();
  agentState.decisionEngine = new DecisionEngine({
    sustainabilityTarget: agentState.sustainabilityTarget,
    legitimacyMin: agentState.legitimacyMin,
    maxOrderUsd: 500,
    selectedAssets: portfolio.selected || ['PEPE'],
    krakenPairMap
  });

  console.log('[Agent] Decision engine initialized with real Kraken integration');

  agentState.intervalId = setInterval(async () => {
    if (agentState.trading !== 'running' || !agentState.decisionEngine) return;

    try {
      const portfolio = await getPortfolio();
      const selected = portfolio.selected || [];

      if (!selected.length) {
        broadcastDecision(formatDecision('⚠️ No assets selected. Add assets to your portfolio to begin trading.'));
        return;
      }

      // Broadcast status
      broadcastDecision(
        formatDecision(
          `🔍 Agent scanning ${selected.length} asset(s) for trading opportunities...`,
          {
            portfolioSize: selected.length,
            mode: getTradingMode(),
            sustainabilityTarget: agentState.sustainabilityTarget
          }
        )
      );

      // Run portfolio analysis with real Kraken data
      const results = await agentState.decisionEngine.analyzePortfolio();

      // Broadcast each result
      for (const result of results) {
        if (result.executed) {
          broadcastDecision(
            formatDecision(
              `✅ ${result.message}`,
              {
                action: result.decision?.action,
                amount: result.decision?.amount,
                pair: result.decision?.pair,
                txid: result.txid,
                mode: result.tradingMode
              }
            )
          );
        } else if (result.decision) {
          broadcastDecision(
            formatDecision(
              `📊 ${result.decision.asset}: ${result.decision.action} (${(result.decision.confidence * 100).toFixed(0)}% confidence)`,
              {
                action: result.decision.action,
                reasoning: result.decision.reasoning,
                confidence: result.decision.confidence
              }
            )
          );
        } else {
          broadcastDecision(formatDecision(result.message));
        }
      }
    } catch (error) {
      console.error('[Agent] Error in decision loop:', error);
      broadcastDecision(
        formatDecision(`❌ Agent error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
  }, 8000); // Check portfolio every 8 seconds (was 5.5)
}

function stopAgentStream() {
  if (agentState.intervalId) {
    clearInterval(agentState.intervalId);
    agentState.intervalId = null;
    agentState.decisionEngine = null;
  }
}

async function getKrakenTicker(symbol: string) {
  const pair = krakenPairMap[symbol];
  if (!pair) return null;
  try {
    const response = await axios.get('https://api.kraken.com/0/public/Ticker', {
      params: { pair }
    });
    const result = response.data.result;
    const key = Object.keys(result)[0];
    const ticker = result[key];
    return {
      ask: Number(ticker.a[0]),
      bid: Number(ticker.b[0]),
      last: Number(ticker.c[0]),
      volume: Number(ticker.v[1]),
      change: Number(ticker.p[1])
    };
  } catch (error) {
    return null;
  }
}

function mockMarketData(asset: any) {
  const priceBase = asset.marketCap / 10000;
  const last = Math.max(0.1, Number((priceBase * (0.75 + Math.random() * 0.5)).toFixed(2)));
  const change = Number(((Math.random() - 0.4) * 4).toFixed(2));
  const volume = Number(((Math.random() * 70 + 10) / 100).toFixed(2));
  return {
    price: last,
    change,
    volume
  };
}

async function getPriceForAsset(asset: any) {
  const ticker = await getKrakenTicker(asset.symbol);
  if (ticker) {
    return {
      price: ticker.last,
      change: Number((Math.random() * 3 - 1).toFixed(2)),
      volume: Number((ticker.volume / 1000000).toFixed(2))
    };
  }
  return mockMarketData(asset);
}

function getPortfolio() {
  return portfolioState;
}

function normalizeAsset(asset: Asset) {
  return {
    ...asset,
    tokenDistribution: asset.tokenDistribution,
    githubCommits: asset.githubCommits,
    redFlags: asset.redFlags
  };
}

function makeTier(score: number) {
  if (score >= 80) return 'Green';
  if (score >= 50) return 'Yellow';
  return 'Red';
}

app.get('/api/assets', async (req, res) => {
  const enriched = await Promise.all(assetList.map(async (asset) => ({
    ...normalizeAsset(asset),
    market: await getPriceForAsset(asset),
    greenLegitScore: Math.round((asset.legitimacyScore + asset.sustainabilityScore) / 2)
  })));
  enriched.sort((a, b) => b.legitimacyScore - a.legitimacyScore);
  res.json(enriched);
});

app.get('/api/assets/:symbol', async (req, res) => {
  const symbol = String(req.params.symbol).toUpperCase();
  const asset = assetList.find((item) => item.symbol === symbol);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  const normalized = normalizeAsset(asset);
  const market = await getPriceForAsset(normalized);
  const visaComparison = (normalized.energyPerTx / 0.002).toFixed(1);
  res.json({
    ...normalized,
    market,
    greenLegitScore: Math.round((normalized.legitimacyScore + normalized.sustainabilityScore) / 2),
    visaComparison,
    carbonFootprint: Number((normalized.energyPerTx * 1000 * 0.0004).toFixed(2)),
    marketImpact: { tier: makeTier(normalized.sustainabilityScore) }
  });
});

app.post('/api/portfolio', async (req, res) => {
  const { selected = [], allocations = {}, controls = {} } = req.body;
  portfolioState.selected = selected;
  portfolioState.allocations = allocations;
  portfolioState.controls = {
    ...portfolioState.controls,
    ...controls
  };
  const strategy = { ...portfolioState.controls, allocations: portfolioState.allocations };
  res.json({ selected: portfolioState.selected, strategy });
});

app.get('/api/portfolio', async (req, res) => {
  const strategy = { ...portfolioState.controls, allocations: portfolioState.allocations };
  res.json({ selected: portfolioState.selected, strategy });
});

app.get('/api/performance', async (req, res) => {
  const portfolio = getPortfolio();
  const selectedSymbols = portfolio.selected || [];
  const assets = assetList.filter((asset) => selectedSymbols.includes(asset.symbol));
  const assetValues = await Promise.all(assets.map(async (asset) => {
    const market = await getPriceForAsset(asset);
    const share = portfolio.allocations?.[asset.symbol] ?? 10;
    const value = Number(((share / 100) * 30000).toFixed(2));
    return {
      symbol: asset.symbol,
      value,
      pct: share,
      pnl: Number(((Math.random() * 10 - 2)).toFixed(2)),
      legitimacyScore: asset.legitimacyScore,
      sustainabilityScore: asset.sustainabilityScore,
      market
    };
  }));
  const totalValue = assetValues.reduce((sum, item) => sum + item.value, 0);
  const weightedSust = assetValues.reduce((sum, item) => sum + item.sustainabilityScore * item.pct, 0) / Math.max(1, assetValues.reduce((sum, item) => sum + item.pct, 0));
  const weightedLegit = assetValues.reduce((sum, item) => sum + item.legitimacyScore * item.pct, 0) / Math.max(1, assetValues.reduce((sum, item) => sum + item.pct, 0));
  res.json({
    totalValue: Number(totalValue.toFixed(2)),
    totalReturn: Number(((Math.random() * 12 - 2)).toFixed(2)),
    todayPnL: Number(((Math.random() * 4 - 1)).toFixed(2)),
    weightedSustainability: Number(weightedSust.toFixed(1)),
    weightedLegitimacy: Number(weightedLegit.toFixed(1)),
    carbonFootprint: Number(((weightedSust / 100) * 18).toFixed(2)),
    treesNeeded: Math.ceil((weightedSust / 100) * 120),
    positions: assetValues
  });
});

app.get('/api/sustainability_report', async (req, res) => {
  const portfolio = getPortfolio();
  const selectedSymbols = portfolio.selected || [];
  const assets = assetList.filter((asset) => selectedSymbols.includes(asset.symbol));
  const totals = assets.reduce((acc, asset) => {
    acc.energy += asset.energyPerTx;
    acc.carbon += asset.energyPerTx * 0.0004;
    acc.greenLegit += (asset.legitimacyScore + asset.sustainabilityScore) / 2;
    return acc;
  }, { energy: 0, carbon: 0, greenLegit: 0 });
  const breakdown = assets.map((asset) => ({
    symbol: asset.symbol,
    sustainabilityScore: asset.sustainabilityScore,
    tier: makeTier(asset.sustainabilityScore)
  }));
  res.json({
    totalEnergyPerTx: Number(totals.energy.toFixed(4)),
    totalCarbonTons: Number(totals.carbon.toFixed(3)),
    averageGreenLegit: Number((totals.greenLegit / Math.max(1, assets.length)).toFixed(1)),
    breakdown,
    notes: 'Portfolio sustainability data is provided as an analytic profile for user control and transparency.'
  });
});

app.get('/api/agent/decisions/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  agentState.listeners.add(res);
  res.write('event: hello\ndata: {"message":"agent connected"}\n\n');

  const onClose = () => {
    agentState.listeners.delete(res);
    res.end();
  };
  req.on('close', onClose);
});

app.post('/api/agent/command', async (req, res) => {
  const { command } = req.body;
  if (typeof command !== 'string') {
    return res.status(400).json({ error: 'Command string required' });
  }

  const normalized = command.trim().toLowerCase();
  const portfolio = await getPortfolio();
  const selected = new Set(portfolio.selected || []);
  const allocations = Object.assign({}, portfolio.allocations || {});

  if (normalized === '/pause') {
    agentState.trading = 'paused';
    if (agentState.decisionEngine) {
      agentState.decisionEngine.setMode('paused');
    }
    broadcastDecision(formatDecision('⏸️ Agent paused by user command.', { command }));
    return res.json({ status: 'paused' });
  }

  if (normalized === '/resume') {
    agentState.trading = 'running';
    if (agentState.decisionEngine) {
      agentState.decisionEngine.setMode('running');
    }
    broadcastDecision(formatDecision('▶️ Agent resumed trading.', { command }));
    return res.json({ status: 'running' });
  }

  if (normalized === '/stop') {
    agentState.trading = 'stopped';
    if (agentState.decisionEngine) {
      agentState.decisionEngine.setMode('stopped');
    }
    broadcastDecision(formatDecision('🛑 Agent stopped and preparing to liquidate into stablecoins.', { command }));
    return res.json({ status: 'stopped' });
  }

  if (normalized.startsWith('/set ')) {
    const [, key, value] = normalized.split(' ');
    const numeric = Number(value);
    if (key === 'sustainability_target' && !Number.isNaN(numeric)) {
      agentState.sustainabilityTarget = numeric;
      broadcastDecision(formatDecision(`⚙️ Sustainability target updated to ${numeric}.`, { command }));
      return res.json({ sustainabilityTarget: numeric });
    }
    if (key === 'legitimacy_min' && !Number.isNaN(numeric)) {
      agentState.legitimacyMin = numeric;
      broadcastDecision(formatDecision(`⚙️ Legitimacy threshold updated to ${numeric}.`, { command }));
      return res.json({ legitimacyMin: numeric });
    }
  }

  if (normalized === '/rebalance now') {
    broadcastDecision(formatDecision('🔁 Rebalance requested by user. Reviewing allocation and risk.', { command }));
    return res.json({ status: 'rebalancing' });
  }

  if (normalized.startsWith('/add asset ')) {
    const parts = normalized.split(' ');
    const symbol = (parts[2] || '').toUpperCase();
    const share = Number(parts[3] || '0');
    if (symbol && share > 0) {
      selected.add(symbol);
      allocations[symbol] = share;
      portfolioState.selected = Array.from(selected);
      portfolioState.allocations = allocations;
      broadcastDecision(formatDecision(`➕ Added ${symbol} with ${share}% allocation to portfolio.`, { command }));
      return res.json({ selected: portfolioState.selected, allocations: portfolioState.allocations });
    }
  }

  if (normalized.startsWith('/remove asset ')) {
    const parts = normalized.split(' ');
    const symbol = (parts[2] || '').toUpperCase();
    if (symbol) {
      selected.delete(symbol);
      delete allocations[symbol];
      portfolioState.selected = Array.from(selected);
      portfolioState.allocations = allocations;
      broadcastDecision(formatDecision(`➖ Removed ${symbol} from the portfolio.`, { command }));
      return res.json({ selected: portfolioState.selected, allocations: portfolioState.allocations });
    }
  }

  if (normalized === '/portfolio_sustainability') {
    const report = assetList.filter((asset) => Array.from(selected).includes(asset.symbol));
    const average = report.reduce((sum, asset) => sum + asset.sustainabilityScore, 0) / Math.max(1, report.length);
    return res.json({ sustainability: Number(average.toFixed(1)), target: agentState.sustainabilityTarget });
  }

  // Manual BUY command: /buy SYMBOL USD_AMOUNT
  if (normalized.startsWith('/buy ')) {
    const parts = normalized.split(' ');
    const symbol = (parts[1] || '').toUpperCase();
    const amountUsd = Number(parts[2] || '0');

    if (!symbol || amountUsd <= 0 || !krakenPairMap[symbol]) {
      return res.status(400).json({ error: `Usage: /buy SYMBOL AMOUNT (e.g., /buy PEPE 100). Unknown symbol or invalid amount.` });
    }

    try {
      const pair = krakenPairMap[symbol];
      const marketData = await fetchMarketData(pair);
      if (!marketData) {
        return res.status(500).json({ error: `Could not fetch market data for ${symbol}` });
      }

      const volume = calculateOrderVolume(amountUsd, marketData.price);
      const result = await executeOrder({
        pair,
        type: 'buy',
        ordertype: 'market',
        volume
      });

      if (!result) {
        return res.status(500).json({ error: `Order execution failed for ${symbol}` });
      }

      const trade: ExecutedTrade = {
        timestamp: new Date().toISOString(),
        symbol,
        pair,
        action: 'BUY',
        amountUsd,
        priceUsd: marketData.price,
        txid: result.txid,
        source: 'manual'
      };
      executedTrades.push(trade);

      const msg = `✅ Manual BUY executed: $${amountUsd} of ${symbol} at $${marketData.price.toFixed(2)}`;
      broadcastDecision(formatDecision(msg, { command, trade }));
      return res.json({ success: true, trade });
    } catch (error) {
      return res.status(500).json({
        error: 'BUY command failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Manual SELL command: /sell SYMBOL USD_AMOUNT
  if (normalized.startsWith('/sell ')) {
    const parts = normalized.split(' ');
    const symbol = (parts[1] || '').toUpperCase();
    const amountUsd = Number(parts[2] || '0');

    if (!symbol || amountUsd <= 0 || !krakenPairMap[symbol]) {
      return res.status(400).json({ error: `Usage: /sell SYMBOL AMOUNT (e.g., /sell PEPE 100). Unknown symbol or invalid amount.` });
    }

    try {
      const pair = krakenPairMap[symbol];
      const marketData = await fetchMarketData(pair);
      if (!marketData) {
        return res.status(500).json({ error: `Could not fetch market data for ${symbol}` });
      }

      const volume = calculateOrderVolume(amountUsd, marketData.price);
      const result = await executeOrder({
        pair,
        type: 'sell',
        ordertype: 'market',
        volume
      });

      if (!result) {
        return res.status(500).json({ error: `Order execution failed for ${symbol}` });
      }

      const trade: ExecutedTrade = {
        timestamp: new Date().toISOString(),
        symbol,
        pair,
        action: 'SELL',
        amountUsd,
        priceUsd: marketData.price,
        txid: result.txid,
        source: 'manual'
      };
      executedTrades.push(trade);

      const msg = `✅ Manual SELL executed: $${amountUsd} of ${symbol} at $${marketData.price.toFixed(2)}`;
      broadcastDecision(formatDecision(msg, { command, trade }));
      return res.json({ success: true, trade });
    } catch (error) {
      return res.status(500).json({
        error: 'SELL command failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return res.status(400).json({ error: 'Unknown command' });
});

app.get('/api/market', async (req, res) => {
  const prices = await Promise.all(assetList.map(async (asset) => ({ symbol: asset.symbol, market: await getPriceForAsset(asset) })));
  res.json({ prices });
});

// ─────────────────────────────────────────────────────────────────────────
// Kraken Trading Integration Endpoints
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET /api/kraken/status
 * Check Kraken connection and trading mode
 */
app.get('/api/kraken/status', async (req, res) => {
  const status = await checkConnectionStatus();
  res.json(status);
});

app.get('/api/erc8004/status', async (_req, res) => {
  try {
    const status = await getErc8004Status();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve ERC-8004 status',
      message: error instanceof Error ? error.message : 'unknown error'
    });
  }
});

app.get('/api/erc8004/checkpoints', (_req, res) => {
  const checkpoints = getErc8004Checkpoints();
  res.json(checkpoints);
});

/**
 * GET /api/executions
 * Get history of executed trades (locked-in positions)
 */
app.get('/api/executions', (_req, res) => {
  res.json({
    executions: executedTrades,
    totalCount: executedTrades.length,
    bySymbol: executedTrades.reduce((acc, trade) => {
      if (!acc[trade.symbol]) {
        acc[trade.symbol] = { buys: 0, sells: 0, netUsd: 0 };
      }
      if (trade.action === 'BUY') {
        acc[trade.symbol].buys += trade.amountUsd;
        acc[trade.symbol].netUsd += trade.amountUsd;
      } else {
        acc[trade.symbol].sells += trade.amountUsd;
        acc[trade.symbol].netUsd -= trade.amountUsd;
      }
      return acc;
    }, {} as Record<string, any>)
  });
});

/**
 * GET /api/kraken/mode
 * Get current trading mode (paper or live)
 */
app.get('/api/kraken/mode', (req, res) => {
  const mode = getTradingMode();
  const isPaper = isPaperTradingMode();
  res.json({
    mode,
    isPaper,
    label: isPaper ? '📄 PAPER TRADING' : '💰 LIVE TRADING',
    warning: !isPaper ? 'Real money trading is ENABLED. All orders will execute with real funds.' : 'Paper trading mode — no real funds affected.'
  });
});

/**
 * GET /api/kraken/ticker/:pair
 * Fetch live ticker data for a trading pair
 * Example: /api/kraken/ticker/XBT%2FUSD
 */
app.get('/api/kraken/ticker/:pair', async (req, res) => {
  const pair = decodeURIComponent(req.params.pair);
  const marketData = await fetchMarketData(pair);
  
  if (!marketData) {
    return res.status(500).json({ error: `Failed to fetch ticker for pair: ${pair}` });
  }

  res.json({
    pair: marketData.pair,
    price: marketData.price,
    bid: marketData.bid,
    ask: marketData.ask,
    volume: marketData.volume,
    vwap: marketData.vwap,
    high: marketData.high,
    low: marketData.low,
    timestamp: marketData.timestamp,
    spread: ((marketData.ask - marketData.bid) / marketData.price * 100).toFixed(3)
  });
});

/**
 * GET /api/kraken/balance
 * Fetch account balance (requires API credentials)
 */
app.get('/api/kraken/balance', async (req, res) => {
  const balance = await fetchAccountBalance();

  if (!balance) {
    return res.status(500).json({
      error: 'Failed to fetch account balance. Check API credentials and network connection.',
      mode: getTradingMode()
    });
  }

  // Convert balance object to readable format
  const formatted = Object.entries(balance).reduce((acc, [asset, amount]) => {
    acc[asset] = parseFloat(amount as string);
    return acc;
  }, {} as Record<string, number>);

  res.json({
    balances: formatted,
    timestamp: new Date().toISOString(),
    mode: getTradingMode()
  });
});

/**
 * GET /api/kraken/orders
 * Get open orders (requires API credentials)
 */
app.get('/api/kraken/orders', async (req, res) => {
  const orders = await fetchOpenOrders();

  if (!orders) {
    return res.status(500).json({
      error: 'Failed to fetch open orders',
      mode: getTradingMode()
    });
  }

  res.json({
    orders,
    count: Object.keys(orders).length,
    timestamp: new Date().toISOString(),
    mode: getTradingMode()
  });
});

/**
 * POST /api/kraken/order
 * Place a market or limit order
 *
 * Request body:
 * {
 *   "pair": "XBT/USD",
 *   "type": "buy" | "sell",
 *   "ordertype": "market" | "limit",
 *   "amount": 1000,  // USD amount
 *   "price": 45000   // for limit orders only
 * }
 */
app.post('/api/kraken/order', async (req, res) => {
  const { pair, type, ordertype, amount, price } = req.body;

  // Validate input
  if (!pair || !type || !ordertype || !amount) {
    return res.status(400).json({
      error: 'Missing required fields: pair, type, ordertype, amount'
    });
  }

  if (!['buy', 'sell'].includes(type)) {
    return res.status(400).json({ error: 'Type must be "buy" or "sell"' });
  }

  if (!['market', 'limit'].includes(ordertype)) {
    return res.status(400).json({ error: 'Ordertype must be "market" or "limit"' });
  }

  if (ordertype === 'limit' && !price) {
    return res.status(400).json({ error: 'Price is required for limit orders' });
  }

  try {
    // Fetch current price to calculate volume
    const marketData = await fetchMarketData(pair);
    if (!marketData) {
      return res.status(500).json({ error: `Could not fetch market data for ${pair}` });
    }

    // Use provided price or market price for volume calculation
    const priceForCalc = ordertype === 'limit' ? price : marketData.price;
    const volume = calculateOrderVolume(amount, priceForCalc);

    // Execute the order
    const order = {
      pair,
      type: type as 'buy' | 'sell',
      ordertype: ordertype as 'market' | 'limit',
      volume,
      ...(price && { price: price.toString() })
    };

    const result = await executeOrder(order);

    if (!result) {
      return res.status(500).json({
        error: 'Failed to execute order',
        mode: getTradingMode(),
        details: isPaperTradingMode()
          ? 'Paper trading is enabled. Run `kraken paper init` and verify KRAKEN_SANDBOX=true before placing orders.'
          : 'Check logs for more information.'
      });
    }

    res.json({
      success: true,
      txid: result.txid,
      descr: result.descr,
      order: {
        pair,
        type,
        ordertype,
        amount,
        price: ordertype === 'limit' ? price : 'market',
        volume,
        executedAt: new Date().toISOString()
      },
      mode: getTradingMode(),
      warning: isPaperTradingMode() ? '📄 This is a PAPER TRADE - no real funds were used.' : '💰 LIVE TRADE EXECUTED - Real funds have been transferred.'
    });
  } catch (error) {
    console.error('[API] Order execution error:', error);
    res.status(500).json({
      error: 'Order execution failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      mode: getTradingMode()
    });
  }
});

app.use(express.static('../client/dist'));

app.listen(PORT, () => {
  initializeKrakenClient();
  initializeErc8004Startup().catch((error) => {
    console.error('[ERC8004] Startup initialization error:', error);
  });
  streamAgentDecisions();
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║  AI Crypto Agent backend running on http://localhost:${PORT}  ║`);
  console.log(`║  Trading Mode: ${isPaperTradingMode() ? '📄 PAPER TRADING (Sandbox)' : '💰 LIVE TRADING'}                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);
});
