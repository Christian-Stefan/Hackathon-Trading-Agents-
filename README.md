# Autonomous Music Agent (MCP + Arc x402) Handover Guide

Here is the expanded, ultimate handover document. I have woven in all the conceptual explanations we discussed (like the User vs. Author wallets and how the cryptography works) so you aren't just running code, but actually understand the architecture you are taking over.

## 📌 Overview
This project is an autonomous AI agent powered by Google Gemini. It uses the **Model Context Protocol (MCP)** to search a local custom music database, retrieve a song and the artist's public wallet address, and then automatically trigger an on-chain micro-payment (nanopayment) using **Circle's Arc Testnet** and the **x402 protocol**.

### The Architecture: User vs. Author
Before running the code, it is critical to understand the flow of funds. This system relies on two separate wallets:
1. **The User's Wallet (The Payer):** This is the wallet managed by the Agent via the `.env` file. It holds the private key (Mnemonic) to authorize payments. The user escrows testnet USDC into the Circle Gateway so the Agent can make fast, cheap nanopayments on their behalf.
2. **The Author's Wallet (The Payee):** This is the destination wallet attached to the song in the database. The system **only** needs the public address (`0x...`) for this wallet—think of it as the slot on a mailbox. The Agent drops the funds in, but cannot take them out.

### Directory Structure
* `music-mcp-server/`: Contains the custom local database (`server.js`) and the Gemini AI orchestration logic (`agent.js`).
* `nanopayment-x402/`: Contains the AIsa/Circle payment infrastructure, RPC connections, and setup scripts.

---

## 🛠️ Prerequisites
Before starting, ensure you have:
1. **Node.js** (v18+) installed.
2. A free **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/)).
3. A Web3 wallet (like MetaMask) to view your testnet funds (optional but recommended).

---

## 🚀 Setup Instructions

### 1. Install Dependencies
You need to install the Node packages in both directories.
```bash
# Install payment dependencies
cd AISA/nanopayment-x402
npm install

# Install Agent/MCP dependencies
cd ../music-mcp-server
npm install

### 2. Configure Environment Variables

Because `.env` files are correctly ignored by Git, you need to create your own local `.env` file inside the `music-mcp-server` directory.

Create a file named `.env` in `AISA/music-mcp-server/` and add the following:

```plaintext
# 1. Your Gemini API Key
GEMINI_API_KEY="your_gemini_api_key_here"

# 2. Your Testnet Wallet Mnemonic
# If you don't have one, run this command in your terminal to generate one:
# node --input-type=module -e "import { generateMnemonic, english } from 'viem/accounts'; console.log(generateMnemonic(english));"
OWS_MNEMONIC="your twelve word seed phrase goes right here..."


### 3. Fund Your Wallet (Arc Testnet)

Your agent needs testnet USDC to pay the artists.

1. Run `node agent.js` (it might fail if unfunded, but it will print your generated public address).
2. Go to the [Circle Faucet](https://faucet.circle.com/).
3. Paste your public address, select **Arc Testnet**, and request 20 USDC.

### 4. Load the Escrow Gateway

Once your wallet has USDC, you must deposit some into the Circle Gateway escrow so the Agent can execute fast nanopayments.
Navigate to the `nanopayment-x402` folder and run:

```bash
node scripts/setup.mjs all
```

---

### 🎮 How to Run the Agent

Once everything is installed and funded, navigate to the `music-mcp-server` folder and run:

```bash
node agent.js
```

**What happens:** 1. The script boots up the local database server.
2. Gemini reads the prompt: *"Find me an electronic song."*
3. Gemini decides to use the `search_songs` MCP tool.
4. The database returns the song data and the artist's wallet address.
5. `viem` automatically signs a transaction and sends 0.05 USDC to the artist on the Arc Testnet!

---

### 🚧 What's Left to Do (Next Steps for the Handover)

1. **Create a proper database:** The `server.js` currently uses a hardcoded JSON array. We need to connect this to a real database (like PostgreSQL or MongoDB) for scalable and dynamic song fetching.
2. **Find a hosting service:** We need to find a hosting provider (like Heroku, Vercel, AWS, or DigitalOcean) that we can use to deploy our application so it is accessible over the web.
3. **Create a user interface:** The agent currently runs purely in the terminal. The next step is building a simple web UI where a user can type their prompt visually, and the backend Node server executes the `agent.js` logic and streams the audio back to the browser.