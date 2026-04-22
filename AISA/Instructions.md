# 1. Env-Testing Routine Execution:
bash scripts/check-env.sh
```
== cwd ==
/d/Cristi_s_ground/Hackhatons/FinanceAgent - Hackhaton/Hackathon-Trading-Agents-/AISA/nanopayment-x402

== binaries ==
ok: found node
ok: found npm
ok: found curl

== env ==
missing: OWS_MNEMONIC or X402_MNEMONIC

== network ==
API base: https://api.aisa.one
RPC url:  https://rpc.testnet.arc.network
api health status: 200
rpc chain probe: {"jsonrpc":"2.0","id":1,"result":"0x4cef52"}

== deps ==
ok: @x402/fetch installed
ok: @x402/evm installed
ok: viem installed
```

# 2. Wallet
## 2.1 Finding whether the wallet address exists
If mnemonic found (check in order: OWS_MNEMONIC env, X402_MNEMONIC env, local .env): proceed to step 3.

If no mnemonic found, tell the user that he needs a wallet and under his approval generate a wallet directly using viem (no interactive terminal needed) and save it to .env in one step:
```
node --input-type=module -e "
import { generateMnemonic, english, mnemonicToAccount } from 'viem/accounts';
import fs from 'fs';
import path from 'path';
const mnemonic = generateMnemonic(english);
const account = mnemonicToAccount(mnemonic);
const envPath = path.resolve('.env');
fs.writeFileSync(envPath, 'OWS_MNEMONIC=' + mnemonic + '\n');
console.log('MNEMONIC_SAVED=true');
console.log('ADDRESS=' + account.address);
```

Then display the wallet address prominently and open the faucet with the address pre-filled.
Show the wallet address — display it in a formatted code block so the user can easily copy it:

```
Your new wallet address (click to copy):

`0x<WALLET_ADDRESS>`

Fund this wallet with testnet USDC to get started.
Opening the Circle Faucet now...
```

Open the faucet and pre-fill the address — use Claude in Chrome to navigate to the faucet and fill the wallet address field:
```
tabs_context_mcp (createIfEmpty: true)   → get/create tab group
tabs_create_mcp                          → create a new tab
navigate (url: "https://faucet.circle.com", tabId: <new_tab>)
```

Tell the user to complete the remaining steps in the browser tab:

Select Arc Testnet as the network
Complete the reCAPTCHA
Click Send 20 USDC

Then, after receiving the user confirmation that the setup is finally complete check the newly created wallet by running the command in 2.2.

"
## 2.2 Retriving the wallet address or checking the balance
node scripts/setup.mjs balance