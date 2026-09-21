# AgentLedger

> Give AI a budget for the job, not a wallet full of money.

[![CI](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml/badge.svg)](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml)

AgentLedger is a task-bound financial accountability prototype for autonomous agents. It links a human objective to delegated mandates, payment requests, and outcome evidence. Its protocol layer, MandateGraph, answers: **why was this payment authorized, under whose authority, for which task, and what evidence is linked to it?**

## Product value

AgentLedger ties delegated spending to a specific task. A human sets a budget and scope, agents can delegate narrower authority, and each payment request is linked to its task, mandate, resource, and outcome hash. Revoking a parent authority blocks its descendants. The aim is to make an agent's spending explainable and bounded by the work it was asked to do.

The MVP focuses on task-bound mandates, multi-hop delegation, monotonic attenuation, cascading revocation, request binding, economic lineage, and outcome receipts.

## Current status

This repository contains a local browser simulation and an experimental Solidity contract. **Arc testnet lifecycle: completed.** The deployed MandateGraph contract completed task creation, delegation, USDC approval, a task-bound payment, task revocation, and a read-only retry rejection check. The payment recipient was the sender itself, so this was a self-transfer rehearsal; it is not independent vendor-payment or service-delivery evidence. See [`docs/TESTNET_EVIDENCE.json`](docs/TESTNET_EVIDENCE.json) for transaction hashes and parameters. The browser demo uses fixture data, and the Solidity contract is unaudited.

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

## Arc configuration and evidence

Circle announced Arc public mainnet on September 16, 2026. The Arc documentation index currently remains internally inconsistent: it calls USDC native gas and links mainnet integration pages, but also contains a stale “testnet only” line. Circle's Arc skill lists mainnet chain ID `5042`, RPC `https://rpc.mainnet.arc.io`, explorer `https://explorer.arc.io`, and native USDC at `0x3600000000000000000000000000000000000000`. Official docs describe USDC gas as 18-decimal native units and the ERC-20 predeploy interface as 6-decimal USDC. These are official documentation facts, not successful runtime observations: this environment blocked direct JSON-RPC access, so chain ID, latest block, code, and metadata were not independently queried here. Re-run read-only preflight from a network-enabled environment before funding.

The read-only CI preflight checks chain ID, latest block, bytecode at the documented USDC address, and its `symbol` and `decimals`. Official documentation supports these constants, but RPC behavior remains an independently observed runtime fact and must be confirmed by the workflow run. The source docs have previously contained inconsistent status text; see the linked official references and confirm them again before deployment.

The deployment preflight has no default funding threshold. Set `MIN_USDC_BALANCE` to an explicit USDC amount to enable an optional balance gate. It is not a deployment cost estimate. No exact deployment cost is stated because no live estimate of the compiled deployment has been obtained. Deployment scripts require a user-managed Foundry keystore account or an interactive signer. No credentials belong in this repository.

```powershell
$env:KEYSTORE_ACCOUNT = 'agentledger-deployer'
$env:DEPLOYER_ADDRESS = '0x...'
$env:USDC_ADDRESS = '...'
$env:ARC_RPC_URL = '...'
./scripts/preflight.ps1 -Network mainnet
./scripts/deploy.ps1 -Network mainnet
```

`deploy.ps1` invokes `verify-deploy.ps1` after broadcast and confirms runtime code at the reported contract address. Explorer URLs are selected only for the documented Arc mainnet/testnet chain IDs. Mainnet deployment is an irreversible onchain action and remains an explicit user action. The signer must already be available through Foundry's encrypted keystore or an interactive hardware-wallet flow; do not set a raw private-key environment variable.

See [`docs/LIVE_EVIDENCE.md`](docs/LIVE_EVIDENCE.md) for the evidence template. Mainnet deployment remains a separately approved step after testnet rehearsal, review, and a live deployment fee estimate.

## Differentiation

Circle Agent Wallets, Coinbase Agentic Wallets, Crossmint, Safe spending controls, and x402Shield address wallet access, policy enforcement, or payment authorization in different ways. AgentLedger's intended focus is the link between task intent, multi-agent delegation, expense attribution, and outcome evidence. This is a product focus, not a claim that those systems cannot support adjacent workflows; compare their current documentation and integrations directly.

## Limitations

- No Arc mainnet deployment, live app, real wallet connection, or real service execution. The completed Arc testnet transfer was a self-transfer and does not establish an independent vendor payment.
- Browser state is deterministic fixture data; no backend, indexer, durable database, or cryptographically verified UI receipt.
- Outcome hashes are supplied by the caller. The contract only emits and stores the request/outcome hashes; it does not attest service delivery.
- No audited security review, property-based/fuzz testing, formal verification, signer abstraction, identity, refund handling, or vendor dispute flow.
- The direct agent `transferFrom` model needs the agent to hold and approve USDC; it is not a production wallet architecture.
- Arc's currently indexed official docs contain conflicting mainnet/testnet status text. Confirm RPC, token address, gas behavior, and explorer in current official docs before a real transaction.

## Before public submission

- Confirm current Arc mainnet configuration from official Circle/Arc docs and execute read-only chain/token checks.
- Run `scripts/preflight.ps1 -Network mainnet` from a network-enabled environment, then obtain a deployment fee estimate for the compiled bytecode before funding.
- Run the complete Solidity suite and expand it to all security invariants listed in `SECURITY.md`.
- Fix all test findings and obtain independent contract review.
- Deploy and verify the reviewed contract on Arc mainnet with explicit owner approval; publish the verified address and explorer-backed transaction evidence.
- Replace fixture UI with a working read/write flow that labels each state accurately; host it at a public URL.
- Publish the source repository and a public builder profile; add live app, repo, contract, and 60–90 sec demo links to `SUBMISSION.md`.
- Confirm the project remains within program eligibility and submit through the Arc House event page.

## Primary references

- [Arc documentation index](https://docs.arc.io/llms.txt)
- [Circle Arc skill — network configuration](https://github.com/circlefin/skills/blob/master/plugins/circle/skills/use-arc/SKILL.md)
- [Arc event indexing — official USDC address and decimals](https://docs.arc.io/integrate/infrastructure/indexing-events)
- [Circle Arc mainnet announcement](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet)
- [Arc Microgrants requirements](https://community.arc.io/public/events/arc-microgrants-f8tijfjhyq)
- [Arcscan public RPC details (third party)](https://docs.arc-scan.org/docs/rpc)
- [Arcscan API and network IDs (third party)](https://docs.arc-scan.org/docs/api)
