/**
 * Shared TypeScript interfaces for the AI trading agent.
 */

export interface MarketData {
  pair: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  vwap: number;
  high: number;
  low: number;
  timestamp: number;
}

export type TradeAction = "BUY" | "SELL" | "HOLD";

export interface TradeDecision {
  action: TradeAction;
  asset: string;
  pair: string;
  amount: number;
  confidence: number;
  reasoning: string;
}

export interface TradingStrategy {
  analyze(data: MarketData): Promise<TradeDecision>;
}

export interface AgentRegistration {
  agentId: bigint;
  operatorWallet: string;
  agentWallet: string;
  name: string;
  description: string;
  capabilities: string[];
  registeredAt: number;
  active: boolean;
}

export interface TradeIntent {
  agentId: bigint;
  agentWallet: string;
  pair: string;
  action: "BUY" | "SELL";
  amountUsdScaled: bigint;
  maxSlippageBps: bigint;
  nonce: bigint;
  deadline: bigint;
}

export interface SignedTradeIntent {
  intent: TradeIntent;
  signature: string;
  intentHash: string;
}

export interface TradeCheckpoint {
  agentId: string;
  timestamp: number;
  action: TradeAction;
  asset: string;
  pair: string;
  amountUsd: number;
  priceUsd: number;
  reasoning: string;
  reasoningHash: string;
  confidence: number;
  intentHash: string;
  signature: string;
  signerAddress: string;
}

export interface KrakenOrder {
  pair: string;
  type: "buy" | "sell";
  ordertype: "market" | "limit";
  volume: string;
  price?: string;
}

export interface KrakenOrderResult {
  txid: string[];
  descr: { order: string };
}
