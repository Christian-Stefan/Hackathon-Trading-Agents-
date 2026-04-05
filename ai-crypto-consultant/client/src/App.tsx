import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip
} from 'recharts';

const categories = [
  { key: 'greenLegit', label: '🌱 Green & Legit' },
  { key: 'blueChips', label: '💎 Established Blue Chips' },
  { key: 'emerging', label: '🔬 Emerging Green' },
  { key: 'highSustain', label: '⚡ High Sustainability' },
  { key: 'audited', label: '✅ Fully Audited' }
] as const;

type CategoryKey = (typeof categories)[number]['key'];

const categoryFilter: Record<CategoryKey, (asset: Asset) => boolean> = {
  greenLegit: (asset: Asset) => asset.greenLegitScore >= 85 && asset.legitimacyScore >= 80 && asset.sustainabilityScore >= 80,
  blueChips: (asset: Asset) => ['BTC', 'ETH'].includes(asset.symbol),
  emerging: (asset: Asset) => asset.category === 'Emerging Green',
  highSustain: (asset: Asset) => asset.sustainabilityScore >= 80,
  audited: (asset: Asset) => asset.audited
};

const sustainabilityPalette = {
  Green: '#22c55e',
  Yellow: '#eab308',
  Red: '#ef4444'
};

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
  tokenDistribution: any;
  githubCommits: number[];
  sustainabilityNotes: string;
  redFlags: any;
  description: string;
  market: { price: number; change: number; volume: number };
  greenLegitScore: number;
}

interface PortfolioMetrics {
  totalValue: number;
  totalReturn: number;
  todayPnL: number;
  weightedSustainability: number;
  weightedLegitimacy: number;
  carbonFootprint: number;
  treesNeeded: number;
  positions: any[];
}

interface Erc8004Contracts {
  agentRegistry: string | null;
  hackathonVault: string | null;
  riskRouter: string | null;
  reputationRegistry: string | null;
  validationRegistry: string | null;
}

interface Erc8004AgentIdentity {
  agentId: string | null;
  operatorWallet: string | null;
  agentWallet: string | null;
  name: string | null;
  description: string | null;
  capabilities: string[];
  registeredAt: number | null;
  active: boolean | null;
  error?: string;
}

interface Erc8004Status {
  contracts: Erc8004Contracts;
  agentId: string | null;
  onchainProvider: boolean;
  agentIdentity: Erc8004AgentIdentity;
  errors: string[];
}

interface Erc8004Checkpoint {
  timestamp: string;
  action: string;
  pair: string;
  amountUsd: number;
  priceUsd: number;
  confidence: number;
  intentHash: string;
  signerAddress: string;
  checkpointHash?: string;
}

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

interface ExecutionSummary {
  executions: ExecutedTrade[];
  totalCount: number;
  bySymbol: Record<string, { buys: number; sells: number; netUsd: number }>;
}

