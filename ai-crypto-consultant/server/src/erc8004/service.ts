import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { getAgentRegistration } from '../agent/identity';
import type { AgentRegistration } from '../types/index';

const CHECKPOINTS_FILE = path.join(process.cwd(), 'checkpoints.jsonl');

export interface Erc8004Contracts {
  agentRegistry: string | null;
  hackathonVault: string | null;
  riskRouter: string | null;
  reputationRegistry: string | null;
  validationRegistry: string | null;
}

export interface Erc8004AgentInfo {
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

export interface Erc8004Status {
  contracts: Erc8004Contracts;
  agentId: string | null;
  onchainProvider: boolean;
  agentIdentity: Erc8004AgentInfo;
  errors: string[];
}

export interface Erc8004CheckpointSummary {
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

export function getErc8004Contracts(): Erc8004Contracts {
  return {
    agentRegistry: process.env.AGENT_REGISTRY_ADDRESS ?? null,
    hackathonVault: process.env.HACKATHON_VAULT_ADDRESS ?? null,
    riskRouter: process.env.RISK_ROUTER_ADDRESS ?? null,
    reputationRegistry: process.env.REPUTATION_REGISTRY_ADDRESS ?? null,
    validationRegistry: process.env.VALIDATION_REGISTRY_ADDRESS ?? null,
  };
}

export function getErc8004Provider(): ethers.JsonRpcProvider | null {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) return null;
  return new ethers.JsonRpcProvider(rpcUrl);
}

export async function getErc8004AgentIdentity(): Promise<Erc8004AgentInfo> {
  const agentId = process.env.AGENT_ID ?? null;
  if (!agentId) {
    return {
      agentId: null,
      operatorWallet: null,
      agentWallet: null,
      name: null,
      description: null,
      capabilities: [],
      registeredAt: null,
      active: null,
      error: 'AGENT_ID is not configured in the environment.'
    };
  }

  const contracts = getErc8004Contracts();
  if (!contracts.agentRegistry) {
    return {
      agentId,
      operatorWallet: null,
      agentWallet: null,
      name: null,
      description: null,
      capabilities: [],
      registeredAt: null,
      active: null,
      error: 'AGENT_REGISTRY_ADDRESS is not configured in the environment.'
    };
  }

  const provider = getErc8004Provider();
  if (!provider) {
    return {
      agentId,
      operatorWallet: null,
      agentWallet: null,
      name: null,
      description: null,
      capabilities: [],
      registeredAt: null,
      active: null,
      error: 'SEPOLIA_RPC_URL is not configured. On-chain status is unavailable.'
    };
  }

  try {
    const registration = await getAgentRegistration(provider, contracts.agentRegistry, BigInt(agentId));
    return {
      agentId,
      operatorWallet: registration.operatorWallet,
      agentWallet: registration.agentWallet,
      name: registration.name,
      description: registration.description,
      capabilities: registration.capabilities,
      registeredAt: registration.registeredAt,
      active: registration.active,
    };
  } catch (error: unknown) {
    return {
      agentId,
      operatorWallet: null,
      agentWallet: null,
      name: null,
      description: null,
      capabilities: [],
      registeredAt: null,
      active: null,
      error: error instanceof Error ? error.message : 'Failed to retrieve registration data.'
    };
  }
}

export async function getErc8004Status(): Promise<Erc8004Status> {
  const contracts = getErc8004Contracts();
  const provider = getErc8004Provider();
  const agentIdentity = await getErc8004AgentIdentity();

  const errors: string[] = [];
  if (!contracts.agentRegistry) errors.push('Missing AGENT_REGISTRY_ADDRESS');
  if (!process.env.AGENT_ID) errors.push('Missing AGENT_ID');
  if (!process.env.SEPOLIA_RPC_URL) errors.push('Missing SEPOLIA_RPC_URL');

  return {
    contracts,
    agentId: process.env.AGENT_ID ?? null,
    onchainProvider: Boolean(provider),
    agentIdentity,
    errors,
  };
}

export function getErc8004Checkpoints(): Erc8004CheckpointSummary[] {
  if (!fs.existsSync(CHECKPOINTS_FILE)) {
    return [];
  }

  const raw = fs.readFileSync(CHECKPOINTS_FILE, 'utf8').trim();
  if (!raw) return [];

  const entries = raw
    .split('\n')
    .filter(Boolean)
    .reverse()
    .slice(0, 20)
    .map((line): Erc8004CheckpointSummary | null => {
      try {
        const parsed = JSON.parse(line) as any;
        return {
          timestamp: new Date(parsed.timestamp ?? Date.now()).toISOString(),
          action: parsed.action ?? parsed.decision?.action ?? 'UNKNOWN',
          pair: parsed.pair ?? parsed.decision?.pair ?? 'UNKNOWN',
          amountUsd: Number(parsed.amountUsd ?? parsed.decision?.amount ?? 0),
          priceUsd: Number(parsed.priceUsd ?? parsed.price ?? 0),
          confidence: Number(parsed.confidence ?? parsed.decision?.confidence ?? 0),
          intentHash: parsed.intentHash ?? parsed.decision?.intentHash ?? 'N/A',
          signerAddress: parsed.signerAddress ?? 'N/A',
          checkpointHash: parsed.checkpointHash ?? undefined,
        };
      } catch {
        return null;
      }
    });

  return entries.filter((entry): entry is Erc8004CheckpointSummary => entry !== null);
}
