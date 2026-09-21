# Arc Microgrants Submission Draft

## Status: not ready to submit

Arc Microgrants requires a project already deployed and working on Arc mainnet, a public repo, a short description of what it does and Arc's role, and a public builder profile. AgentLedger currently has no deployment, no public hosted app, and no real payment evidence. Do not submit this draft until the checklist below is complete.

## Deployment Readiness

This repository has not passed Solidity compilation/tests, live Arc JSON-RPC preflight, independent security review, or testnet lifecycle rehearsal. Deployment scripts are prepared but are not deployment approval. Before deployment, obtain a live fee estimate and explicitly approve the irreversible broadcast. `MIN_USDC_BALANCE` is an optional configurable balance gate, not an estimated deployment cost. Use a Foundry encrypted keystore or interactive signer; never put a raw private key in a command or environment variable.

## Short description

AgentLedger gives autonomous agents a budget for a specific research or procurement task and connects each authorized USDC payment to its originating task, delegation chain, service request, and outcome evidence. Arc is the settlement layer: MandateGraph is designed to enforce task-bound authority and settle USDC transfers on Arc, where USDC also pays transaction fees.

## Why it matters

As teams let AI workers buy data, translation, and API access, a spend limit alone leaves an audit question: which human objective justified an expense, which agent delegated that authority, and what was delivered? AgentLedger makes that lineage the primary record.

## What is implemented

The repository contains an experimental Solidity contract implementing task-rooted mandates, bounded delegation, request-bound payment IDs, replay protection, ancestry checks, revocation, budget attribution, and USDC `transferFrom`; plus a local fixture dashboard showing a research workflow. The browser demo does not call the contract. Contract tests have not been run in the current environment, and the contract is unaudited.

## Arc's role

On a completed deployment, Arc would provide the public settlement and audit layer for USDC payments, and its stablecoin-native gas model would let the same asset fund execution. Arc is a core part of the intended value flow, not merely a branding target. Today, this integration is only contract code and configuration research; there is no live Arc transaction evidence.

## Product distinction

Circle Agent Wallets, Coinbase Agentic Wallets, Crossmint, Safe spending controls, and x402Shield cover wallet operations, spending policies, payment access, or request authorization. AgentLedger focuses its product model on the link between a task, multi-agent authority lineage, expense attribution, and output evidence. It makes no claim that competitors cannot build similar integrations; compare their current product capabilities directly.

## Current evidence

- Live Arc app: `TBD — not deployed`
- Public repository: `TBD — not published`
- Mainnet contract and explorer evidence: `TBD — no deployment`
- Public builder profile: `TBD`
- Demo video (60–90 sec): `TBD`
- Solidity suite: not yet executed in this environment

## Deployment Readiness

This repository has not passed Solidity compilation/tests, live Arc JSON-RPC preflight, independent security review, or testnet lifecycle rehearsal. The deployment scripts are prepared but are not a deployment approval. Before deployment, obtain a gas estimate from the live RPC and explicitly approve the irreversible broadcast. The optional `MIN_USDC_BALANCE` token-balance floor in `scripts/preflight.ps1` is only a configurable balance gate; it is not an estimated deployment cost.

## Before submission

- [ ] Reconcile the stale “testnet only” line in the Arc docs index against the current official mainnet configuration; run read-only RPC and USDC code/metadata/balance checks from a network-enabled environment.
- [ ] Install a local Solidity toolchain and run all contract tests; add tests for each item in `SECURITY.md`.
- [ ] Fix findings and obtain an independent contract review.
- [ ] Test the complete lifecycle on Arc testnet, including a real test USDC settlement and revoke-blocked retry.
- [ ] Have the user explicitly approve any funded mainnet transaction; deploy and verify source on Arc mainnet.
- [ ] After deployment, fill the Live Evidence template with actual verified address and transaction hashes; do not use fixture IDs or hashes.
- [ ] Build a real wallet-connected app and public hosted demo that reads/writes chain state and labels evidence accurately.
- [ ] Publish the repository and add public builder profile links.
- [ ] Record a 60–90 sec demo with explorer-backed transaction links.
- [ ] Recheck live event requirements, eligibility, dates, and application fields; then submit once.

## Links to add

- Live app: `TBD`
- Public repository: `TBD`
- Verified contract: `TBD`
- Mainnet transaction evidence: `TBD`
- Builder profile: `TBD`
- Demo video: `TBD`

## Live Evidence (fill only from verified Arc mainnet transactions)

- Contract address: `TBD — not deployed`
- Deployment transaction: `TBD — not deployed`
- Create task transaction: `TBD — not executed`
- Delegation transaction: `TBD — not executed`
- Payment transaction and explicit amount: `TBD — not executed`
- Outcome receipt transaction: `TBD — not executed`
- Root revocation transaction: `TBD — not executed`
- Blocked retry evidence: `TBD — not executed`
- Explorer base: `https://explorer.arc.io` (official Circle skill)

The event page currently describes 20 awards of 500 USDC and rolling review, but selection is competitive and no award is guaranteed.
