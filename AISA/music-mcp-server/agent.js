import { GoogleGenAI, Type } from '@google/genai';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import express from 'express';
dotenv.config();

// Server parameters
const app = express(); 
const port = 2000; 
app.use(express.json());

// Define the Arc Testnet for viem
const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runAgent(userPrompt, ows_mnemonic) {
  const account = mnemonicToAccount(ows_mnemonic);
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });

  // 1. Prompt Gemini
  console.log(`\n👤 User: "${userPrompt}"`);
  console.log("🧠 Gemini is thinking...");

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: userPrompt,
    config: { tools: geminiTools }
  });

  // 2. Handle Decision & Database Search
  if (response.functionCalls && response.functionCalls.length > 0) {
    const call = response.functionCalls[0];
    console.log(`🛠️  Gemini decided to call: ${call.name}(${JSON.stringify(call.args)})`);

    const result = await mcpClient.callTool({ name: call.name, arguments: call.args });
    
    // Parse the ENTIRE array of tracks, removing the hardcoded [0]
    const tracks = JSON.parse(result.content[0].text);
    
    if (!tracks || tracks.length === 0) {
      console.log("❌ No songs found.");
      return 'none';
    }

    let playlistResult = [];

    // Loop through every song returned by the tool
    for (const songData of tracks) {
      console.log(`\n🎵 Discovered: "${songData.title}" by ${songData.artist}`);
      console.log(`🔗 Target Wallet: ${songData.walletAddress}`);

      // 3. THE REAL NANOPAYMENT EXECUTION
      const priceInUSDC = 0.05; 
      console.log(`💸 Initiating real on-chain nanopayment of ${priceInUSDC} USDC for ${songData.title}...`);

      const accountAddress = account.address;
      const balance = await publicClient.getBalance({ address: accountAddress });
      console.log(`🏦 Agent Wallet Balance: ${balance.toString()} wei`);

      try {
        const hash = await walletClient.sendTransaction({
          to: songData.walletAddress,
          value: parseEther(priceInUSDC.toString())
        });

        console.log(`⏳ Transaction broadcast! Waiting for block confirmation...`);
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`✅ Payment settled successfully! https://testnet.arcscan.app/tx/${hash}`);
        
        // Add the successfully paid song to our final list
        playlistResult.push(`🎵 ${songData.title} by ${songData.artist}`);

      } catch (error) {
        console.error(`❌ Payment failed for ${songData.title}:`, error.shortMessage || error.message);
        // We don't return 'none' here so it continues paying for the other songs even if one fails
      }
    }

    // Return the final list to the Express server (and your frontend)
    return playlistResult.join('\n'); 
    
  } else {
    console.log(`💬 Gemini says: ${response.text}`);
    return response.text;
  }
}

app.post('/createplaylist', async (req, res) => {
  const { genre, quantity, motivation, extras, mnemonic } = req.body; 
  const prompt = `Construct a ${motivation} playlist of ${quantity} songs, preferably of genre ${genre} and these extra preferences: ${extras}`;
  const playlist = await runAgent(prompt, mnemonic); 
  res.json({ final_playlist: playlist });
});

app.post('/verify', async (req, res) => {
  try {
    const { walletaddress, mnemonic } = req.body; 
    const hashedaddress = mnemonicToAccount(mnemonic); 

    res.json( { outcome: hashedaddress.address.toLowerCase() === walletaddress.toLowerCase()} );
  } catch {
    res.json( { outcome: false});
  }
});

// STARTUP 
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

console.log("🤖 Agent waking up...");
// Connect to MCP Server
const transport = new StdioClientTransport({ command: "node", args: ["server.js"], env:process.env});
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

// Setup wallet and network connections
const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
