# Public Mainnet self-custody security review

Date: 2026-10-05 JST
Scope: `MandateGraphV2`, Arc Mainnet deployment `0x015099f831c247460b467154c73028804Ea38a10`, controlled smoke evidence, and the public wallet flow.

## Decision

**Public interactive Mainnet dApp: READY for an experimental small-amount demo.**

**Production Mainnet custody: NO-GO.** The contracts remain unaudited and the demo does not provide independent offchain service attestation, durable indexing, account recovery, production monitoring, or formal verification.

The V1 Mainnet contract remains a read-only reference because its operational-agent/payer model is not suitable for public multi-user self-custody. Public writes target only V2.

## V2 security model

- Profiles are keyed by ERC-8004 `agentId`.
- Registration, operational-address updates, promotion, demotion/STOP, and reinstatement follow current `ownerOf(agentId)`.
- Task IDs are namespaced by task owner and salt.
- Only the ERC-8004 owner can create a root task for an Agent.
- Every delegated Agent must share the task owner.
- The task owner is always the USDC payer.
- Payment IDs bind chain, contract, task, mandate, payer, recipient, amount, scope, resource, expiry, and nonce.
- Ownership transfer invalidates old-owner task authority.
- State commits before USDC transfer and every write entry point uses the reentrancy guard.
- Promotion requires fresh payment-bound proof plus an owner signature.
- Demotion halves Authority and activates STOP; reinstatement does not restore the prior cap.

## Mainnet verification

- Runtime matches the reviewed local artifact after immutable normalization.
- Sourcify reports `exact_match` for creation and runtime, match ID `54611987`.
- Controlled lifecycle: 10 successful transactions, 0 failed broadcasts.
- Payment total: `0.025` USDC; final allowance: `0`.
- Authority: `0.01 → 0.05 → 0.025` USDC per payment.
- STOP/Demotion and reinstatement preserve the reduced cap.
- `0.026` USDC over-cap request reverted with `AuthorityCapExceeded()` by `eth_call` only.
- Wallet B administration, task, payment, proof, and delegation attempts reverted with the expected owner/operator errors by `eth_call` only.

Evidence: [`MAINNET_V2_SELF_CUSTODY_EVIDENCE.json`](MAINNET_V2_SELF_CUSTODY_EVIDENCE.json).

## Browser boundary

- Uses an injected wallet; no signer material is embedded or transmitted.
- Requires Arc Mainnet chain ID `5042`.
- Adds an Agent to **My Agents** only when `ownerOf` matches the connected wallet.
- Simulates every contract or USDC write before requesting a wallet signature.
- Uses exact approval amounts and exposes allowance revoke-to-zero.
- Shows pending/success/revert status and Arc Explorer links.
- Keeps V1 Agent #1395 in a separate read-only reference panel.

## Validation

- Foundry: 63/63 tests, fuzz runs 256.
- V1 invariants: 8,192 calls, 0 reverts.
- V2 invariants: 8,192 calls, 0 reverts.
- Node: 66/66 tests.
- Testnet V2: two-wallet lifecycle, ownership transfer freeze/recovery, exact allowance, and isolation PASS.

## Remaining risk

Independent audit, formal methods, canonical offchain evidence, event indexing, production wallet/account abstraction, monitoring, recovery, and operational controls remain required before production custody.
