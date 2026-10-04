# AgentLedger

> Give AI a budget for the job, not a wallet full of money.

[![CI](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml/badge.svg)](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml)

AgentLedger is a task-native financial governance prototype for multi-agent systems. It connects human intent to bounded mandates, delegated budgets, payment requests, and outcome lineage.

**AI proposes. AgentLedger decides.** Gemini may propose a plan, but deterministic policy checks decide whether budgets, service scope, delegation, expiry, recipient restrictions, replay protection, and revocation rules are satisfied.

## Public links

- Live app: <https://agentledger-livid.vercel.app/>
- Demo video: <https://youtu.be/aXnjAd3mFsE>
- Repository: <https://github.com/noboru59631/agentledger>
- Builder profile: <https://x.com/noboru59631>

## Current status

The repository includes an experimental, unaudited Solidity contract candidate, a public live app, a real Gemini-backed orchestration route, a wallet-connected Arc Mainnet Demo Mode, and documented evidence from an earlier deployed contract version. The ERC-8004/Authority candidate in this branch is deployed on Arc Testnet only at `0x8135c6E750E240FB352ee6701F2976fF8BA63ea3`; it is not deployed on Mainnet. The earlier mainnet lifecycle used a separately controlled demo wallet; it is not evidence of an independent vendor relationship or service delivery.

The three product surfaces are intentionally separate:

| Surface | What it demonstrates | What it does not do |
| --- | --- | --- |
| Illustrative Simulation | Local fixture state for task, mandate, payment lineage, and revoke/blocked retry | Does not read from Arc or use a wallet |
| AI Orchestrated Demo | Real Gemini proposal when configured, followed by deterministic budget/scope/STOP checks; shows `GEMINI PLAN · POLICY APPROVED` for an accepted live plan | Simulates service costs and never authorizes, settles, or writes to Arc |
| Arc Mainnet Demo Mode | Injected-wallet connection, live balance/read checks, and explicit user-confirmed `createTask`, `delegate`, `approve`, `executePayment`, and `revokeTask` writes | Does not verify vendors, service delivery, or outcome quality |

The Arc Mainnet Demo Mode documents the legacy deployed contract and can spend real USDC if a user deliberately confirms writes. This audit does not authorize or execute Mainnet writes; repository deployment automation is Testnet-only and Mainnet preflight is read-only.

## AI Orchestrated Demo

The public app sends a natural-language goal to `/api/orchestrate`. The server asks Gemini for a strict JSON plan, and the browser validates that plan with deterministic policy rules before displaying agent allocations and simulated service decisions. An invalid proposal is blocked, and `STOP / kill switch` propagates the revoked state to queued descendants.

The default model is `gemini-2.5-flash-lite` through Gemini API `v1beta`. Set `GEMINI_API_KEY` in the Vercel environment to enable live Gemini responses; `GEMINI_MODEL` can override the model. Missing keys, quota failures, malformed responses, and timeouts use a clearly labeled deterministic fallback. Neither Gemini nor this demo can authorize or settle spend.

## Arc Mainnet evidence

**Legacy version status: deployed; documented lifecycle rehearsal completed successfully.** Contract: [`0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da`](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da) on Arc Mainnet, chain ID `5042`, using USDC at `0x3600000000000000000000000000000000000000`. This address does not contain the ERC-8004 identity, career, Authority cap, STOP/demotion, or work-proof changes in this branch.

