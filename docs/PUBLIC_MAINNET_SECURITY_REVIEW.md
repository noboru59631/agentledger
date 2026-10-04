# Public Mainnet self-custody security review

Date: 2026-10-04  
Scope: PR #29 at `dd1972e8fe1364c312ece2a07ec39bece5825675`, controlled Mainnet contract `0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e`, and the proposed public multi-user flow.

## Decision

**Existing Mainnet contract: NOT SAFE for public multi-user use.**

The deployed contract remains valid evidence for the controlled single-wallet PoC, but it must not be exposed as a public write target. The browser keeps it in a separate read-only Reference Demo panel.

**Public interactive Mainnet dApp: NOT READY.**

`MandateGraphV2` fixes the identified ownership and payer boundaries and passes local unit, fuzz, invariant, and browser-policy checks. Its Mainnet address is intentionally unset, so every public write remains disabled. A real Arc Testnet broadcast is still required before requesting approval for a new Mainnet deployment.

Production Mainnet remains **NO-GO** while the contracts are unaudited.

## Why V1 cannot be made safe with UI restrictions

| Area | V1 behavior | Public-use finding |
| --- | --- | --- |
| ERC-8004 ownership | `ownerOf(agentId)` gates promotion, demotion, and reinstatement | Administration follows an NFT transfer, but execution does not |
| Agent binding | Profile is keyed by a fixed operational address; `agentId` is permanently bound to it | A transferred identity inherits the old operational address, and the new owner cannot rebind it |
| Payer | `executePayment` calls `transferFrom(msg.sender, recipient, amount)` | Funds come from the operational caller, not the current ERC-8004 owner or task owner |
| Multiple owned Agents | One active profile can exist per operational address | A wallet cannot safely use the same self-custodial address for multiple Agent identities |
| Task isolation | Anyone may create a root task for any registered Agent address | It cannot guarantee that every public task belongs to the connected Agent owner |
| NFT transfer | New owner gains administration over the existing profile | Old tasks and the old operational address are not automatically invalidated by the transfer |
| UI mitigation | A UI could hide foreign Agent addresses | Direct contract calls would bypass that restriction, so this is not a security boundary |

V1 retains useful protections: dynamic owner checks for administration, unique `agentId` registration, monotonic delegation, reservation accounting, replay protection, non-reentrancy, STOP propagation, and checked USDC return values. Those protections are not enough to satisfy public self-custody.

## V2 security model

`contracts/MandateGraphV2.sol` changes the trust boundary from operational-address ownership to ERC-8004 `agentId` ownership.

- Profiles are keyed by `agentId`, so one wallet can own and use multiple Agents.
- Registration, operational-address updates, promotion, demotion/STOP, and reinstatement use the current `ownerOf(agentId)`.
- Task IDs are namespaced as `keccak256(owner, taskSalt)`, removing cross-wallet task-ID front-running collisions.
- Only the ERC-8004 owner can create a root task for an Agent.
- Every delegated Agent in a task must have the same current ERC-8004 owner as the task owner.
- The task owner is the payer. USDC always uses `transferFrom(task.owner, recipient, amount)`.
- The task owner or the explicitly registered operational Agent can execute bounded work, but neither can change ownership administration rules.
- A transfer of any Agent identity in the mandate ancestry immediately makes the old task unauthorized. Old tasks cannot spend the previous owner’s remaining allowance.
- The new NFT owner receives administration rights and can update the operational address, but must create a new task before spending.
- Payment IDs bind `chainid`, contract address, task, mandate, payer, recipient, amount, service class, resource, expiry, and nonce.
- State is committed before the USDC call and all write functions use the reentrancy guard; a failed transfer rolls the entire transaction back.
- Promotion remains owner-signed and work-proof-gated. Demotion halves the cap and activates STOP. Reinstatement clears STOP without restoring the prior cap.

## Two-wallet isolation

The V2 test suite proves these boundaries with Alice and Bob identities, operational addresses, balances, and allowances:

- Alice cannot register, administer, update, or create a task for Bob’s Agent.
- Alice cannot delegate her task to Bob’s Agent.
- Bob cannot execute Alice’s mandate or spend Alice’s approved USDC.
- Bob’s own allowance cannot substitute for Alice’s task-owner allowance.
- An approved operational Agent spends only the task owner’s bounded allowance.
- An ERC-8004 transfer freezes the old owner’s tasks before any further transfer.
- The new owner receives administration and can replace the operational address.

## Verification completed

- Existing Foundry suite retained.
- V2 unit/access-control/isolation suite: 11 tests.
- V2 fuzz: 256 runs.
- V2 invariants: 128 runs × 64 depth = 8,192 calls with zero reverts.
- V2 replay and cross-function reentrancy regression tests pass.
- Node/browser policy suite: 46 tests.
- Solidity build succeeds.
- Browser visual QA confirms the exact hero copy, owner-only Agent verification, Current Authority hero, exact approval/revoke controls, simulation-first writes, explicit promotion/STOP/reinstatement, and separate #1395 Reference Demo.
- The #1395 panel reads live Arc Mainnet state and reports Trainee, 0.025 USDC authority, one completed work, one violation, STOP cleared after remediation, and mandate #2 authorized at the reduced cap.

## Arc Testnet status

The no-broadcast Arc Testnet fork reached official ERC-8004 ownership verification, official USDC balance verification, V2 deployment, Agent registration, task creation, and exact approval. Foundry’s local fork then failed while emulating Arc’s USDC blocklist precompile (`0x1800…0001`) with a local `StackUnderflow`. This is a fork-EVM limitation, not an observed Arc Testnet transaction revert.

The reproducible lifecycle is in `script/PublicLifecycleV2.s.sol`. It covers deploy → register → task → exact approve → small payment → proof → promotion → larger payment → STOP/demotion → reinstatement at reduced cap → over-cap simulation only → final allowance zero.

No real V2 Testnet transaction was broadcast because this environment has no unlocked signer variables, and the task explicitly forbids requesting a private key, seed, or keystore password. The next permitted step is wallet/secure-signer approval of the Arc Testnet lifecycle. Mainnet deployment must not begin until that lifecycle succeeds and its receipts are recorded.

## Mainnet deployment gate

Before requesting Mainnet approval:

1. Broadcast `PublicLifecycleV2Script` on Arc Testnet with an existing self-custodial signer.
2. Record deployment and lifecycle receipts in `docs/TESTNET_V2_EVIDENCE.json`.
3. Re-read final Agent state, allowance, payer and recipient balance deltas, and the over-cap error selector.
4. Verify V2 creation/runtime bytecode.
5. Re-run Foundry, Node, build, and diff checks.

Only then set `PUBLIC_CONTRACT_ADDRESS` in `app/live-policy.mjs` and request explicit approval for the new Arc Mainnet deployment/broadcast.
