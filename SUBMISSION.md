# Arc Microgrants Submission Draft

## Status: submission draft; remaining requirements are listed below

AgentLedger is deployed on Arc Mainnet and has completed a task-bound payment lifecycle rehearsal. The public repository and explorer-backed evidence are available below. The browser demo is not a live hosted app, and the rehearsal does not establish an independent vendor relationship or service delivery. Confirm all event requirements and remaining submission materials before submitting.

## Deployment Readiness

The supplied Arc Mainnet evidence records a successful read-only preflight and completed lifecycle rehearsal. The contract remains unaudited; deployment evidence is not a security review. Before deployment, obtain a live fee estimate and explicitly approve the irreversible broadcast. `MIN_USDC_BALANCE` is an optional configurable balance gate, not an estimated deployment cost. Use a Foundry encrypted keystore or interactive signer; never put a raw private key in a command or environment variable.

## Short description

AgentLedger gives autonomous agents a budget for a specific research or procurement task and connects each authorized USDC payment to its originating task, delegation chain, service request, and outcome evidence. Arc is the settlement layer: MandateGraph is designed to enforce task-bound authority and settle USDC transfers on Arc, where USDC also pays transaction fees.

## Why it matters

As teams let AI workers buy data, translation, and API access, a spend limit alone leaves an audit question: which human objective justified an expense, which agent delegated that authority, and what was delivered? AgentLedger makes that lineage the primary record.

## What is implemented

The repository contains an experimental Solidity contract implementing task-rooted mandates, bounded delegation, request-bound payment IDs, replay protection, ancestry checks, revocation, budget attribution, and USDC `transferFrom`; plus a local fixture dashboard showing a research workflow. The browser demo does not call the contract. Contract tests have not been run in the current environment, and the contract is unaudited.

## Arc's role

On a completed deployment, Arc would provide the public settlement and audit layer for USDC payments, and its stablecoin-native gas model would let the same asset fund execution. Arc is a core part of the intended value flow, not merely a branding target. The contract has completed a documented Arc Mainnet task-payment rehearsal; see the transaction evidence below. The browser demo does not call the contract.

## Product distinction

Circle Agent Wallets, Coinbase Agentic Wallets, Crossmint, Safe spending controls, and x402Shield cover wallet operations, spending policies, payment access, or request authorization. AgentLedger focuses its product model on the link between a task, multi-agent authority lineage, expense attribution, and output evidence. It makes no claim that competitors cannot build similar integrations; compare their current product capabilities directly.

## Current evidence

- Live Arc app: `TBD — not deployed`
- Public repository: `TBD — not published`
- Mainnet contract and explorer evidence: [contract](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da) and [evidence JSON](docs/MAINNET_EVIDENCE.json)
- Public builder profile: `TBD`
- Demo video (60–90 sec): `TBD`
- Solidity suite: not yet executed in this environment

## Deployment Readiness

This repository has not passed Solidity compilation/tests, live Arc JSON-RPC preflight, independent security review, or testnet lifecycle rehearsal. The deployment scripts are prepared but are not a deployment approval. Before deployment, obtain a gas estimate from the live RPC and explicitly approve the irreversible broadcast. The optional `MIN_USDC_BALANCE` token-balance floor in `scripts/preflight.ps1` is only a configurable balance gate; it is not an estimated deployment cost.

## Before submission

- [ ] Install a local Solidity toolchain and run all contract tests; add tests for each item in `SECURITY.md`.
- [ ] Fix findings and obtain an independent contract review.
- [x] Complete a task-bound payment lifecycle rehearsal on Arc Mainnet; see explorer-backed evidence below.
- [ ] Build a real wallet-connected app and public hosted demo that reads/writes chain state and labels evidence accurately.
- [ ] Publish the repository and add public builder profile links.
- [ ] Record a 60–90 sec demo with explorer-backed transaction links.
- [ ] Recheck live event requirements, eligibility, dates, and application fields; then submit once.

## Links to add

- Live app: `TBD`
- Public repository: `TBD`
- Verified contract: `TBD`
- Mainnet transaction evidence: [`docs/MAINNET_EVIDENCE.json`](docs/MAINNET_EVIDENCE.json)
- Builder profile: `TBD`
- Demo video: `TBD`

## Live Evidence (fill only from verified Arc mainnet transactions)

- Contract address: [0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da)
- Deployment: [explorer](https://explorer.arc.io/tx/0x7f1287234e0b9049b45aa5ea67857c358ac95fda7b2e1e9ac2516070157d80b8)
- Create task: [explorer](https://explorer.arc.io/tx/0x17602976ae236cd73f0c2fb9e0d34e82e8f841a82f7d8c1ff2b33abad9ccb731)
- Delegation: [explorer](https://explorer.arc.io/tx/0xe8bb539e56eaa8e94321326870f89d5acc8f2c616cd746ab40566373f8b1eb8b)
- Payment approval: [explorer](https://explorer.arc.io/tx/0x099e17ef1c9ed66450ebb9390bf3653925d3cdf71bbe7c8dc3b2a7800b4f7be3)
- Payment execution: [explorer](https://explorer.arc.io/tx/0xba0064e2a6cb13daeffafe90e79fc53c94d25ea7ae0a205e58bbee53c46eec6e), 0.01 USDC
- Root revocation: [explorer](https://explorer.arc.io/tx/0x7a694807ac98d25f6e4145fd2fc7f715838269544155309ac69602b66c8f65ba)
- Blocked retry: `retryBlocked: true`, confirmed by a read-only check
- Scope: deployment, task-bound payment path, delegation, revocation, and retry blocking only; no independent vendor relationship, service delivery, or service proof is claimed. No `outcomeHash` claim is made.
- Full evidence: [`docs/MAINNET_EVIDENCE.json`](docs/MAINNET_EVIDENCE.json)

The event page currently describes 20 awards of 500 USDC and rolling review, but selection is competitive and no award is guaranteed.