- Deployment: [transaction](https://explorer.arc.io/tx/0x7f1287234e0b9049b45aa5ea67857c358ac95fda7b2e1e9ac2516070157d80b8)
- Task creation: [transaction](https://explorer.arc.io/tx/0x17602976ae236cd73f0c2fb9e0d34e82e8f841a82f7d8c1ff2b33abad9ccb731)
- Delegation: [transaction](https://explorer.arc.io/tx/0xe8bb539e56eaa8e94321326870f89d5acc8f2c616cd746ab40566373f8b1eb8b)
- Payment approval: [transaction](https://explorer.arc.io/tx/0x099e17ef1c9ed66450ebb9390bf3653925d3cdf71bbe7c8dc3b2a7800b4f7be3)
- Payment execution: [transaction](https://explorer.arc.io/tx/0xba0064e2a6cb13daeffafe90e79fc53c94d25ea7ae0a205e58bbee53c46eec6e)
- Task revocation: [transaction](https://explorer.arc.io/tx/0x7a694807ac98d25f6e4145fd2fc7f715838269544155309ac69602b66c8f65ba)
- Retry after revocation: `retryBlocked: true`, verified with a read-only check.

The recipient was a separately controlled demo wallet, not a verified vendor. The evidence demonstrates deployment, task-bound payment execution, delegation, revocation, and blocked retry behavior. It does not prove service delivery or output quality. Outcome hashes are caller-supplied lineage data, not independent proof of service delivery. Full parameters are in [`docs/MAINNET_EVIDENCE.json`](docs/MAINNET_EVIDENCE.json).

## Arc Testnet audit evidence

**ERC-8004/Authority candidate status: deployed and lifecycle verified on Arc Testnet.** Contract: [`0x8135c6E750E240FB352ee6701F2976fF8BA63ea3`](https://testnet.arcscan.app/address/0x8135c6E750E240FB352ee6701F2976fF8BA63ea3), bound to official Identity Registry `0x8004A818BFB912233c491871b3d84c89A494BD9e` and agentId `897002`.

The verified path covered identity registration, candidate deployment, Trainee registration, task/delegation, 0.01 USDC payment, payment-bound work proof, human-approved promotion and Authority increase, 0.02 USDC payment, violation/demotion with STOP and Authority reduction, explicit remediation/reinstatement, and a read-only rejection above the reduced cap. All 12 submitted transactions succeeded; the final over-cap call reverted with `AuthorityCapExceeded`. Full hashes and independently checked final state are in [`docs/TESTNET_EVIDENCE.json`](docs/TESTNET_EVIDENCE.json).

## Implemented contract behavior

- Task-rooted mandates with deadline, service bitmap, and bounded delegation depth.
- Delegation with reserved child budgets and non-widening scope, expiry, recipient, and depth.
- Payment IDs bound to task, mandate, recipient, amount, service class, resource hash, expiry, and nonce.
- Official ERC-8004 Identity Registry ownership checks, one-to-one `agentId` binding, and ownership-transfer-aware administration.
- Successful-payment-bound work proof, human-approved one-step promotion, per-payment Authority caps, STOP/demotion, and explicit reinstatement.
- One-use payment IDs, ancestor revocation/expiry/STOP checks, reservation accounting and release, USDC `transferFrom`, and indexed payment/work evidence.
- Contract-wide reentrancy protection around same-function and cross-function token callbacks.

These are code properties, not an independent audit or proof that a deployed system is safe.

## Local development

Requirements: Node.js 20+, upstream Foundry for baseline/local lifecycle tests, and Circle Arc Foundry for Arc execution semantics.

```powershell
npm install
npm start
# Open http://localhost:4173
npm test
forge test -vv
FOUNDRY_PROFILE=arc arc-forge test -vvv
```

## Differentiation

Circle/Arc wallets and other wallet products are complementary wallet and settlement rails. AgentLedger does not claim to replace them. Its narrower focus is task-native financial governance for multi-agent systems: tying proposed work to delegated authority, reserved budgets, scope, lineage, and revocation.

## Limitations and caveats

- The legacy Mainnet contract and the Arc Testnet ERC-8004 candidate are experimental and unaudited.
- Mainnet writes require explicit wallet confirmation and can spend real USDC.
- AI demo service costs are simulated; the AI route never writes to the chain.
- The mainnet recipient was a controlled demo wallet, not a verified vendor.
- Outcome hashes are caller-supplied lineage, not independent proof of service delivery.
- Validation Registry is not an MVP dependency; Reputation Registry feedback remains external to AgentLedger's performance-to-Authority conversion.
- The live app separates fixture simulation, AI orchestration, and wallet-confirmed Mainnet actions; they are not presented as one end-to-end automated settlement system.

## Remaining hardening / Roadmap

- Independent contract review, broader adversarial/fuzz testing, and formal verification where appropriate.
- Verified source publication and production-grade signer/account abstraction.
- Durable event indexing and independently obtained service evidence.
- Canonical request signing, vendor identity/dispute flows, refunds, and safer production wallet architecture.
- Confirm current Arc program eligibility and submit through the official Arc Microgrants form.

Mainnet deployment/broadcast is disabled in `scripts/deploy.ps1`. Complete the Arc Testnet identity registration, CI, deployment, lifecycle evidence, and independent review before any separate Mainnet decision.

## Primary references

- [Arc documentation index](https://docs.arc.io/llms.txt)
- [Arc: Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc: Contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Circle Arc mainnet announcement](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet)
- [Arc Microgrants requirements](https://community.arc.io/public/events/arc-microgrants-f8tijfhyq)