function App() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>(categories[0].key);
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [modalAsset, setModalAsset] = useState<Asset | null>(null);
  const [assetTab, setAssetTab] = useState<'legitimacy' | 'sustainability' | 'thesis'>('legitimacy');
  const [portfolioMetrics, setPortfolioMetrics] = useState<PortfolioMetrics | null>(null);
  const [sustainabilityReport, setSustainabilityReport] = useState<any>(null);
  const [erc8004Status, setErc8004Status] = useState<Erc8004Status | null>(null);
  const [erc8004Checkpoints, setErc8004Checkpoints] = useState<Erc8004Checkpoint[]>([]);
  const [executions, setExecutions] = useState<ExecutionSummary | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [command, setCommand] = useState('');
  const [commandResponse, setCommandResponse] = useState<string>('');
  const [agentStatus, setAgentStatus] = useState('running');
  const [controls, setControls] = useState({ sustainabilityTarget: 80, legitimacyMin: 70 });

  useEffect(() => {
    async function load() {
      const [assetRes, portfolioRes, perfRes, reportRes, ercStatusRes, ercCheckpointsRes, execRes] = await Promise.all([
        axios.get<Asset[]>('/api/assets'),
        axios.get('/api/portfolio'),
        axios.get('/api/performance'),
        axios.get('/api/sustainability_report'),
        axios.get<Erc8004Status>('/api/erc8004/status'),
        axios.get<Erc8004Checkpoint[]>('/api/erc8004/checkpoints'),
        axios.get<ExecutionSummary>('/api/executions')
      ]);
      setAssets(assetRes.data);
      setSelectedAssets(portfolioRes.data.selected || []);
      setControls({
        sustainabilityTarget: portfolioRes.data.strategy?.sustainabilityTarget ?? 80,
        legitimacyMin: portfolioRes.data.strategy?.legitimacyMin ?? 70
      });
      setPortfolioMetrics(perfRes.data);
      setSustainabilityReport(reportRes.data);
      setErc8004Status(ercStatusRes.data);
      setErc8004Checkpoints(ercCheckpointsRes.data);
      setExecutions(execRes.data);
    }
    load();
  }, []);

  useEffect(() => {
    const source = new EventSource('/api/agent/decisions/live');
    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLogs((logs) => [data, ...logs].slice(0, 50));
      } catch {
        setLogs((logs) => [{ timestamp: new Date().toISOString(), message: event.data }, ...logs].slice(0, 50));
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const [perf, report, ercStatusRes, ercCheckpointsRes, execRes] = await Promise.all([
        axios.get<PortfolioMetrics>('/api/performance'),
        axios.get('/api/sustainability_report'),
        axios.get<Erc8004Status>('/api/erc8004/status'),
        axios.get<Erc8004Checkpoint[]>('/api/erc8004/checkpoints'),
        axios.get<ExecutionSummary>('/api/executions')
      ]);
      setPortfolioMetrics(perf.data);
      setSustainabilityReport(report.data);
      setErc8004Status(ercStatusRes.data);
      setErc8004Checkpoints(ercCheckpointsRes.data);
      setExecutions(execRes.data);
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const filteredAssets = useMemo(
    () => assets.filter(categoryFilter[selectedCategory]),
    [assets, selectedCategory]
  );

  const categoryCounts = useMemo(
    () => categories.map((tab) => ({
      ...tab,
      count: assets.filter(categoryFilter[tab.key as keyof typeof categoryFilter]).length
    })),
    [assets]
  );

  const handleSelect = async (symbol: string) => {
    const next = selectedAssets.includes(symbol)
      ? selectedAssets.filter((item) => item !== symbol)
      : [...selectedAssets, symbol];
    setSelectedAssets(next);
    await axios.post('/api/portfolio', { selected: next, allocations: {} , controls });
  };

  const currentPositions = useMemo(() => portfolioMetrics?.positions || [], [portfolioMetrics]);

  const sustainabilityPie = useMemo(() => {
    const data = ['Green', 'Yellow', 'Red'].map((key) => ({
      name: key,
      value: sustainabilityReport?.breakdown.filter((item: any) => item.tier === key).length || 0
    }));
    return data;
  }, [sustainabilityReport]);

  const handleCommand = async (inputCommand?: string) => {
    const commandToSend = inputCommand ?? command;
    if (!commandToSend.trim()) return;
    try {
      const res = await axios.post('/api/agent/command', { command: commandToSend });
      setCommandResponse(JSON.stringify(res.data, null, 2));
      setCommand('');
      if (res.data.status) setAgentStatus(res.data.status);
      if (res.data.sustainabilityTarget) setControls((prev) => ({ ...prev, sustainabilityTarget: res.data.sustainabilityTarget }));
      if (res.data.legitimacyMin) setControls((prev) => ({ ...prev, legitimacyMin: res.data.legitimacyMin }));
    } catch (error: any) {
      setCommandResponse(error?.response?.data?.error || 'Command failed');
    }
  };

  const selectedAssetDetails = useMemo(() => {
    return assets.filter((asset) => selectedAssets.includes(asset.symbol));
  }, [assets, selectedAssets]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">AI Crypto Consulting Agent</p>
              <h1 className="mt-3 text-4xl font-semibold text-white">Green Legit Crypto Portfolio</h1>
              <p className="mt-2 max-w-2xl text-slate-400">
                Discover environmentally sustainable, legitimate crypto assets and deploy a transparent AI trading agent with live decision logs.
              </p>
            </div>
            <div className="space-y-1 rounded-3xl border border-slate-800 bg-slate-950/80 p-4 text-slate-300 shadow-sm">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span>Agent status</span>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">{agentStatus}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-900 p-3">
                  <p className="text-[0.75rem] uppercase tracking-[0.18em] text-slate-400">Sustainability target</p>
                  <p className="mt-1 text-lg font-semibold text-white">{controls.sustainabilityTarget}%</p>
                </div>
                <div className="rounded-2xl bg-slate-900 p-3">
                  <p className="text-[0.75rem] uppercase tracking-[0.18em] text-slate-400">Legitimacy min</p>
                  <p className="mt-1 text-lg font-semibold text-white">{controls.legitimacyMin}%</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-glow">
          <h2 className="text-lg font-semibold text-white">Asset Categories</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {categoryCounts.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedCategory(tab.key)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${selectedCategory === tab.key ? 'border-emerald-400 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'}`}>
                <div className="flex items-center justify-between gap-3">
                  <span>{tab.label}</span>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-400">{tab.count}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Screening Dashboard</p>
                <h2 className="text-2xl font-semibold text-white">Selected {filteredAssets.length} assets</h2>
              </div>
              <div className="rounded-3xl bg-slate-900 px-4 py-3 text-slate-300 shadow-sm">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Selected portfolio</p>
                <p className="mt-2 text-xl font-semibold text-white">{selectedAssets.length} assets</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAssets.map((asset) => (
                <div key={asset.symbol} className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-glow">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{asset.category}</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">{asset.name} <span className="text-slate-400">({asset.symbol})</span></h3>
                    </div>
                    <button
                      onClick={() => handleSelect(asset.symbol)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${selectedAssets.includes(asset.symbol) ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
                      {selectedAssets.includes(asset.symbol) ? 'SELECTED' : 'SELECT'}
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Green Legit</p>
                      <p className="mt-2 text-2xl font-semibold text-white">{asset.greenLegitScore}/100</p>
                      <div className="mt-3 space-y-1 text-sm text-slate-400">
                        <p>✅ Legitimacy: {asset.legitimacyScore}/100</p>
                        <p>🌱 Sustainability: {asset.sustainabilityScore}/100</p>
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-900 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Market snapshot</p>
                      <p className="mt-2 text-2xl font-semibold text-white">${asset.market.price.toLocaleString()}</p>
                      <p className={`mt-2 text-sm ${asset.market.change >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>{asset.market.change >= 0 ? '+' : ''}{asset.market.change}%</p>
                      <p className="mt-2 text-xs text-slate-500">Vol: {asset.market.volume.toFixed(1)}M</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setModalAsset(asset); setAssetTab('legitimacy'); }}
                    className="mt-5 w-full rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-700">
                    View full profile
                  </button>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <h2 className="text-lg font-semibold text-white">Portfolio Summary</h2>
              <div className="mt-4 space-y-4 text-slate-300">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-950 p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Total value</p>
                    <p className="mt-2 text-3xl font-semibold text-white">${portfolioMetrics?.totalValue.toLocaleString() ?? '---'}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950 p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Today's P&L</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{portfolioMetrics?.todayPnL ?? '---'}%</p>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-950 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Weighted averages</p>
                  <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300">
                    <p>🌿 Sustainability: {portfolioMetrics?.weightedSustainability ?? '---'}%</p>
                    <p>✅ Legitimacy: {portfolioMetrics?.weightedLegitimacy ?? '---'}%</p>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-950 p-4">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Carbon footprint</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{portfolioMetrics?.carbonFootprint ?? '---'} t/yr</p>
                  <p className="mt-1 text-sm text-slate-400">Trees needed: {portfolioMetrics?.treesNeeded ?? '---'}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <h2 className="text-lg font-semibold text-white">ERC-8004 Transparency</h2>
              <div className="mt-4 space-y-4 text-slate-300">
                <div className="rounded-3xl bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Agent identity</p>
                  <p className="mt-2 text-sm text-slate-200">ID: {erc8004Status?.agentIdentity.agentId ?? 'Not configured'}</p>
                  <p className="mt-1 text-sm text-slate-200">Active: {erc8004Status?.agentIdentity.active === null ? 'Unknown' : erc8004Status?.agentIdentity.active ? 'Yes' : 'No'}</p>
                  <p className="mt-1 text-sm text-slate-200">Wallet: {erc8004Status?.agentIdentity.agentWallet ?? '—'}</p>
                  {erc8004Status?.agentIdentity.error && (
                    <p className="mt-2 text-xs text-amber-300">{erc8004Status.agentIdentity.error}</p>
                  )}
                </div>
                <div className="rounded-3xl bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Registry contracts</p>
                  <div className="mt-3 space-y-2 text-sm text-slate-200">
                    <p>Agent: {erc8004Status?.contracts.agentRegistry ?? '—'}</p>
                    <p>Vault: {erc8004Status?.contracts.hackathonVault ?? '—'}</p>
                    <p>RiskRouter: {erc8004Status?.contracts.riskRouter ?? '—'}</p>
                    <p>Reputation: {erc8004Status?.contracts.reputationRegistry ?? '—'}</p>
                    <p>Validation: {erc8004Status?.contracts.validationRegistry ?? '—'}</p>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-950 p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Latest checkpoint</p>
                  {erc8004Checkpoints?.[0] ? (
                    <div className="mt-3 space-y-2 text-sm text-slate-200">
                      <p>{new Date(erc8004Checkpoints[0].timestamp).toLocaleString()}</p>
                      <p>{erc8004Checkpoints[0].action} {erc8004Checkpoints[0].pair} (${erc8004Checkpoints[0].amountUsd})</p>
                      <p>Confidence: {erc8004Checkpoints[0].confidence}%</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No ERC-8004 checkpoints found</p>
                  )}
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <h2 className="text-lg font-semibold text-white">Strategy Controls</h2>
              <div className="mt-4 space-y-4 text-slate-300">
                <button onClick={() => handleCommand('/pause')} className="w-full rounded-2xl bg-slate-800 px-4 py-3 text-left text-sm font-semibold text-slate-100 hover:bg-slate-700">⏸️ /pause</button>
                <button onClick={() => handleCommand('/resume')} className="w-full rounded-2xl bg-slate-800 px-4 py-3 text-left text-sm font-semibold text-slate-100 hover:bg-slate-700">▶️ /resume</button>
                <button onClick={() => handleCommand('/stop')} className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-rose-500">🛑 /stop</button>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <h2 className="text-lg font-semibold text-white">Manual Trade Commands</h2>
              <p className="mt-2 text-xs text-slate-400">Test ERC-8004 & Kraken integration with manual trades</p>
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., PEPE 100"
                    className="flex-1 rounded-2xl bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommand(`/buy ${(e.target as HTMLInputElement).value}`);
                    }}
                  />
                  <button onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    handleCommand(`/buy ${input.value}`);
                    input.value = '';
                  }} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">💰 BUY</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g., PEPE 100"
                    className="flex-1 rounded-2xl bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-rose-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCommand(`/sell ${(e.target as HTMLInputElement).value}`);
                    }}
                  />
                  <button onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    handleCommand(`/sell ${input.value}`);
                    input.value = '';
                  }} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">📉 SELL</button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
              <h2 className="text-lg font-semibold text-white">Execution History</h2>
              <p className="mt-2 text-xs text-slate-400">💰 = Locked-in positions (actual buys)</p>
              <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto">
                {executions && executions.executions.length > 0 ? (
                  <>
                    <div className="mb-3 rounded-2xl bg-slate-950 p-3">
                      <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Summary by asset</p>
                      <div className="mt-2 space-y-1 text-sm text-slate-300">
                        {Object.entries(executions.bySymbol).map(([symbol, data]: [string, any]) => (
                          <p key={symbol}>
                            {symbol}: 🟢 +${data.buys.toFixed(2)} | 🔴 -${data.sells.toFixed(2)} | Net: ${data.netUsd.toFixed(2)}
                          </p>
                        ))}
                      </div>
                    </div>
                    {executions.executions.slice(0, 5).map((trade, i) => (
                      <div key={i} className="rounded-2xl bg-slate-950 p-3">
                        <p className="text-xs text-slate-400">{new Date(trade.timestamp).toLocaleString()}</p>
                        <p className="mt-1 text-sm font-semibold text-white">
                          {trade.action === 'BUY' ? '🟢' : '🔴'} {trade.action} ${trade.amountUsd} of {trade.symbol}
                        </p>
                        <p className="text-xs text-slate-500">@ ${trade.priceUsd.toFixed(2)} | {trade.source}</p>
                      </div>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-slate-400">No executions yet. Use manual trade commands above to lock in positions.</p>
                )}
              </div>
            </div>

          </aside>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
          <h2 className="text-lg font-semibold text-white">Live Agent Decision Log</h2>
          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-2">
            {logs.length === 0 && <p className="text-slate-400">Waiting for agent updates...</p>}
            {logs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="rounded-3xl border border-slate-800 bg-slate-950 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</p>
                    <p className="mt-2 text-sm text-slate-100">{log.message}</p>
                  </div>
                  <button
                    onClick={() => window.alert(JSON.stringify(log.details || { reason: 'No details available' }, null, 2))}
                    className="rounded-2xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700">
                    Why?
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
          <h2 className="text-lg font-semibold text-white">Current Positions</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500">
                  <th className="py-3 px-3">Asset</th>
                  <th className="py-3 px-3">Value</th>
                  <th className="py-3 px-3">% of Port</th>
                  <th className="py-3 px-3">P&L</th>
                  <th className="py-3 px-3">Legitimacy</th>
                  <th className="py-3 px-3">Sustainability</th>
                  <th className="py-3 px-3">Agent Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {currentPositions.map((position) => (
                  <tr key={position.symbol} className="border-b border-slate-800">
                    <td className="py-4 px-3 font-semibold text-white">{position.symbol}</td>
                    <td className="py-4 px-3">${position.value.toLocaleString()}</td>
                    <td className="py-4 px-3">{position.pct}%</td>
                    <td className={`py-4 px-3 ${position.pnl >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>{position.pnl}%</td>
                    <td className="py-4 px-3">{position.legitimacyScore}</td>
                    <td className="py-4 px-3">{position.sustainabilityScore}</td>
                    <td className="py-4 px-3 text-slate-400">Core anchor with sustainable or legitimate exposure.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-glow">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div>
              <h2 className="text-lg font-semibold text-white">Command Console</h2>
              <p className="mt-2 text-slate-400">Use chat-style commands to control the AI agent and portfolio strategy.</p>
              <div className="mt-4 flex flex-col gap-3">
                <input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="/pause, /resume, /set sustainability_target 80"
                  className="rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-emerald-400"
                />
                <div className="flex gap-3">
                  <button onClick={() => handleCommand()} className="rounded-3xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">Send</button>
                  <button onClick={() => setCommand('/rebalance now')} className="rounded-3xl bg-slate-800 px-5 py-3 text-slate-100 transition hover:bg-slate-700">Rebalance</button>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 text-slate-300">
              <p className="mb-3 text-sm uppercase tracking-[0.2em] text-slate-500">Response</p>
              <pre className="max-h-40 overflow-auto text-xs leading-5 text-slate-200">{commandResponse || 'No command executed yet.'}</pre>
            </div>
          </div>
        </section>
      </div>

      {modalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
          <div className="w-full max-w-5xl rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">{modalAsset.category}</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">{modalAsset.name} ({modalAsset.symbol})</h2>
                <p className="mt-2 text-slate-400">{modalAsset.description}</p>
              </div>
              <button onClick={() => setModalAsset(null)} className="rounded-2xl bg-slate-800 px-4 py-2 text-slate-200 hover:bg-slate-700">Close</button>
            </div>
            <div className="grid gap-6 lg:grid-cols-[0.9fr_0.7fr] px-6 py-6">
              <div>
                <div className="flex flex-wrap gap-3">
                  {['legitimacy', 'sustainability', 'thesis'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setAssetTab(tab as any)}
                      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${assetTab === tab ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}>
                      {tab === 'legitimacy' ? 'Legitimacy Analysis' : tab === 'sustainability' ? 'Environmental Sustainability' : 'Verdict & Thesis'}
                    </button>
                  ))}
                </div>
                <div className="mt-6 space-y-6">
                  {assetTab === 'legitimacy' && (
                    <div className="space-y-5">
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <h3 className="text-xl font-semibold text-white">Team transparency</h3>
                        <p className="mt-3 text-slate-300">{modalAsset.teamTransparency}. Public profile and team disclosures impact legitimacy.</p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl bg-slate-950 p-5">
                          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Launch year</p>
                          <p className="mt-3 text-2xl font-semibold text-white">{modalAsset.launchYear}</p>
                          <p className="mt-2 text-slate-300">Track record and ecosystem maturity.</p>
                        </div>
                        <div className="rounded-3xl bg-slate-950 p-5">
                          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Audit status</p>
                          <p className="mt-3 text-2xl font-semibold text-white">{modalAsset.audited ? 'Audited' : 'Not audited'}</p>
                          <p className="mt-2 text-slate-300">{modalAsset.auditor ? `Auditor: ${modalAsset.auditor}` : 'No reputable audit recorded.'}</p>
                        </div>
                      </div>
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">GitHub activity</p>
                          <p className="text-sm text-slate-300">{modalAsset.githubActivity}</p>
                        </div>
                        <div className="mt-5 h-52 rounded-3xl bg-slate-900 p-4">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={modalAsset.githubCommits.map((value, index) => ({ month: `M${index + 1}`, value }))}>
                              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                              <XAxis dataKey="month" tick={{ fill: '#94a3b8' }} />
                              <YAxis tick={{ fill: '#94a3b8' }} />
                              <Tooltip formatter={(value: number) => `${value} commits`} />
                              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={3} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <h3 className="text-xl font-semibold text-white">Token distribution</h3>
                        <p className="mt-2 text-slate-300">{modalAsset.tokenDistribution.notes}</p>
                      </div>
                      <div className="rounded-3xl bg-rose-950/40 border border-rose-500/20 p-5">
                        <h3 className="text-xl font-semibold text-rose-300">Red flags</h3>
                        <ul className="mt-3 space-y-2 text-slate-300">
                          {Object.entries(modalAsset.redFlags).map(([key, value]) => (
                            <li key={key} className={`${value ? 'text-rose-200' : 'text-slate-400'}`}>
                              {key.replace(/([A-Z])/g, ' $1')}: {value ? 'Yes' : 'No'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {assetTab === 'sustainability' && (
                    <div className="space-y-5">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-3xl bg-slate-950 p-5">
                          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Consensus</p>
                          <p className="mt-3 text-2xl font-semibold text-white">{modalAsset.consensus}</p>
                          <p className="mt-2 text-slate-300">A critical component of eco-impact.</p>
                        </div>
                        <div className="rounded-3xl bg-slate-950 p-5">
                          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Energy / tx</p>
                          <p className="mt-3 text-2xl font-semibold text-white">{modalAsset.energyPerTx} kWh</p>
                          <p className="mt-2 text-slate-300">Visa baseline is 0.002 kWh per transaction.</p>
                        </div>
                      </div>
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Carbon footprint estimate</p>
                        <p className="mt-3 text-2xl font-semibold text-white">{(modalAsset.energyPerTx * 0.0004).toFixed(3)} t CO2/tx</p>
                        <p className="mt-2 text-slate-300">Energy mix and offset programs are included in sustainability scoring.</p>
                      </div>
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <h3 className="text-xl font-semibold text-white">Sustainability initiatives</h3>
                        <p className="mt-3 text-slate-300">{modalAsset.sustainabilityNotes}</p>
                      </div>
                    </div>
                  )}

                  {assetTab === 'thesis' && (
                    <div className="space-y-5">
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <h3 className="text-xl font-semibold text-white">Verdict</h3>
                        <p className="mt-3 text-slate-300">{modalAsset.legitimacyScore >= 70 && modalAsset.sustainabilityScore >= 70 ? 'This asset presents a balanced profile with a strong position in the green legitimacy framework.' : 'This asset needs careful monitoring due to lower legitimacy or sustainability metrics.'}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <h3 className="text-xl font-semibold text-white">Risk factors</h3>
                        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
                          <li>Team transparency: {modalAsset.teamTransparency}</li>
                          <li>Audit status: {modalAsset.audited ? 'Audited' : 'No audit'}</li>
                          <li>Energy impact: {modalAsset.energyPerTx} kWh per tx</li>
                        </ul>
                      </div>
                      <div className="rounded-3xl bg-slate-950 p-5">
                        <h3 className="text-xl font-semibold text-white">Investment thesis</h3>
                        <p className="mt-3 text-slate-300">{modalAsset.legitimacyScore > 80 ? 'A strong candidate for long-term allocation with sustainability credentials supporting the thesis.' : 'Use a smaller tactical allocation due to lower legitimacy or team transparency concerns.'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-3xl bg-slate-950 p-5">
                <div className="space-y-4">
                  <div className="rounded-3xl bg-slate-900 p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Score</p>
                    <p className="mt-2 text-4xl font-semibold text-emerald-300">{modalAsset.greenLegitScore}/100</p>
                  </div>
                  <div className="rounded-3xl bg-slate-900 p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Legitimacy</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{modalAsset.legitimacyScore}/100</p>
                  </div>
                  <div className="rounded-3xl bg-slate-900 p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Sustainability</p>
                    <p className="mt-2 text-3xl font-semibold text-white">{modalAsset.sustainabilityScore}/100</p>
                  </div>
                  <div className="rounded-3xl bg-slate-900 p-4">
                    <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Exchange listing</p>
                    <p className="mt-2 text-slate-300">{modalAsset.exchangeListing}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
