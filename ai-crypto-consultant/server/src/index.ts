import express from 'express';
import cors from 'cors';
import axios from 'axios';

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
  selected: ['BTC', 'ETH', 'SOL', 'ALGO'],
  allocations: { BTC: 35, ETH: 30, SOL: 20, ALGO: 15 },
  controls: { sustainabilityTarget: 80, legitimacyMin: 70, trading: 'running' }
};

const krakenPairMap: Record<string, string> = {
  BTC: 'XBT/USD',
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

const agentState = {
  trading: 'running' as 'running' | 'paused' | 'stopped',
  sustainabilityTarget: 80,
  legitimacyMin: 70,
  lastDecision: null as null | Record<string, any>,
  listeners: new Set<express.Response>(),
  intervalId: null as NodeJS.Timeout | null
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
  agentState.intervalId = setInterval(async () => {
    if (agentState.trading !== 'running') return;
    const portfolio = await getPortfolio();
    const weights = portfolio.allocations || {};
    const selected = portfolio.selected || [];
    if (!selected.length) return;
    const chosenSymbol = selected[Math.floor(Math.random() * selected.length)];
    const message = `🔍 Scanning portfolio for rebalancing opportunities...`;
    broadcastDecision(formatDecision(message, { portfolioSize: selected.length }));
    const change = Math.round((Math.random() * 3 + 1) * 10) / 10;
    const secondary = `🌿 Portfolio sustainability target is ${agentState.sustainabilityTarget}, reviewing ${chosenSymbol}.`;
    broadcastDecision(formatDecision(secondary, { symbol: chosenSymbol, target: agentState.sustainabilityTarget }));
    const action = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const amount = Math.floor(Math.random() * 500 + 120);
    const executed = `✅ Decision: ${action} $${amount} of ${chosenSymbol} to align with strategy.`;
    broadcastDecision(formatDecision(executed, { action, amount, symbol: chosenSymbol }));
  }, 5500);
}

function stopAgentStream() {
  if (agentState.intervalId) {
    clearInterval(agentState.intervalId);
    agentState.intervalId = null;
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
    broadcastDecision(formatDecision('⏸️ Agent paused by user command.', { command }));
    return res.json({ status: 'paused' });
  }

  if (normalized === '/resume') {
    agentState.trading = 'running';
    broadcastDecision(formatDecision('▶️ Agent resumed trading.', { command }));
    return res.json({ status: 'running' });
  }

  if (normalized === '/stop') {
    agentState.trading = 'stopped';
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

  return res.status(400).json({ error: 'Unknown command' });
});

app.get('/api/market', async (req, res) => {
  const prices = await Promise.all(assetList.map(async (asset) => ({ symbol: asset.symbol, market: await getPriceForAsset(asset) })));
  res.json({ prices });
});

app.use(express.static('../client/dist'));

app.listen(PORT, () => {
  streamAgentDecisions();
  console.log(`AI Crypto Agent backend running on http://localhost:${PORT}`);
});
