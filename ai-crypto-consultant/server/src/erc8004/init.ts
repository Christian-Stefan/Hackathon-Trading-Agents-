import { ethers } from 'ethers';
import { getAgentId, verifyRegistration } from '../agent/identity';

const AGENT_NAME = 'HackathonTradingAgent';
const AGENT_DESCRIPTION = 'Autonomous AI trading agent with ERC-8004 identity and Kraken CLI execution';
const AGENT_CAPABILITIES = ['trading', 'analysis', 'explainability', 'eip712-signing'];

export async function initializeErc8004Startup(): Promise<void> {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const registryAddress = process.env.AGENT_REGISTRY_ADDRESS;

  if (!rpcUrl || !privateKey || !registryAddress) {
    console.log('[ERC8004] Skipping startup initialization because SEPOLIA_RPC_URL, PRIVATE_KEY, or AGENT_REGISTRY_ADDRESS is not configured.');
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const operatorSigner = new ethers.Wallet(privateKey, provider);
    const agentWalletKey = process.env.AGENT_WALLET_PRIVATE_KEY || privateKey;
    const agentWallet = new ethers.Wallet(agentWalletKey, provider);

    console.log('[ERC8004] Initializing on-chain agent identity...');
    const agentId = await getAgentId(operatorSigner, registryAddress, {
      name: AGENT_NAME,
      description: AGENT_DESCRIPTION,
      capabilities: AGENT_CAPABILITIES,
      agentWallet: agentWallet.address,
      agentURI: `data:application/json,${encodeURIComponent(JSON.stringify({
        name: AGENT_NAME,
        description: AGENT_DESCRIPTION,
        capabilities: AGENT_CAPABILITIES,
        agentWallet: agentWallet.address,
        version: '1.0.0'
      }))}`
    });

    const registered = await verifyRegistration(provider, registryAddress, agentId);
    const status = registered ? 'VERIFIED' : 'UNREGISTERED';
    console.log(`[ERC8004] Agent identity initialized: agentId=${agentId} status=${status}`);
    if (!registered) {
      console.warn('[ERC8004] Agent identity was created, but registration could not be verified.');
    }
  } catch (error: unknown) {
    console.error('[ERC8004] Failed to initialize on-chain identity:', error instanceof Error ? error.message : error);
  }
}
