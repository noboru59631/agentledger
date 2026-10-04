# AgentLedger

> **Don’t give a new AI agent the keys to your wallet. Let it earn authority.**

AgentLedger is a self-custodial authority layer for autonomous AI workers on Arc. A new agent starts with a small, contract-enforced USDC limit. Proven work can make it eligible for a human-approved promotion. A violation triggers STOP and reduces its authority.

[**Open the public Arc Mainnet dApp**](https://agentledger-livid.vercel.app/) · [V2 contract](https://explorer.arc.io/address/0x015099f831c247460b467154c73028804Ea38a10) · [Sourcify exact match](https://sourcify.dev/server/v2/contract/5042/0x015099f831c247460b467154c73028804ea38a10)

**Public interactive Mainnet dApp: READY.** The dApp is experimental and unaudited, accepts only wallet-signed actions, and is intended for small demo amounts. **Production custody: NO-GO.**

## Why it exists

AI agents increasingly need economic authority to buy data, call paid APIs, coordinate specialists, and complete real work. The two common choices are both poor:

- Unlimited wallet access gives a new agent too much authority too early.
- Requiring a human signature for every action removes the autonomy that makes an agent useful.

AgentLedger provides a third option: **Work → Proof → Authority.** A human bounds the task and initial authority. The contract enforces the cap. Completed, payment-bound work can make the agent promotion-eligible, but only the ERC-8004 Agent owner can approve a larger cap. Violations reduce authority and activate STOP.

It is designed for individuals and companies delegating real economic work to AI agents while retaining wallet custody and policy control.

## Try it in five steps

1. Open the [public dApp](https://agentledger-livid.vercel.app/) and connect an injected EVM wallet.
2. Switch or add **Arc Mainnet (chain ID 5042)** when prompted.
3. Enter an ERC-8004 Agent ID owned by the connected wallet; `ownerOf` must match before it appears under **My Agents**.
4. Register the Agent if needed, create a bounded task, approve only the exact payment amount, and simulate before signing.
5. Execute a small payment, record work proof, then inspect promotion, STOP/demotion, reinstatement, allowance revoke, and the read-only over-cap test.

Every write is simulated first and then confirmed in the connected wallet. AgentLedger never receives a private key or seed phrase.

## Live deployments

| Network | Chain ID | Contract | Role |
|---|---:|---|---|
| Arc Mainnet | `5042` | [`MandateGraphV2` `0x015099…38a10`](https://explorer.arc.io/address/0x015099f831c247460b467154c73028804Ea38a10) | Current public self-custodial contract |
| Arc Testnet | `5042002` | [`MandateGraphV2` `0x3757…72101`](https://testnet.arcscan.app/address/0x3757ac538e8416388be609c0ca5543abe6072101) | Two-wallet lifecycle and ownership-transfer verification |
| Arc Mainnet | `5042` | [`MandateGraph` V1 `0xdC321…969A9e`](https://explorer.arc.io/address/0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e) | Legacy controlled reference demo; read-only in the UI |

Pinned Arc Mainnet dependencies:

- USDC: [`0x3600000000000000000000000000000000000000`](https://explorer.arc.io/address/0x3600000000000000000000000000000000000000)
- ERC-8004 Identity Registry: [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://explorer.arc.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)
- ERC-8004 Reputation Registry: [`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`](https://explorer.arc.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63)
- ERC-8004 Validation Registry: [`0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58`](https://explorer.arc.io/address/0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58)

## Verified Arc Mainnet lifecycle

The V2 smoke lifecycle ran on Arc Mainnet on October 5, 2026 JST using ERC-8004 Agent `#1395`. It sent 10 successful transactions, broadcast no failed transactions, paid exactly `0.025` USDC, spent `0.02803583401791` native USDC on receipt-derived fees, and ended with allowance `0`.

| Step | Result | Transaction |
|---|---|---|
| Register Agent #1395 at 0.01 USDC Authority | PASS | [`0x3d888c…b1369`](https://explorer.arc.io/tx/0x3d888ca1482d1f592ebf9faf29edc29c15e03cabf6f890761e67719ed65b1369) |
| Create wallet-owned task | PASS | [`0xba222a…564b6`](https://explorer.arc.io/tx/0xba222a896744a8609e0c6be202e51e69984c5cfbb9930a11e9337076a10564b6) |
| Delegate a narrower child mandate | PASS | [`0x3245b0…83d50`](https://explorer.arc.io/tx/0x3245b0cb7ae47b2b6e44fcde852f7976166db41765aefb222d893ad0d5c83d50) |
| Approve exactly 0.025 USDC | PASS | [`0xb1802a…4e665`](https://explorer.arc.io/tx/0xb1802ab90945e0210bcdf3cdd982cb081ac4e71de2dc3ceb8e93410c4e24e665) |
| Execute 0.005 USDC payment | PASS | [`0x785ea9…b8f20`](https://explorer.arc.io/tx/0x785ea926de8b7addcb5443ce2b2354bb681c0aea72b0ed330e17d030ffdb8f20) |
| Record payment-bound work proof | PASS | [`0xd1f8aa…82ce5`](https://explorer.arc.io/tx/0xd1f8aa095797c7ce1c04f3fa4073aae277e6c298c2be05fb5dc69dc96ed82ce5) |
| Owner-approved promotion, Authority 0.01 → 0.05 USDC | PASS | [`0xb4bb0d…c80db`](https://explorer.arc.io/tx/0xb4bb0d25ee84924258828debec85c8fe364a7250e7c45f646acb8615709c80db) |
| Execute 0.020 USDC payment | PASS | [`0xb62b20…280f0`](https://explorer.arc.io/tx/0xb62b204513d6fb83046e51b9de84d2d216f732599c0a798b2f4ebb51cf3280f0) |
| STOP/demotion, Authority 0.05 → 0.025 USDC | PASS | [`0x1ffad0…fb433`](https://explorer.arc.io/tx/0x1ffad00314e2714a66de6bdee35530a95d2327d2fda8bc57886835f3ae1fb433) |
| Reinstate at the reduced cap | PASS | [`0x37c72e…d2e4e`](https://explorer.arc.io/tx/0x37c72e097b1e6ae1321712b8fd710120b24b26236e87b5dfec10b46e991d2e4e) |

The final onchain Agent state is Trainee, Authority `0.025` USDC per payment, completed works `1`, violations `1`, STOP cleared after remediation, and allowance `0`. A `0.026` USDC request was rejected with `AuthorityCapExceeded()` through `eth_call`; no failing transaction was sent.

Full calldata, receipts, transaction hashes, fee calculations, Authority transitions, read-only isolation reverts, and final state are in [`docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json`](docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json).

## Self-custody and multi-user isolation

`MandateGraphV2` binds every registered Agent to the current owner of its official ERC-8004 Identity NFT:

- Only `ownerOf(agentId)` can register, promote, demote, reinstate, or change the operational Agent.
- A task is owned by the wallet that creates it and is namespaced by that wallet.
- Payments pull USDC from the task owner, never from a shared backend or protocol wallet.
- The connected wallet approves the exact payment amount and can revoke any remainder to zero.
- An operational Agent may act only inside the task owner’s existing mandate and cap.
- ERC-8004 ownership transfer immediately freezes tasks created by the former owner.

Mainnet read-only simulations proved that Wallet B cannot administer Agent #1395, create a task for it, revoke Wallet A’s task, execute its payment, record its work proof, or delegate under its mandate. Each call reverted with the expected owner or operator error and no Wallet B transaction was broadcast.

## Architecture

```text
Owner wallet
   │ owns
   ▼
ERC-8004 Agent NFT ── identity / ownership / reputation input
   │
   ▼
MandateGraphV2 ── task budget ── mandate / delegation ── Authority cap
   │                                                        │
   └──────── contract-enforced checks ──────────────────────┘
                            │
                            ▼
                   owner-funded USDC payment
```

The owner defines policy and signs promotion or policy changes. The smart contract enforces task ownership, narrowing delegation, budget reservations, expiry, recipient and scope constraints, payment replay protection, Authority caps, STOP, and ownership-transfer invalidation.

ERC-8004 provides portable Agent identity plus reputation and validation inputs. ERC-8004 itself does **not** block payments. AgentLedger is the enforcement and economic-authority layer.

## Security properties and tests

- Foundry: **63/63 tests PASS** with fuzz runs `>=256`.
- V1 invariant suite: **8,192 calls, 0 reverts**.
- V2 invariant suite: **8,192 calls, 0 reverts**.
- Node: **66/66 tests PASS**.
- Coverage includes reentrancy, replay, transfer failure rollback, reservation conservation, nested delegation, scope/recipient/expiry attenuation, exact approvals, ownership transfer, payment-bound proof, promotion, STOP/demotion, reinstatement, and Wallet A/B isolation.
- V2 deployment runtime matches the local artifact after compiler-reported immutable normalization.
- Sourcify reports exact creation and runtime matches, match ID `54611987`.

The browser imports no signer material. Every write uses an injected wallet, checks Arc Mainnet, validates ERC-8004 ownership, runs `simulateContract`, waits for the receipt, and links the result to Arc Explorer.

## Local development

Prerequisites: Node.js 20+ and Foundry with Solidity `0.8.28`.

```bash
npm ci
forge build
forge test -vvv --fuzz-runs 256
npm test
npm start
```

Open `http://localhost:4173`.

Read-only V2 Mainnet smoke verification:

```bash
npm run smoke:arc-mainnet:v2:verify
```

The Mainnet smoke runner is hard-pinned to chain `5042`, the deployed V2 address, official USDC and Identity Registry addresses, a `0.025` USDC payment total, a gas-price ceiling, and a lifecycle fee ceiling. It cannot deploy a contract and refuses duplicate broadcasts.

## Evidence

- [`docs/MAINNET_V2_DEPLOYMENT_EVIDENCE.json`](docs/MAINNET_V2_DEPLOYMENT_EVIDENCE.json) — deployment receipt, constructor configuration, runtime match, and Sourcify result.
- [`docs/MAINNET_V2_SMOKE_PREFLIGHT.json`](docs/MAINNET_V2_SMOKE_PREFLIGHT.json) — read-only chain, signer, balance, allowance, initial-state, bytecode, and source-verification checks.
- [`docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json`](docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json) — complete Mainnet V2 lifecycle, isolation simulations, receipts, fees, and final state.
- [`docs/TESTNET_V2_SELF_CUSTODY_EVIDENCE.json`](docs/TESTNET_V2_SELF_CUSTODY_EVIDENCE.json) — two-wallet Testnet lifecycle and ERC-8004 ownership-transfer recovery.
- [`docs/MAINNET_AUTHORITY_EVIDENCE.json`](docs/MAINNET_AUTHORITY_EVIDENCE.json) — legacy V1 controlled reference lifecycle.

## Limitations and safety warning

AgentLedger is an unaudited experimental proof of concept. Use only small demo amounts. It is not production custody software, does not attest to the quality of offchain work, and does not replace independent security review, operational controls, monitoring, or legal/compliance analysis.

The Mainnet recipient is a separately controlled demo wallet, not an independent vendor. Outcome hashes are caller-supplied lineage data, not independent proof that an offchain service was delivered correctly.

**Public interactive demo: READY. Production Mainnet custody: NO-GO.**

## Legacy V1 reference

The V1 Arc Mainnet contract at [`0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e`](https://explorer.arc.io/address/0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e) and Agent `#1395` remain visible as a read-only reference. That controlled PoC proved the Authority story but used an operational-agent/payer model that is not appropriate for public multi-user self-custody. V1 is **not** the current public write contract.

## Arc Microgrants story

AgentLedger is deployed and working on Arc Mainnet, uses official Arc USDC and ERC-8004 infrastructure, exposes a public repository and login-free dApp, and records a real `0.025` USDC economic lifecycle. The demo shows the complete product thesis onchain: start small, bind payment to work, let a human approve increased Authority, reduce Authority after a violation, and reject spending above the new cap.
