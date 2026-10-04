# AgentLedger

> Don’t give a new AI agent the keys to the company wallet. Let it earn them.

[![CI](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml/badge.svg)](https://github.com/noboru59631/agentledger/actions/workflows/ci.yml)

AgentLedger is an earned-authority layer for individuals and companies that want AI agents to complete real work and make bounded USDC payments. A new agent starts with a small task-bound cap, recorded work can support a human-approved increase, and a violation triggers STOP plus an enforceable reduction.

> **Public Mainnet status (2026-10-04): NOT READY.** The deployed V1 contract remains a controlled, read-only reference because its operational-agent/payer model is not safe for public multi-user self-custody. `MandateGraphV2` adds ERC-8004-owner-bound tasks, task-owner USDC payment, NFT-transfer invalidation, and two-wallet isolation. Mainnet writes stay disabled until a real V2 Arc Testnet lifecycle succeeds and a new Mainnet deployment is explicitly approved. See [`docs/PUBLIC_MAINNET_SECURITY_REVIEW.md`](docs/PUBLIC_MAINNET_SECURITY_REVIEW.md).

**AI proposes. Humans approve progression. AgentLedger enforces.** Gemini may propose a plan. ERC-8004 provides portable identity and external reputation or validation inputs. The AgentLedger contract—not ERC-8004—enforces budgets, Authority caps, scope, delegation, replay protection, STOP, and payment rejection.

## Public links

- Live app: <https://agentledger-livid.vercel.app/>
- Demo video: <https://youtu.be/aXnjAd3mFsE>
- Repository: <https://github.com/noboru59631/agentledger>
- Builder profile: <https://x.com/noboru59631>

## Current status

The repository includes an experimental, unaudited Solidity contract candidate, a public live app, a real Gemini-backed orchestration route, and a read-only Arc Mainnet evidence surface. The reviewed ERC-8004/Authority candidate is deployed on Arc Mainnet at `0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e`, where a controlled demonstration completed the earned-authority lifecycle with agentId `1395`. The recipient was a separately controlled demo wallet; this is not evidence of an independent vendor relationship or service delivery.

The three product surfaces are intentionally separate:

| Surface | What it demonstrates | What it does not do |
| --- | --- | --- |
| Illustrative Simulation | Local fixture state for task, mandate, payment lineage, and revoke/blocked retry | Does not read from Arc or use a wallet |
| AI Orchestrated Demo | Real Gemini proposal when configured, followed by deterministic budget/scope/STOP checks; shows `GEMINI PLAN · POLICY APPROVED` for an accepted live plan | Simulates service costs and never authorizes, settles, or writes to Arc |
| Arc Mainnet Read-only Mode | Injected-wallet connection plus chain, address, and USDC balance reads; controlled PoC Explorer evidence | Cannot create, delegate, approve, pay, revoke, deploy, or broadcast |

The Arc Mainnet read-only surface documents the controlled PoC without exposing transaction controls. Mainnet broadcast remains disabled in repository automation. `npm run lifecycle:arc-mainnet:preflight` performs only RPC reads and local artifact checks, writes `docs/MAINNET_AUTHORITY_PREFLIGHT.json`, and never reads a keystore or asks for a password. It cannot overwrite the completed lifecycle evidence.

## Controlled Mainnet PoC result

**Status: PASS.** The Arc Microgrants PoC is intentionally separate from a production launch. Arc Mainnet recorded `Trainee → small payment → work proof → human-approved Promotion → larger payment → violation/STOP → Demotion → remediation/reinstatement → AuthorityCapExceeded simulation`.

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

**Controlled PoC status: PASS.** Contract: [`0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e`](https://explorer.arc.io/address/0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e) on Arc Mainnet, chain ID `5042`, using official USDC and ERC-8004 Identity Registry addresses. [Sourcify verification](https://sourcify.dev/server/v2/contract/5042/0xdc321eb50cff0239a2c43532ecc8b0c41d969a9e) reports exact creation and runtime matches. Mainnet agentId `1395` is separate from Testnet agentId `897002`.

- Identity registration: [transaction](https://explorer.arc.io/tx/0xf611588bdbcb232d007c0b8d3b559409d51b88acf2ec3ab240486f3ca69fb39a)
- Candidate deployment: [transaction](https://explorer.arc.io/tx/0x24c2f75b9db21297c92c1e317383a866d074112a9c684eb520228a87baadb5d4)
- Task and delegation: [task](https://explorer.arc.io/tx/0xf2d21736f5f80a3316ca5abe7f6515897b48929579c79d687135b090a4527176), [delegation](https://explorer.arc.io/tx/0x3aef9c43d4a96fba54c82312386fcefbb6d6d5da8a0756739f98042c86a046d2)
- Small payment and work proof: [0.005 USDC payment](https://explorer.arc.io/tx/0xc3b12fe6981c8bfb9e5c8ae9677a4083a7db9c3b41fa1d3e2abd985e953d9956), [work proof](https://explorer.arc.io/tx/0x4f95c1fda801598a6b0a635000f0c22b0f3474cad189108bae8a2408a8b8f440)
- Authority increase and larger payment: [Promotion to 0.05 USDC](https://explorer.arc.io/tx/0x0a492d04a14cf638dfb0bc7638ba4557307fbe3f2ee27ffd328924dbaa0be8fc), [0.02 USDC payment](https://explorer.arc.io/tx/0x8b487174fccac75481fff4aadb87e90cc13484ea6b6ef9da7bed3f095d227009)
- Authority reduction and remediation: [STOP/Demotion to 0.025 USDC](https://explorer.arc.io/tx/0xa0110d645f957e1c7c1e0d5e9db7a56f808ae51d669a388ee48a4bfe5ed98e17), [reinstatement](https://explorer.arc.io/tx/0x51dbfdf95cb62e891eb8bbc1c22e737544e59dbca5ce9d71a3351aca0543a24b)
- Over-cap rejection: a `0.026 USDC` `eth_call` reverted with selector `0xe5bbd38c`, decoded as `AuthorityCapExceeded()`. No failed transaction was broadcast and no gas was spent on the rejection.
- Totals: `0.025000 USDC` executed payment, `0.08705870 USDC` receipt-derived fees across 13 successful transactions, and zero remaining allowance.

The recipient was a separately controlled demo wallet, not a verified vendor. The evidence demonstrates contract enforcement, not service delivery or output quality. Outcome hashes are caller-supplied lineage data. Full transaction hashes, calldata, state checks, fees, and rejection output are in [`docs/MAINNET_AUTHORITY_EVIDENCE.json`](docs/MAINNET_AUTHORITY_EVIDENCE.json).

The prior Mainnet contract at [`0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da`](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da) is retained only as archived legacy evidence and was not used for this lifecycle.

## Arc Testnet audit evidence

**ERC-8004/Authority candidate status: deployed and lifecycle verified on Arc Testnet.** Contract: [`0x8135c6E750E240FB352ee6701F2976fF8BA63ea3`](https://testnet.arcscan.app/address/0x8135c6E750E240FB352ee6701F2976fF8BA63ea3), bound to official Identity Registry `0x8004A818BFB912233c491871b3d84c89A494BD9e` and agentId `897002`.

The verified path covered identity registration, candidate deployment, Trainee registration, task/delegation, 0.01 USDC payment, payment-bound work proof, human-approved promotion and Authority increase, 0.02 USDC payment, violation/demotion with STOP and Authority reduction, explicit remediation/reinstatement, and a read-only rejection above the reduced cap. All 12 submitted transactions succeeded; the final over-cap call reverted with `AuthorityCapExceeded`. Full hashes and independently checked final state are in [`docs/TESTNET_EVIDENCE.json`](docs/TESTNET_EVIDENCE.json).

### V2 Testnet self-custody verification

**Status: PASS on Arc Testnet.** `MandateGraphV2` is deployed at [`0x3757ac538e8416388be609c0ca5543abe6072101`](https://testnet.arcscan.app/address/0x3757ac538e8416388be609c0ca5543abe6072101). The deployed runtime is 12,377 bytes, its normalized hash is `0xc546ab56c555c9d661c10795752f51457e7226fde6af9d1c3bbd7ce1395e2689`, and it matches the local artifact.

Wallet A (`0x03607de69C487BcC460eaD7C4Bdfd25805658b75`, Agent `897002`) and Wallet B (`0x5e22d5E018ba54f257917527Ad9FC77094919414`, Agent `897006`) completed the live two-wallet lifecycle. Authority moved from `0.01` to `0.05` USDC after an owner-signed promotion, then down to `0.025` USDC after STOP/demotion and stayed reduced after reinstatement. The run executed `0.025` USDC in payments, consumed `0.141374691947062374` in receipt-derived native fees, submitted 16 successful transactions, and broadcast zero intentionally failing transactions.

Read-only simulations proved cross-user isolation for administration, task, payment, work-proof, and delegation actions. A dedicated Agent B NFT transfer proved that old-owner administration and its old task freeze after transfer, new-owner administration follows `ownerOf`, and ownership can be safely restored. The final allowance is zero, both Agent NFTs are back with their original wallets, and a `0.026` USDC over-cap payment was rejected with `AuthorityCapExceeded` through `eth_call` only. Full transaction links, calldata, revert data, state transitions, bytecode checks, and fee totals are in [`docs/TESTNET_V2_SELF_CUSTODY_EVIDENCE.json`](docs/TESTNET_V2_SELF_CUSTODY_EVIDENCE.json).

The Testnet runner remains resumable and requires two encrypted Foundry keystores plus an explicit `ARC_TESTNET_V2_ONLY` broadcast confirmation. It performs read-only chain, sender, recipient, registry, USDC, nonce, balance, allowance, simulation, and bytecode checks before every transaction; the helper `scripts/run-arc-testnet-v2-phase.ps1` prompts for each keystore password without printing or saving it. **Public interactive Mainnet remains NOT READY, production Mainnet remains NO-GO, and Mainnet writes remain locked until a separate V2 deployment is explicitly approved and verified.**

The read-only V2 Mainnet deployment preparation is recorded in [`docs/MAINNET_V2_DEPLOYMENT_PLAN.json`](docs/MAINNET_V2_DEPLOYMENT_PLAN.json). It pins the intended bytecode and constructor configuration, checks the official Mainnet contracts, estimates gas and fees, and cannot sign or broadcast a transaction.

### V2 Mainnet deployment status

**Deployment and source verification: PASS; controlled smoke lifecycle: pending; public writes: locked.** `MandateGraphV2` was explicitly approved and deployed at [`0x015099f831c247460b467154c73028804Ea38a10`](https://explorer.arc.io/address/0x015099f831c247460b467154c73028804Ea38a10). The successful deployment transaction used the reviewed init code and nonce, the deployed normalized runtime matches the local artifact, and the immutable USDC and official Identity Registry configuration match the deployment plan. [Sourcify verification](https://sourcify.dev/server/v2/contract/5042/0x015099f831c247460b467154c73028804ea38a10) reports exact creation and runtime matches. Receipt, bytecode, configuration, source-verification, and fee evidence are stored separately in [`docs/MAINNET_V2_DEPLOYMENT_EVIDENCE.json`](docs/MAINNET_V2_DEPLOYMENT_EVIDENCE.json).

`PUBLIC_CONTRACT_ADDRESS` remains `null`, so the browser cannot submit Mainnet writes. A separately approved minimal Mainnet smoke lifecycle, zero-residual-allowance verification, and a separate UI-unlock approval remain required. Production Mainnet remains unaudited and NO-GO.

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

- The deployed ERC-8004/Authority candidate is experimental and unaudited; production Mainnet remains NO-GO.
- Mainnet writes are disabled in the browser and repository automation; controlled PoC transactions remain linked as evidence.
- AI demo service costs are simulated; the AI route never writes to the chain.
- The mainnet recipient was a controlled demo wallet, not a verified vendor.
- Outcome hashes are caller-supplied lineage, not independent proof of service delivery.
- Validation Registry is not an MVP dependency; Reputation Registry feedback remains external to AgentLedger's performance-to-Authority conversion.
- The live app separates fixture simulation, AI orchestration, read-only Mainnet evidence, and the controlled onchain lifecycle.

## Remaining hardening / Roadmap

- Independent contract review, broader adversarial/fuzz testing, and formal verification where appropriate.
- Production-grade signer/account abstraction and operational controls.
- Durable event indexing and independently obtained service evidence.
- Canonical request signing, vendor identity/dispute flows, refunds, and safer production wallet architecture.
- Confirm current Arc program eligibility and submit through the official Arc Microgrants form.

General Mainnet deployment/broadcast remains disabled in repository automation. The V2 deployment used a one-transaction, hash-pinned local wrapper after explicit approval and stopped after deployment; public writes and the controlled V2 Mainnet smoke lifecycle remain locked. Production Mainnet remains NO-GO pending independent review and the remaining hardening work.

## Primary references

- [Arc documentation index](https://docs.arc.io/llms.txt)
- [Arc: Connect to Arc](https://docs.arc.io/arc/references/connect-to-arc)
- [Arc: Contract addresses](https://docs.arc.io/arc/references/contract-addresses)
- [Circle Arc mainnet announcement](https://www.circle.com/pressroom/circle-launches-arc-mainnet-an-economic-operating-system-for-the-internet)
- [Arc Microgrants requirements](https://community.arc.io/public/events/arc-microgrants-f8tijfhyq)
