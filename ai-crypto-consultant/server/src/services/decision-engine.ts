/**
 * Decision Engine for Kraken-integrated Agent Trading
 *
 * This module orchestrates real trading decisions using:
 * 1. Real market data from Kraken
 * 2. Portfolio state and constraints
 * 3. Trading strategy (momentum, LLM-based, etc.)
 * 4. Risk management (position sizing, sustainability filters)
 */

import fs from 'fs';
import path from 'path';
import {
  fetchMarketData,
  fetchAccountBalance,
  executeOrder,
  getTradingMode,
  calculateOrderVolume
} from './kraken-service';
import { MomentumStrategy } from '../agent/strategy';
import { MarketData, TradeDecision } from '../types/index';
import { runAgent } from '../agent/index';

const CHECKPOINTS_FILE = path.join(process.cwd(), 'checkpoints.jsonl');

type TradingMode = 'running' | 'paused' | 'stopped';

interface DecisionEngineConfig {
  sustainabilityTarget: number;
  legitimacyMin: number;
  maxOrderUsd: number; // Max USD per order
  selectedAssets: string[];
  krakenPairMap: Record<string, string>;
}

interface DecisionResult {
  timestamp: string;
  message: string;
  decision?: TradeDecision;
  executed?: boolean;
  txid?: string[];
  error?: string;
  tradingMode: 'paper' | 'live';
}

/**
 * The main decision engine that drives agent trading
 */
export class DecisionEngine {
  private strategy: MomentumStrategy;
  private config: DecisionEngineConfig;
  private tradingMode: TradingMode = 'running';

  constructor(config: DecisionEngineConfig) {
    this.strategy = new MomentumStrategy(5, 100); // 5-sample momentum, $100 per trade
    this.config = config;
  }

  /**
   * Analyze a single asset and potentially execute a trade
   */
  async analyzeAndTrade(
    symbol: string
  ): Promise<DecisionResult> {
    const pair = this.config.krakenPairMap[symbol];
    const timestamp = new Date().toISOString();

    if (!pair) {
      return {
        timestamp,
        message: `❌ Unknown symbol: ${symbol}`,
        error: 'Symbol not found in Kraken pair map',
        tradingMode: getTradingMode()
      };
    }

    // Fetch real market data from Kraken
    const marketData = await fetchMarketData(pair);
    if (!marketData) {
      return {
        timestamp,
        message: `📡 Could not fetch market data for ${symbol}/${pair}`,
        error: 'Market data unavailable',
        tradingMode: getTradingMode()
      };
    }

    // Analyze using trading strategy
    const decision = await this.strategy.analyze(marketData);

    // Log decision
    const decisionMsg = `🔍 Analyzed ${symbol}: ${decision.action} (confidence: ${(decision.confidence * 100).toFixed(0)}%)`;
    console.log(`[DecisionEngine] ${decisionMsg}`);
    console.log(`[DecisionEngine] Reasoning: ${decision.reasoning}`);

    // If HOLD, no execution
    if (decision.action === 'HOLD') {
      return {
        timestamp,
        message: decisionMsg,
        decision,
        executed: false,
        tradingMode: getTradingMode()
      };
    }

    // Execute trade for BUY/SELL
    try {
      const volume = calculateOrderVolume(decision.amount, marketData.price);
      const order = {
        pair,
        type: decision.action === 'BUY' ? 'buy' as const : 'sell' as const,
        ordertype: 'market' as const,
        volume
      };

      const result = await executeOrder(order);
      if (!result) {
        return {
          timestamp,
          message: `❌ Failed to execute ${decision.action} order for ${symbol}`,
          decision,
          executed: false,
          error: 'Order execution failed',
          tradingMode: getTradingMode()
        };
      }

      // Generate and persist ERC-8004 checkpoint for trade audit trail
      await this.logCheckpoint(decision, marketData, symbol);

      const executedMsg = `✅ ${decision.action} $${decision.amount} of ${symbol} at $${marketData.price.toFixed(2)}`;
      return {
        timestamp,
        message: executedMsg,
        decision,
        executed: true,
        txid: result.txid,
        tradingMode: getTradingMode()
      };
    } catch (error) {
      return {
        timestamp,
        message: `❌ Error executing trade for ${symbol}`,
        decision,
        executed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tradingMode: getTradingMode()
      };
    }
  }

  /**
   * Full portfolio analysis and rebalancing
   */
  async analyzePortfolio(): Promise<DecisionResult[]> {
    const results: DecisionResult[] = [];

    // Fetch balance to report
    const balance = await fetchAccountBalance();
    const timestamp = new Date().toISOString();

    if (balance) {
      const msg = `💼 Portfolio snapshot: ${Object.keys(balance).length} assets held`;
      results.push({
        timestamp,
        message: msg,
        tradingMode: getTradingMode()
      });
    }

    // Analyze each selected asset
    for (const symbol of this.config.selectedAssets) {
      if (this.tradingMode !== 'running') {
        break;
      }

      const result = await this.analyzeAndTrade(symbol);
      results.push(result);

      // Small delay between checks to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }

  /**
   * Get current trading mode
   */
  getMode(): TradingMode {
    return this.tradingMode;
  }

  /**
   * Set trading mode
   */
  setMode(mode: TradingMode): void {
    this.tradingMode = mode;
  }

  /**
   * Update configuration
   */
  updateConfig(partial: Partial<DecisionEngineConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Generate and persist an ERC-8004 checkpoint for trade audit trail
   * This logs the trade decision to checkpoints.jsonl for on-chain synchronization
   */
  private async logCheckpoint(
    decision: TradeDecision,
    marketData: MarketData,
    symbol: string
  ): Promise<void> {
    try {
      const checkpoint = {
        timestamp: new Date().toISOString(),
        agentId: process.env.AGENT_ID || 'NOT_CONFIGURED',
        action: decision.action,
        pair: symbol,
        amountUsd: decision.amount,
        priceUsd: marketData.price,
        confidence: Math.round(decision.confidence * 100),
        reasoning: decision.reasoning,
        intentHash: '0x' + Buffer.from(`${symbol}-${decision.action}-${Date.now()}`).toString('hex').slice(0, 64),
        signerAddress: 'LOCAL_DECISION_ENGINE',
        tradingMode: getTradingMode()
      };

      // Append checkpoint to checkpoints.jsonl for ERC-8004 transparency
      fs.appendFileSync(CHECKPOINTS_FILE, JSON.stringify(checkpoint) + '\n');
      console.log(`[DecisionEngine] ERC-8004 checkpoint logged: ${symbol} ${decision.action}`);
    } catch (error) {
      console.warn(`[DecisionEngine] Failed to log ERC-8004 checkpoint:`, error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Helper to format decision results for streaming to frontend
 */
export function formatDecisionForStream(result: DecisionResult): string {
  return `data: ${JSON.stringify({
    timestamp: result.timestamp,
    message: result.message,
    decision: result.decision,
    executed: result.executed,
    tradingMode: result.tradingMode
  })}\n\n`;
}
