# AgentLedger

> Don’t give a new AI agent the keys to the company wallet. Let it earn them.

[![CI](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml/badge.svg)](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml)

AgentLedger is an earned-authority layer for individuals and companies that want AI agents to complete real work and make bounded USDC payments. A new agent starts with a small task-bound cap, recorded work can support a human-approved increase, and a violation triggers STOP plus an enforceable reduction.

**AI proposes. Humans approve progression. AgentLedger enforces.** Gemini may propose a plan. ERC-8004 provides portable identity and external reputation or validation inputs. The AgentLedger contract—not ERC-8004—enforces budgets, Authority caps, scope, delegation, replay protection, STOP, and payment rejection.

## Public links

- Live app: <https://agentledger-livid.vercel.app/>
- Demo video: <https://youtu.be/aXnjAd3mFsE>
- Repository: <https://github.com/noboru59631/agentledger>
- Builder profile: <https://x.com/noboru59631>

## Current status

The repository includes an experimental, unaudited Solidity contract candidate, a public live app, a real Gemini-backed orchestration route, a read-only Arc Mainnet evidence surface, and documented evidence from an earlier deployed contract version. The ERC-8004/Authority candidate in this branch is deployed on Arc Testnet only at `0x8135c6E750E240FB352ee6701F2976fF8BA63ea3`; it is not deployed on Mainnet. The earlier mainnet lifecycle used a separately controlled demo wallet; it is not evidence of an independent vendor relationship or service delivery.

The three product surfaces are intentionally separate:

| Surface | What it demonstrates | What it does not do |
| --- | --- | --- |
| Illustrative Simulation | Local fixture state for task, mandate, payment lineage, and revoke/blocked retry | Does not read from Arc or use a wallet |
| AI Orchestrated Demo | Real Gemini proposal when configured, followed by deterministic budget/scope/STOP checks; shows `GEMINI PLAN · POLICY APPROVED` for an accepted live plan | Simulates service costs and never authorizes, settles, or writes to Arc |
| Arc Mainnet Read-only Mode | Injected-wallet connection plus chain, address, and USDC balance reads; historical Explorer evidence | Cannot create, delegate, approve, pay, revoke, deploy, or broadcast |

The Arc Mainnet read-only surface documents the legacy deployed contract without exposing transaction controls. Mainnet broadcast remains disabled in repository automation. `npm run lifecycle:arc-mainnet:preflight` performs only RPC reads and local artifact checks, writes a stopped-before-signature plan to `docs/MAINNET_AUTHORITY_EVIDENCE.json`, and never reads a keystore or asks for a password.

## Controlled Mainnet PoC plan

The Arc Microgrants PoC is intentionally separate from a production launch. Its target story is `Trainee → small payment → work proof → human-approved Promotion → larger payment → violation/STOP → Demotion → remediation/reinstatement → AuthorityCapExceeded simulation`.

- Initial Authority: `0.01 USDC` (`10,000` base units).
- Small payment: `0.005 USDC` (`5,000` base units).
- Promoted Authority: `0.05 USDC` (`50,000` base units).
- Larger payment: `0.02 USDC` (`20,000` base units).
- Demoted Authority: `0.025 USDC` (`25,000` base units).
- Rejected request: `0.026 USDC` (`26,000` base units), proven by `eth_call` without a failed Mainnet transaction.
- Exact approval: `0.025 USDC`; total executed payment: `0.025 USDC`.

The controlled PoC is experimental, unaudited, limited to demonstration amounts, and not intended for production custody or unrestricted autonomous spending.

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

- The legacy Mainnet contract and the ERC-8004/Authority candidate are experimental and unaudited.
- Mainnet writes are disabled in the browser and automation; historical Mainnet transactions remain linked as evidence.
- AI demo service costs are simulated; the AI route never writes to the chain.
- The mainnet recipient was a controlled demo wallet, not a verified vendor.
- Outcome hashes are caller-supplied lineage, not independent proof of service delivery.
- Validation Registry is not an MVP dependency; Reputation Registry feedback remains external to AgentLedger's performance-to-Authority conversion.
- The live app separates fixture simulation, AI orchestration, read-only Mainnet evidence, and Arc Testnet lifecycle evidence.

## Remaining hardening / Roadmap

- Independent contract review, broader adversarial/fuzz testing, and formal verification where appropriate.
- Verified source publication and production-grade signer/account abstraction.
- Durable event indexing and independently obtained service evidence.
- Canonical request signing, vendor identity/dispute flows, refunds, and safer production wallet architecture.
- Confirm current Arc program eligibility and submit through the official Arc Microgrants form.

Mainnet deployment/broadcast is disabled in repository automation. The controlled Arc Microgrants PoC uses separately reviewed local commands and stops before every signature; production Mainnet remains NO-GO pending independent review and the remaining hardening work.

## Primary references

- [Arc documentation index](https://docs.arc.io/llms.txt)
- [Arc: Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc: Contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Circle Arc mainnet announcement](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet)
- [Arc Microgrants requirements](https://community.arc.io/public/events/arc-microgrants-f8tijfhyq)
