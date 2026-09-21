# AgentLedger — Arc Microgrants Submission

## One-line pitch

AgentLedger gives autonomous agents task-bound USDC spending authority and records the delegation and payment lineage behind each authorized expense.

## Problem

A wallet spend limit can cap an agent’s total outflow, but it does not explain which human task authorized a payment, which agent delegated that authority, or how much budget remains reserved for other work. As teams use agents to buy data, translation, and API access, they need spending controls tied to the work itself.

## Solution

AgentLedger’s MandateGraph model connects a human-defined task to a root spending mandate, narrower child mandates, payment requests, and linked outcome data. Each child mandate reserves part of its parent’s available budget. Delegation cannot widen the parent’s budget, service scope, recipient restriction, or expiry. A payment request is bound to its task, mandate, recipient, amount, service class, resource hash, expiry, and nonce. Revoking a task or mandate blocks descendant authority when checked.

The repository contains an experimental Solidity contract and a local browser simulation. The UI uses deterministic fixture data and is not connected to the contract.

## Why Arc

Arc provides the settlement environment for the project’s USDC payment flow. A public chain makes mandate and payment transactions inspectable, while USDC-denominated payments fit the project’s task-budget model. AgentLedger has completed a documented Arc Mainnet lifecycle rehearsal, including deployment, task creation, delegation, payment execution, revocation, and a read-only check that a post-revocation retry is blocked.

## How it works

1. A human defines a task budget, deadline, service scope, and delegation depth.
2. The root agent delegates a reserved portion of its unallocated budget. Child authority is equal to or narrower than its parent’s.
3. A payment request is bound to its task, mandate, recipient, amount, service class, resource hash, expiry, and nonce.
4. The contract checks the request and authority ancestry, accounts for the payment, and calls USDC `transferFrom`.
5. Revocation prevents future payment attempts from using the revoked authority or its descendants.

The contract emits request and outcome hashes for lineage. An outcome hash is caller-supplied data; it does not independently authenticate service delivery.

## Verified Arc Mainnet evidence

- Network: Arc Mainnet, chain ID 5042.
- Contract: [0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da)
- Lifecycle transactions: [deployment](https://explorer.arc.io/tx/0x7f1287234e0b9049b45aa5ea67857c358ac95fda7b2e1e9ac2516070157d80b8), [task creation](https://explorer.arc.io/tx/0x17602976ae236cd73f0c2fb9e0d34e82e8f841a82f7d8c1ff2b33abad9ccb731), [delegation](https://explorer.arc.io/tx/0xe8bb539e56eaa8e94321326870f89d5acc8f2c616cd746ab40566373f8b1eb8b), [payment execution](https://explorer.arc.io/tx/0xba0064e2a6cb13daeffafe90e79fc53c94d25ea7ae0a205e58bbee53c46eec6e), and [task revocation](https://explorer.arc.io/tx/0x7a694807ac98d25f6e4145fd2fc7f715838269544155309ac69602b66c8f65ba).
- The payment was 0.01 USDC. A retry after revocation was confirmed blocked through a read-only check.
- Structured parameters and transaction hashes: [MAINNET_EVIDENCE.json](docs/MAINNET_EVIDENCE.json).

The recipient was a separately controlled demo wallet. This rehearsal demonstrates an onchain task-bound payment path and authority lifecycle; it does not establish an independent vendor relationship, service delivery, or service quality.

## Demo flow

The best current product journey is the local simulation: review the task and budget, follow the mandate and payment lineage, then revoke the task and observe the simulated retry become blocked. The UI is fixture-based and does not read or write Arc. No hosted app URL is available.

For the short presentation, pair the simulation with the Arc explorer transaction pages and the checked-in evidence JSON. See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for a timed recording guide.

## Technical highlights

- Task-rooted spending mandates with bounded delegation depth.
- Monotonic reduction of delegated budget, service scope, expiry, and recipient authority.
- Child-budget reservation and ancestor budget accounting.
- Request-bound payment IDs and replay protection.
- Ancestry checks for revocation and expiry before payment.
- Arc Mainnet deployment and documented lifecycle evidence.
- Foundry contract tests and a GitHub Actions CI workflow; refer to the latest workflow run for the tested revision’s result.

## What has been built

The repository now includes the MandateGraph Solidity prototype, deterministic local dashboard, contract and lifecycle test suites, Arc Mainnet evidence, and submission/demo materials. For an application field asking specifically what was completed during a grant period, enter the relevant dates and describe only work completed within that period; no grant-period dates are asserted here.

## Limitations

- The deployed contract is experimental and unaudited.
- The browser simulation uses fixture data and is not integrated with the deployed contract.
- The mainnet recipient was a separately controlled demo wallet, not a verified vendor.
- The lifecycle does not prove service delivery or output quality. Outcome hashes provide caller-supplied lineage only.
- A production product still needs a wallet-connected client, canonical request signing, durable evidence/indexing, independent service evidence, broader adversarial review, and security audit.

## Links

- Repository: https://github.com/noboru59631/agentledger
- Hosted app: Not available; the browser demo runs locally using the instructions in [README.md](README.md).
- Arc Mainnet contract: https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da
- Mainnet evidence: [docs/MAINNET_EVIDENCE.json](docs/MAINNET_EVIDENCE.json)
- Demo video: [Add recorded video URL]
- Builder profile: [Add public profile URL]
