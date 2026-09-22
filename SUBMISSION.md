# AgentLedger — Arc Microgrants Submission

## One-line pitch

**AI proposes. AgentLedger decides.** AgentLedger gives multi-agent systems task-bound USDC spending authority and deterministic financial governance for delegation, scope, budgets, lineage, and revocation.

## Problem

A wallet spend limit caps outflow but does not explain which human task authorized a payment, which agent delegated that authority, how much budget is reserved for descendants, or why a payment should be allowed. Agent teams need controls tied to work, not only to an account balance.

## Solution

MandateGraph connects a human-defined task to a root mandate, narrower child mandates, payment requests, and outcome lineage. Child budgets reserve part of the parent’s available budget. Delegation cannot widen budget, service scope, recipient restriction, expiry, or depth. Each payment request is bound to its task, mandate, recipient, amount, service class, resource hash, expiry, and nonce. Revoking a task or mandate blocks descendant authority when checked.

Gemini is proposal-only: it suggests task decomposition, child agents, budgets, and services. AgentLedger applies deterministic policy checks. Invalid proposals are blocked, and the STOP / kill switch propagates revocation to queued descendants.

## Why Arc

Arc’s USDC-native settlement environment is a natural rail for bounded agent spending. AgentLedger adds the task-native authorization and multi-agent governance layer above that rail. Circle/Arc wallets remain complementary wallet and settlement infrastructure; AgentLedger does not claim to replace them.

## What is live

The public app has three clearly separated modes:

1. **Illustrative Simulation:** local fixture task and lineage state; no wallet or Arc reads.
2. **AI Orchestrated Demo:** real Gemini proposal when configured, deterministic policy approval/rejection, simulated service costs, and STOP propagation; no automatic chain writes.
3. **Arc Mainnet Demo Mode:** injected-wallet connection and explicit confirmation for each live write. The flow supports `createTask`, `delegate`, USDC `approve`, `executePayment`, and `revokeTask` on Arc Mainnet chain ID `5042`.

The live mode is experimental and unaudited, caps demo payments at `0.01 USDC`, and can spend real USDC. No write occurs without the user approving the wallet prompt.

## Verified Arc Mainnet evidence

- Network: Arc Mainnet, chain ID `5042`.
- Contract: [0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da)
- Lifecycle: [deployment](https://explorer.arc.io/tx/0x7f1287234e0b9049b45aa5ea67857c358ac95fda7b2e1e9ac2516070157d80b8), [task creation](https://explorer.arc.io/tx/0x17602976ae236cd73f0c2fb9e0d34e82e8f841a82f7d8c1ff2b33abad9ccb731), [delegation](https://explorer.arc.io/tx/0xe8bb539e56eaa8e94321326870f89d5acc8f2c616cd746ab40566373f8b1eb8b), [payment execution](https://explorer.arc.io/tx/0xba0064e2a6cb13daeffafe90e79fc53c94d25ea7ae0a205e58bbee53c46eec6e), and [task revocation](https://explorer.arc.io/tx/0x7a694807ac98d25f6e4145fd2fc7f715838269544155309ac69602b66c8f65ba).
- Payment: `0.01 USDC`; post-revocation retry: `retryBlocked: true` through a read-only check.
- Structured parameters and hashes: [`docs/MAINNET_EVIDENCE.json`](docs/MAINNET_EVIDENCE.json).

The recipient was a separately controlled demo wallet, not a verified vendor. This evidence demonstrates an onchain task-bound payment path and authority lifecycle; it does not prove service delivery, service quality, or an independent vendor relationship. Outcome hashes are caller-supplied lineage only.

## Technical credibility

- Solidity MandateGraph prototype with bounded delegation, reserved child budgets, request-bound payment IDs, replay protection, ancestry checks, and reentrancy protection.
- Node test suite covering browser policy, live-mode guards, AI policy, orchestration routes, lifecycle helpers, and deployment configuration.
- Foundry contract tests and stateful invariants run in CI with fuzzing.
- Arc Mainnet deployment and documented lifecycle evidence.

The exact test result belongs to the CI run for the submitted commit; no test count is hard-coded here.

## Quality and next step

The product is usable as a public demonstration today, while the contract remains experimental. The next hardening steps are independent review, verified source publication, broader adversarial testing, durable event indexing, canonical signing, independent service evidence, and production-grade wallet/account abstraction.

## Submission links

- Live app: https://agentledger-livid.vercel.app/
- Demo video: https://youtu.be/aXnjAd3mFsE
- Repository: https://github.com/noboru59631/agentledger
- Builder profile: https://x.com/noboru59631
- Arc Mainnet contract: https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da

## Manual form fields

Use the links above in the Arc Microgrants form. If the form asks for a short description, use the one-line pitch. If it asks what remains, describe the hardening roadmap above and keep the experimental/unaudited caveat explicit. Enter grant-period dates manually; this repository does not assert dates for work completed during a grant period.
