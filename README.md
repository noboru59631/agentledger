# AgentLedger

> Give AI a budget for the job, not a wallet full of money.

[![CI](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml/badge.svg)](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml)

AgentLedger is a task-bound financial accountability prototype for autonomous agents. It links a human objective to delegated mandates, payment requests, and outcome evidence. Its protocol layer, MandateGraph, answers: **why was this payment authorized, under whose authority, for which task, and what evidence is linked to it?**

## Product value

AgentLedger ties delegated spending to a specific task. A human sets a budget and scope, agents can delegate narrower authority, and each payment request is linked to its task, mandate, resource, and outcome hash. Revoking a parent authority blocks its descendants. The aim is to make an agent's spending explainable and bounded by the work it was asked to do.

The MVP focuses on task-bound mandates, multi-hop delegation, monotonic attenuation, cascading revocation, request binding, economic lineage, and outcome receipts.

## Current status

This repository contains a local browser simulation and an experimental Solidity contract. **Arc testnet lifecycle: completed. Arc Mainnet: NOT DEPLOYED.** The testnet recipient was the sender itself, so this was a self-transfer rehearsal; it is not independent vendor-payment or service-delivery evidence. See [`docs/TESTNET_EVIDENCE.json`](docs/TESTNET_EVIDENCE.json) for testnet transaction hashes and parameters. The browser demo uses fixture data, and the Solidity contract is unaudited.

The Solidity suite currently contains 36 deterministic test functions and 4 stateful invariant properties. Check the latest CI run for the result on the current source revision.

## Local run

Requirements: Node.js 20+.

```powershell
npm start
# Open http://localhost:4173
npm test
```

Solidity tests use Foundry:

```powershell
forge test -vv
```

The repository intentionally does not download or install toolchains automatically. Check the Solidity test status in the handoff report before treating the contract as verified. The suite includes deterministic accounting cases and stateful budget invariants.

To run the complete lifecycle on local Anvil, start Anvil separately and select an unlocked local account or an encrypted Foundry keystore account:

```powershell
$env:LIFECYCLE_SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
$env:LIFECYCLE_RPC_URL = 'http://127.0.0.1:8545'
npm run lifecycle
```

Or set `LIFECYCLE_ACCOUNT` to a Foundry keystore account name and enter its passphrase when prompted. Local mode accepts only the localhost Anvil RPC and adds actual broadcast transaction hashes to `lifecycle-evidence.json`.

The local Anvil runner remains separate from the Arc testnet lifecycle. Arc's native USDC calls a system precompile that Forge's local EVM cannot emulate, so Forge script execution fails before it can broadcast; `--skip-simulation` does not avoid local script execution. The dedicated testnet runner uses `forge create` only for deployment, then `cast send` with an encrypted Foundry keystore account for state changes. It pins the RPC to `https://rpc.testnet.arc.io`, checks chain ID `5042002`, USDC code, and sender balance before deployment, and verifies each successful receipt. It transfers exactly `0.01 USDC` (10,000 six-decimal base units); task and delegation budgets are 1 USDC and 0.5 USDC. A revoked retry is checked with read-only `eth_call`. Run it explicitly from WSL with `LIFECYCLE_ACCOUNT` and `LIFECYCLE_SENDER` set; Foundry prompts for the keystore password. It creates `docs/TESTNET_EVIDENCE.json` and does not contact mainnet.

```bash
LIFECYCLE_ACCOUNT=arc-testnet-deployer \
LIFECYCLE_SENDER=0x03607de69C487BcC460eaD7C4Bdfd25805658b75 \
npm run lifecycle:arc-testnet
```


If a testnet transaction is dropped after deployment, resume from the existing `docs/TESTNET_EVIDENCE.json` instead of deploying another contract:

```bash
LIFECYCLE_ACCOUNT=arc-testnet-deployer \
LIFECYCLE_SENDER=0x03607de69C487BcC460eaD7C4Bdfd25805658b75 \
npm run lifecycle:arc-testnet:resume
```

Resume mode validates the existing contract, reconciles completed lifecycle steps against onchain state, and continues from the first missing step. It never deploys a new contract. Transaction confirmation polls both receipts and transaction presence for up to about three minutes; a sustained disappearance is recorded as dropped and stops the run without an automatic rebroadcast loop.

## Demo scenario

The fixture depicts a $5 research task. Research Agent delegates up to $1 to Translation Agent; a $0.20 request is checked against the hierarchy, then the human revokes root authority and a retry is blocked. All displayed amounts, service status, and receipts are illustrative local state.

## Implemented contract behavior

- Task-rooted mandates with a deadline and service bitmap.
- Delegation with budget reservation, non-widening expiry and service scope, fixed recipient restriction, and bounded depth.
- Payment requests whose ID is checked onchain against task, mandate, recipient, amount, service class, resource hash, expiry, and nonce.
- One-use payment IDs, ancestor revocation/expiry validation, ancestor budget accounting, USDC `transferFrom`, and emitted outcome hash.
- Reentrancy guard around token transfer.

These are code properties, not an independent audit or proof that a deployed system is safe. The contract does not verify the truth or quality of offchain service/outcome data.

## Mainnet Deployment

**STATUS: NOT DEPLOYED.** AgentLedger has no Arc Mainnet contract or mainnet transaction evidence. `docs/MAINNET_EVIDENCE.json` is created only after an actual successful mainnet deployment; testnet evidence remains in `docs/TESTNET_EVIDENCE.json`.

