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
3. **Arc Mainnet Read-only Mode:** injected-wallet connection, chain/address/balance reads, and controlled PoC Explorer evidence. It exposes no write controls.

The ERC-8004/Authority candidate is deployed and working on Arc Mainnet. A separately controlled PoC completed `0.005` and `0.02 USDC` payments, exact `0.025 USDC` approval, and a read-only `0.026 USDC` cap rejection. Repository automation cannot broadcast Mainnet transactions.

## Verified Arc Mainnet evidence

- Network: Arc Mainnet, chain ID `5042`.
- Contract: [0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e](https://explorer.arc.io/address/0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e), exact-match [Sourcify verification](https://sourcify.dev/server/v2/contract/5042/0xdc321eb50cff0239a2c43532ecc8b0c41d969a9e).
- ERC-8004 Identity: Mainnet agentId `1395`, owned by the controlled PoC signer.
- Lifecycle: [Identity registration](https://explorer.arc.io/tx/0xf611588bdbcb232d007c0b8d3b559409d51b88acf2ec3ab240486f3ca69fb39a), [deployment](https://explorer.arc.io/tx/0x24c2f75b9db21297c92c1e317383a866d074112a9c684eb520228a87baadb5d4), [task](https://explorer.arc.io/tx/0xf2d21736f5f80a3316ca5abe7f6515897b48929579c79d687135b090a4527176), [delegation](https://explorer.arc.io/tx/0x3aef9c43d4a96fba54c82312386fcefbb6d6d5da8a0756739f98042c86a046d2), [small payment](https://explorer.arc.io/tx/0xc3b12fe6981c8bfb9e5c8ae9677a4083a7db9c3b41fa1d3e2abd985e953d9956), [work proof](https://explorer.arc.io/tx/0x4f95c1fda801598a6b0a635000f0c22b0f3474cad189108bae8a2408a8b8f440), [Promotion](https://explorer.arc.io/tx/0x0a492d04a14cf638dfb0bc7638ba4557307fbe3f2ee27ffd328924dbaa0be8fc), [larger payment](https://explorer.arc.io/tx/0x8b487174fccac75481fff4aadb87e90cc13484ea6b6ef9da7bed3f095d227009), [STOP/Demotion](https://explorer.arc.io/tx/0xa0110d645f957e1c7c1e0d5e9db7a56f808ae51d669a388ee48a4bfe5ed98e17), and [reinstatement](https://explorer.arc.io/tx/0x51dbfdf95cb62e891eb8bbc1c22e737544e59dbca5ce9d71a3351aca0543a24b).
- Authority: `0.01 → 0.05 → 0.025 USDC`; a `0.026 USDC` `eth_call` reverted with `AuthorityCapExceeded()` without broadcasting a failed transaction.
- Totals: `0.025000 USDC` executed payment and `0.08705870 USDC` receipt-derived fees across 13 successful transactions.
- Structured parameters, all hashes, calldata, final state, and rejection output: [`docs/MAINNET_AUTHORITY_EVIDENCE.json`](docs/MAINNET_AUTHORITY_EVIDENCE.json).

The recipient was a separately controlled demo wallet, not a verified vendor. This evidence demonstrates an onchain task-bound payment path and authority lifecycle; it does not prove service delivery, service quality, or an independent vendor relationship. Outcome hashes are caller-supplied lineage only.

## Technical credibility

- Solidity MandateGraph prototype with bounded delegation, reserved child budgets, request-bound payment IDs, replay protection, ancestry checks, and reentrancy protection.
- Node test suite covering browser policy, live-mode guards, AI policy, orchestration routes, lifecycle helpers, and deployment configuration.
- Foundry contract tests and stateful invariants run in CI with fuzzing.
- Exact-match verified ERC-8004/Authority deployment and controlled lifecycle evidence on Arc Mainnet.

The exact test result belongs to the CI run for the submitted commit; no test count is hard-coded here.

## Quality and next step

The product is usable as a public demonstration today, while the contract remains experimental and unaudited. The next hardening steps are independent review, broader adversarial testing, durable event indexing, canonical signing, independent service evidence, and production-grade wallet/account abstraction. Production Mainnet remains NO-GO.

## Submission links

- Live app: https://agentledger-livid.vercel.app/
- Demo video: https://youtu.be/aXnjAd3mFsE
- Repository: https://github.com/noboru59631/agentledger
- Builder profile: https://x.com/noboru59631
- Arc Mainnet contract: https://explorer.arc.io/address/0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e

## Manual form fields

Use the links above in the Arc Microgrants form. If the form asks for a short description, use the one-line pitch. If it asks what remains, describe the hardening roadmap above and keep the experimental/unaudited caveat explicit. Enter grant-period dates manually; this repository does not assert dates for work completed during a grant period.
