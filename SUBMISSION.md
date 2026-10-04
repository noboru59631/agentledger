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
3. **Public Arc Mainnet V2 dApp:** wallet connection, network switching, owner-verified Agents, task creation, exact USDC approval/revoke, payment, work proof, promotion, STOP/demotion, reinstatement, and read-only cap testing.

The self-custodial V2 contract is deployed, Sourcify exact-match verified, lifecycle-tested, and active in the public dApp. Its controlled Mainnet smoke completed `0.005` and `0.02 USDC` payments, exact `0.025 USDC` approval, and a read-only `0.026 USDC` cap rejection with final allowance zero.

## Verified Arc Mainnet evidence

- Network: Arc Mainnet, chain ID `5042`.
- Contract: [0x015099f831c247460b467154c73028804Ea38a10](https://explorer.arc.io/address/0x015099f831c247460b467154c73028804Ea38a10), exact-match [Sourcify verification](https://sourcify.dev/server/v2/contract/5042/0x015099f831c247460b467154c73028804ea38a10).
- ERC-8004 Identity: Mainnet agentId `1395`, owned by the controlled PoC signer.
- Lifecycle: [registration](https://explorer.arc.io/tx/0x3d888ca1482d1f592ebf9faf29edc29c15e03cabf6f890761e67719ed65b1369), [task](https://explorer.arc.io/tx/0xba222a896744a8609e0c6be202e51e69984c5cfbb9930a11e9337076a10564b6), [delegation](https://explorer.arc.io/tx/0x3245b0cb7ae47b2b6e44fcde852f7976166db41765aefb222d893ad0d5c83d50), [small payment](https://explorer.arc.io/tx/0x785ea926de8b7addcb5443ce2b2354bb681c0aea72b0ed330e17d030ffdb8f20), [work proof](https://explorer.arc.io/tx/0xd1f8aa095797c7ce1c04f3fa4073aae277e6c298c2be05fb5dc69dc96ed82ce5), [Promotion](https://explorer.arc.io/tx/0xb4bb0d25ee84924258828debec85c8fe364a7250e7c45f646acb8615709c80db), [larger payment](https://explorer.arc.io/tx/0xb62b204513d6fb83046e51b9de84d2d216f732599c0a798b2f4ebb51cf3280f0), [STOP/Demotion](https://explorer.arc.io/tx/0x1ffad00314e2714a66de6bdee35530a95d2327d2fda8bc57886835f3ae1fb433), and [reinstatement](https://explorer.arc.io/tx/0x37c72e097b1e6ae1321712b8fd710120b24b26236e87b5dfec10b46e991d2e4e).
- Authority: `0.01 → 0.05 → 0.025 USDC`; a `0.026 USDC` `eth_call` reverted with `AuthorityCapExceeded()` without broadcasting a failed transaction.
- Totals: `0.025000 USDC` executed payment and `0.02803583401791` native USDC receipt-derived fees across 10 successful transactions, 0 failed broadcasts.
- Structured parameters, all hashes, calldata, final state, and isolation output: [`docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json`](docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json).

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
- Arc Mainnet V2 contract: https://explorer.arc.io/address/0x015099f831c247460b467154c73028804Ea38a10
- Sourcify exact match: https://sourcify.dev/server/v2/contract/5042/0x015099f831c247460b467154c73028804ea38a10

## Manual form fields

Use the links above in the Arc Microgrants form. If the form asks for a short description, use the one-line pitch. If it asks what remains, describe the hardening roadmap above and keep the experimental/unaudited caveat explicit. Enter grant-period dates manually; this repository does not assert dates for work completed during a grant period.
