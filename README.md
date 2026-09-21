# AgentLedger

> Give AI a budget for the job, not a wallet full of money.

[![CI](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml/badge.svg)](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml)

AgentLedger is a task-bound financial accountability prototype for autonomous agents. It links a human objective to delegated mandates, payment requests, and outcome evidence. Its protocol layer, MandateGraph, answers: **why was this payment authorized, under whose authority, for which task, and what evidence is linked to it?**

## Product value

AgentLedger ties delegated spending to a specific task. A human sets a budget and scope, agents can delegate narrower authority, and each payment request is linked to its task, mandate, resource, and outcome hash. Revoking a parent authority blocks its descendants. The aim is to make an agent's spending explainable and bounded by the work it was asked to do.

The MVP focuses on task-bound mandates, multi-hop delegation, monotonic attenuation, cascading revocation, request binding, economic lineage, and outcome receipts.

## Current status

This repository contains a local browser simulation and an experimental Solidity contract. **Arc testnet lifecycle: completed. Arc Mainnet deployment and lifecycle rehearsal: completed successfully.** The mainnet run used a separately controlled demo wallet and is not evidence of an independent vendor relationship or service delivery. See [`docs/MAINNET_EVIDENCE.json`](docs/MAINNET_EVIDENCE.json) for mainnet transaction hashes and parameters, and [`docs/TESTNET_EVIDENCE.json`](docs/TESTNET_EVIDENCE.json) for testnet evidence. The browser demo uses fixture data, and the Solidity contract is unaudited.

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

## Arc Mainnet Evidence

**Status: deployed; lifecycle rehearsal completed successfully.** Contract: [`0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da`](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da) on Arc Mainnet (chain ID `5042`), using USDC at `0x3600000000000000000000000000000000000000`.

- Deployment: [transaction](https://explorer.arc.io/tx/0x7f1287234e0b9049b45aa5ea67857c358ac95fda7b2e1e9ac2516070157d80b8)
- Task creation: [transaction](https://explorer.arc.io/tx/0x17602976ae236cd73f0c2fb9e0d34e82e8f841a82f7d8c1ff2b33abad9ccb731)
- Delegation: [transaction](https://explorer.arc.io/tx/0xe8bb539e56eaa8e94321326870f89d5acc8f2c616cd746ab40566373f8b1eb8b)
- Payment approval: [transaction](https://explorer.arc.io/tx/0x099e17ef1c9ed66450ebb9390bf3653925d3cdf71bbe7c8dc3b2a7800b4f7be3)
- Payment execution: [transaction](https://explorer.arc.io/tx/0xba0064e2a6cb13daeffafe90e79fc53c94d25ea7ae0a205e58bbee53c46eec6e)
- Task revocation: [transaction](https://explorer.arc.io/tx/0x7a694807ac98d25f6e4145fd2fc7f715838269544155309ac69602b66c8f65ba)
- Retry after revocation: `retryBlocked: true`, checked through a read-only call.

The preflight immediately before execution reported adequate native gas/total funding and ERC-20 payment balance, with `transactionsSent: false` at that preflight stage. The lifecycle sent the transactions listed above. The recipient was a separately controlled demo wallet. This evidence demonstrates deployment, task-bound payment execution, delegation, revocation, and blocked retry behavior; it does not demonstrate an independent vendor relationship, service delivery, or service proof. No `outcomeHash` claim is made. Full evidence: [`docs/MAINNET_EVIDENCE.json`](docs/MAINNET_EVIDENCE.json).

Arc Mainnet uses chain ID `5042`, primary RPC `https://rpc.mainnet.arc.io`, and explorer `https://explorer.arc.io`. The browser demo remains fixture-based, and the Solidity contract is unaudited.

## Differentiation

Circle Agent Wallets, Coinbase Agentic Wallets, Crossmint, Safe spending controls, and x402Shield address wallet access, policy enforcement, or payment authorization in different ways. AgentLedger's intended focus is the link between task intent, multi-agent delegation, expense attribution, and outcome evidence. This is a product focus, not a claim that those systems cannot support adjacent workflows; compare their current documentation and integrations directly.

## Limitations

- No production live app, real wallet connection, independent vendor relationship, or verified service delivery. The Arc Mainnet rehearsal paid a separately controlled demo wallet; the Arc testnet transfer was a self-transfer.
- Browser state is deterministic fixture data; no backend, indexer, durable database, or cryptographically verified UI receipt.
- Outcome hashes are supplied by the caller. The contract only emits and stores the request/outcome hashes; it does not attest service delivery.
- No audited security review, property-based/fuzz testing, formal verification, signer abstraction, identity, refund handling, or vendor dispute flow.
- The direct agent `transferFrom` model needs the agent to hold and approve USDC; it is not a production wallet architecture.
- Arc gas documentation lists some fee limits specifically as testnet values; the preflight therefore uses a live mainnet RPC gas quote and a conservative gas margin.

## Before public submission

- Run the complete Solidity suite and expand it to all security invariants listed in `SECURITY.md`.
- Fix all test findings and obtain independent contract review.
- Obtain an independent security review and verify the deployed contract source if submission requirements call for it.
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
