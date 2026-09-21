# Arc Testnet Evidence

## Network configuration

Verified against the current Arc documentation on September 21, 2026:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.io`
- Explorer: `https://explorer.testnet.arc.io`
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000` (6 decimals)
- Funding: [Circle Testnet Faucet](https://faucet.circle.com/), select Arc Testnet and USDC. The public faucet currently offers 20 USDC per address and network every two hours. Arc testnet USDC also pays transaction gas.

Arc's native gas balance uses 18-decimal precision. Its USDC ERC-20 interface represents the same underlying balance using 6 decimals; these are not separate funds.

Sources: [Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc), [Arc contract addresses](https://docs.arc.io/arc/references/contract-addresses), [Circle Testnet Faucet](https://faucet.circle.com/).

## Runtime evidence

- Read-only RPC preflight: **NOT RUN**. This environment could not reach GitHub/RPC endpoints directly during setup; rerun from a network-enabled environment.
- Testnet deploy and lifecycle: **NOT RUN**. No funded deployer or signing account was present in the environment.
- Contract address and transaction hashes: none. No transactions were sent.

The testnet preflight command is:

```powershell
$env:ARC_NETWORK = 'testnet'
node scripts/arc-readonly-preflight.mjs
```

To run the full lifecycle after obtaining a separate testnet wallet and funding it from Circle's faucet:

```powershell
$env:USDC_ADDRESS = '0x3600000000000000000000000000000000000000'
$env:ARC_RPC_URL = 'https://rpc.testnet.arc.io'
$env:DEPLOYER_ADDRESS = '0xYOUR_TESTNET_WALLET_ADDRESS'
$env:KEYSTORE_ACCOUNT = 'agentledger-testnet'
./scripts/deploy.ps1 -Network testnet
```

The deployment script only deploys the contract; it does not execute the full lifecycle. Use the testnet explorer and a wallet/Foundry signer to call `createTask`, `delegate`, `executePayment`, `revokeTask`, and then retry `executePayment`, verifying the revert. Record only mined transaction hashes and explorer links here. `executePayment` requires the delegated agent to hold and approve USDC, so the test wallet must provision that agent address or use the deployer as the root agent and test from the appropriate signer.

## Mainnet

Arc mainnet remains **NOT DEPLOYED**. No mainnet transaction or Microgrant submission was performed.
