# AgentLedger — Arc Microgrants Submission

## One-line pitch

**Don’t give a new AI agent the keys to the company wallet. Let it earn them.** AgentLedger starts an agent with small, task-bound USDC authority, lets recorded work support a human-approved increase, and reduces authority after a violation.

## Problem

Unlimited wallet authority is unsafe, while asking a human to approve every action removes the autonomy people and companies want from AI agents. A wallet spend limit also cannot explain which task authorized a payment, which agent delegated it, or what authority remains.

## Solution

MandateGraph connects a human-defined task to narrower mandates, payment requests, outcome lineage, and an agent career state. An agent starts as a Trainee with a small Authority cap. Successful payment-bound work can make it promotion-eligible; only the ERC-8004 identity owner can approve Promotion. A violation applies STOP, records a Demotion, and halves Authority. After explicit remediation, the reduced cap remains enforced.

Gemini is proposal-only. ERC-8004 supplies portable identity plus external reputation and validation inputs. AgentLedger—not ERC-8004—applies deterministic policy and rejects payments that exceed contract-enforced authority.

## Why Arc

Arc’s USDC-native settlement environment is a natural rail for bounded agent spending. AgentLedger adds the task-native authorization and multi-agent governance layer above that rail. Circle/Arc wallets remain complementary wallet and settlement infrastructure; AgentLedger does not claim to replace them.

## What is live

The public app has three clearly separated modes:

1. **Illustrative Simulation:** local fixture task and lineage state; no wallet or Arc reads.
2. **AI Orchestrated Demo:** real Gemini proposal when configured, deterministic policy approval/rejection, simulated service costs, and STOP propagation; no automatic chain writes.
3. **Arc Mainnet Read-only Mode:** injected-wallet connection, chain/address/balance reads, and historical Explorer evidence. It exposes no write controls.

The ERC-8004/Authority candidate is verified on Arc Testnet. A separately controlled Mainnet PoC is being prepared with `0.005` and `0.02 USDC` payments, exact `0.025 USDC` approval, and a read-only `0.026 USDC` cap rejection. Repository automation cannot broadcast Mainnet transactions.

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
- Legacy Arc Mainnet deployment evidence plus ERC-8004/Authority lifecycle evidence on Arc Testnet.

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