Official Arc parameters: chain ID `5042`; primary RPC `https://rpc.mainnet.arc.io`; explorer `https://explorer.arc.io`; native gas is USDC with 18-decimal accounting; the ERC-20 interface is Circle USDC at `0x3600000000000000000000000000000000000000` with 6 decimals. Official Arc docs also list Alchemy, Blockdaemon, dRPC, and QuickNode endpoints; this runner intentionally accepts only the official primary RPC. The ERC-20 and native interfaces refer to the same underlying USDC balance.

The read-only preflight checks the encrypted Foundry keystore signer against the configured sender, the pinned chain and RPC, USDC bytecode and metadata, both displayed balance interfaces, and a live deployment gas estimate. It reserves 1,000,000 gas for lifecycle calls and adds a 50% gas margin. Gas price is the greater of the live `eth_gasPrice` quote and 20 Gwei. The preflight reports a live total; for planning, a 2,000,000-gas deployment at 20 Gwei implies about `0.09 USDC` buffered gas plus `0.01 USDC` for the payment, or `0.10 USDC` total. This is a planning estimate, not a fee quote; use the preflight output immediately before funding.

Use a second wallet address controlled by you (or a consenting demo participant) as `ARC_MAINNET_RECIPIENT`. The minimal demo payment is `0.01 USDC` (10,000 ERC-20 base units). A separate recipient demonstrates a real token movement, but does not establish a vendor relationship or prove service delivery. No vendor/service evidence is generated.

From WSL, pull the merged code and run **preflight only**:

```bash
cd /mnt/c/Users/jhjop/Documents/Codex/2026-09-22/referenced-chatgpt-conversation-this-is-an/work/agentledger
git switch main
git pull --ff-only origin main
npm ci
forge build
export ARC_MAINNET_ACCOUNT='agentledger-mainnet'
export ARC_MAINNET_SENDER='0xYourKeystoreAddress'
export ARC_MAINNET_RECIPIENT='0xYourSeparateDemoWallet'
npm run lifecycle:arc-mainnet:preflight
```

The preflight command never broadcasts. Mainnet execution is a separate command and is blocked unless `CONFIRM_ARC_MAINNET=YES` is explicitly set. The execution path rejects raw private-key environment variables, requires an encrypted Foundry keystore account, refuses a self-transfer recipient, verifies all network and token details before its first transaction, and writes distinct evidence. Do not set the confirmation variable for preflight.

Before any real broadcast, require: successful preflight from the execution host; reviewed deployment bytecode and a passing full Foundry suite; the signer address matching its encrypted keystore; the exact current fee estimate funded in native USDC; at least the `0.01 USDC` ERC-20 payment amount (same underlying asset); a recipient under separate control; and explicit owner approval for the deployment and lifecycle transactions. Mainnet deployment and the lifecycle should also receive an independent security review. No such transaction has been sent in preparing this path.

## Differentiation

Circle Agent Wallets, Coinbase Agentic Wallets, Crossmint, Safe spending controls, and x402Shield address wallet access, policy enforcement, or payment authorization in different ways. AgentLedger's intended focus is the link between task intent, multi-agent delegation, expense attribution, and outcome evidence. This is a product focus, not a claim that those systems cannot support adjacent workflows; compare their current documentation and integrations directly.

## Limitations

- No Arc mainnet deployment, live app, real wallet connection, or real service execution. The completed Arc testnet transfer was a self-transfer and does not establish an independent vendor payment.
- Browser state is deterministic fixture data; no backend, indexer, durable database, or cryptographically verified UI receipt.
- Outcome hashes are supplied by the caller. The contract only emits and stores the request/outcome hashes; it does not attest service delivery.
- No audited security review, property-based/fuzz testing, formal verification, signer abstraction, identity, refund handling, or vendor dispute flow.
- The direct agent `transferFrom` model needs the agent to hold and approve USDC; it is not a production wallet architecture.
- Arc gas documentation lists some fee limits specifically as testnet values; the preflight therefore uses a live mainnet RPC gas quote and a conservative gas margin.

## Before public submission

- Run `npm run lifecycle:arc-mainnet:preflight` from a network-enabled WSL environment and review its compiled deployment estimate.
- Run the complete Solidity suite and expand it to all security invariants listed in `SECURITY.md`.
- Fix all test findings and obtain independent contract review.
- Deploy and verify the reviewed contract on Arc mainnet with explicit owner approval; publish the verified address and explorer-backed transaction evidence.
- Replace fixture UI with a working read/write flow that labels each state accurately; host it at a public URL.
- Publish the source repository and a public builder profile; add live app, repo, contract, and 60–90 sec demo links to `SUBMISSION.md`.
- Confirm the project remains within program eligibility and submit through the Arc House event page.

## Primary references

- [Arc documentation index](https://docs.arc.io/llms.txt)
- [Arc: Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc: Contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Arc: Gas and fees](https://docs.arc.io/arc/references/gas-and-fees)
- [Circle: USDC contract addresses](https://developers.circle.com/stablecoins/usdc-contract-addresses)
- [Circle Arc mainnet announcement](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet)
- [Arc Microgrants requirements](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
- [Arcscan public RPC details (third party)](https://docs.arc-scan.org/docs/rpc)
- [Arcscan API and network IDs (third party)](https://docs.arc-scan.org/docs/api)
