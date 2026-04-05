/**
 * Kraken Trading Service
 *
 * Singleton wrapper around the KrakenClient that provides:
 * - Client initialization and lifecycle management
 * - Paper trading mode detection
 * - Error handling and fallback strategies
 * - Service-level logging
 *
 * The underlying KrakenClient wraps the Kraken CLI binary for all exchange operations.
 */

import { KrakenClient } from '../exchange/kraken';
import { MarketData, KrakenOrder, KrakenOrderResult } from '../types/index';

let clientInstance: KrakenClient | null = null;

/**
 * Initialize and return the singleton KrakenClient
 */
export function initializeKrakenClient(): KrakenClient {
  if (clientInstance) {
    return clientInstance;
  }

  const sandbox = process.env.KRAKEN_SANDBOX === 'true';
  const hasCredentials = !!(process.env.KRAKEN_API_KEY && process.env.KRAKEN_API_SECRET);

  console.log(`[KrakenService] Initializing Kraken client...`);
  console.log(`[KrakenService] Mode: ${sandbox ? 'PAPER TRADING (sandbox)' : 'LIVE TRADING'}`);
  console.log(`[KrakenService] Credentials: ${hasCredentials ? 'configured' : 'NOT SET - public commands only'}`);

  clientInstance = new KrakenClient();
  return clientInstance;
}

/**
 * Get the current KrakenClient instance (lazy initialization)
 */
export function getKrakenClient(): KrakenClient {
  if (!clientInstance) {
    return initializeKrakenClient();
  }
  return clientInstance;
}

/**
 * Check if running in paper trading mode
 */
export function isPaperTradingMode(): boolean {
  return process.env.KRAKEN_SANDBOX === 'true';
}

/**
 * Get trading mode for API responses
 */
export function getTradingMode(): 'paper' | 'live' {
  return isPaperTradingMode() ? 'paper' : 'live';
}

/**
 * Wrapper for getTicker with error handling
 */
export async function fetchMarketData(pair: string): Promise<MarketData | null> {
  try {
    const client = getKrakenClient();
    return await client.getTicker(pair);
  } catch (error) {
    console.error(`[KrakenService] Error fetching ticker for ${pair}:`, error);
    return null;
  }
}

/**
 * Wrapper for getBalance with error handling
 */
export async function fetchAccountBalance(): Promise<Record<string, string> | null> {
  try {
    const client = getKrakenClient();
    const balance = await client.getBalance();
    console.log(`[KrakenService] Account balance fetched, assets: ${Object.keys(balance).length}`);
    return balance;
  } catch (error) {
    console.error('[KrakenService] Error fetching account balance:', error);
    return null;
  }
}

/**
 * Wrapper for placeOrder with error handling and logging
 */
export async function executeOrder(order: KrakenOrder): Promise<KrakenOrderResult | null> {
  try {
    const client = getKrakenClient();
    const mode = getTradingMode();
    console.log(
      `[KrakenService] ${mode === 'paper' ? '📄' : '💰'} Executing ${mode} order: ${order.type} ${order.volume} ${order.pair}`
    );

    const result = await client.placeOrder(order);

    console.log(`[KrakenService] Order executed successfully:`, result.txid);
    return result;
  } catch (error) {
    console.error('[KrakenService] Error executing order:', error);
    if (process.env.KRAKEN_SANDBOX === 'true') {
      console.error('[KrakenService] Paper trading sandbox active. Run `kraken paper init` before placing orders.');
    }
    return null;
  }
}

/**
 * Wrapper for getOpenOrders with error handling
 */
export async function fetchOpenOrders(): Promise<Record<string, unknown> | null> {
  try {
    const client = getKrakenClient();
    const orders = await client.getOpenOrders();
    const count = Object.keys(orders).length;
    console.log(`[KrakenService] Open orders: ${count}`);
    return orders;
  } catch (error) {
    console.error('[KrakenService] Error fetching open orders:', error);
    return null;
  }
}

/**
 * Return connection status for health checks
 */
export async function checkConnectionStatus(): Promise<{
  connected: boolean;
  mode: 'paper' | 'live';
  message: string;
}> {
  try {
    const client = getKrakenClient();
    const mode = getTradingMode();

    // Try to fetch a simple public ticker to verify connection
    const balance = await fetchAccountBalance();

    return {
      connected: balance !== null,
      mode,
      message: balance
        ? `Connected to Kraken ${mode} trading`
        : 'API credentials may be invalid or network unreachable',
    };
  } catch (error) {
    return {
      connected: false,
      mode: getTradingMode(),
      message: `Connection error: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

/**
 * Convert USD amount to base asset volume
 * Given a price and USD amount, calculate the base asset volume to trade
 */
export function calculateOrderVolume(usdAmount: number, pricePerUnit: number): string {
  if (pricePerUnit <= 0) {
    throw new Error('Price must be positive');
  }
  const volume = usdAmount / pricePerUnit;
  return volume.toFixed(8); // 8 decimals for crypto
}
