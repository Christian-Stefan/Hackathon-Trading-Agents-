import { GoogleGenAI, Type } from '@google/genai';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import dotenv from 'dotenv';

dotenv.config();

// Define the Arc Testnet for viem
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runAgent() {
  console.log("🤖 Agent waking up...");

  // 1. Connect to MCP Server
  const transport = new StdioClientTransport({ command: "node", args: ["server.js"] });
  const mcpClient = new Client({ name: "hackathon-agent", version: "1.0.0" }, { capabilities: {} });
  await mcpClient.connect(transport);
  console.log("✅ Connected to Music Database MCP Server");

  const mcpTools = await mcpClient.listTools();
  const geminiTools = [{
    functionDeclarations: mcpTools.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: { type: Type.OBJECT, properties: tool.inputSchema.properties, required: tool.inputSchema.required }
    }))
  }];

  // 2. Prompt Gemini
  const userPrompt = "Find me an electronic song from the database.";
  console.log(`\n👤 User: "${userPrompt}"`);
  console.log("🧠 Gemini is thinking...");

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userPrompt,
    config: { tools: geminiTools }
  });

  // 3. Handle Decision & Database Search
  if (response.functionCalls && response.functionCalls.length > 0) {
    const call = response.functionCalls[0];
    console.log(`🛠️  Gemini decided to call: ${call.name}(${JSON.stringify(call.args)})`);

    const result = await mcpClient.callTool({ name: call.name, arguments: call.args });
    const songData = JSON.parse(result.content[0].text)[0];
    
    if (!songData) {
      console.log("❌ No songs found.");
      process.exit(1);
    }

    console.log(`\n🎵 Discovered: "${songData.title}" by ${songData.artist}`);
    console.log(`🔗 Target Wallet: ${songData.walletAddress}`);

    // 4. THE REAL NANOPAYMENT EXECUTION
    const priceInUSDC = 0.05; 
    console.log(`\n💸 Initiating real on-chain nanopayment of ${priceInUSDC} USDC...`);

    try {
      // Setup wallet and network connections
      const account = mnemonicToAccount(process.env.OWS_MNEMONIC);
      const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
      const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

      // Fire the transaction to the Arc network
      const hash = await walletClient.sendTransaction({
        to: songData.walletAddress,
        value: parseEther(priceInUSDC.toString())
      });

      console.log(`⏳ Transaction broadcast! Waiting for block confirmation...`);
      
      // Wait for the blockchain to verify the block
      await publicClient.waitForTransactionReceipt({ hash });
      
      console.log(`✅ Payment settled successfully!`);
      console.log(`🔍 View Receipt: https://testnet.arcscan.app/tx/${hash}`);
      console.log(`\n🎧 Delivering audio to user: ${songData.audioUrl}`);

    } catch (error) {
      console.error(`\n❌ Payment failed:`, error.shortMessage || error.message);
    }

  } else {
    console.log(`💬 Gemini says: ${response.text}`);
  }
  
  process.exit(0);
}

runAgent().catch(console.error);