# Security

## Status

MandateGraph is experimental, unaudited software. It has not been deployed. The JavaScript demo is fixture-only and makes no chain calls. Do not use this contract to custody or authorize production funds.

## Controls in source

- Task owner is immutable; only the owner can revoke the task.
- Only a mandate's agent can delegate or revoke that mandate.
- Child budget is reserved from the parent's unspent and unallocated budget; as a child spends, its immediate parent's outstanding allocation is reduced by that amount.
- Delegation cannot extend expiry, widen service bitmap, widen a fixed recipient, or exceed bounded depth.
- A payment caller must be the mandate agent; request expiry, recipient, service scope, unique request ID, task budget, and each ancestor's available budget are checked.
- Revocation and expiry are validated over the full ancestry, including the task deadline.
- The payment ID is recomputed onchain from request fields, preventing callers from changing fields while reusing an arbitrary ID.
- Payment effects are committed before external token interaction; the transfer function is guarded against reentrancy.
- Zero-address or no-code USDC constructor inputs and empty outcome hashes are rejected.

## Known limits and risks

- This is not an audit. The local review added regression tests, but Foundry, Slither, fuzzing, and invariant testing were unavailable in the current environment.
- `outcomeHash` is caller-supplied and is not evidence that a vendor delivered anything.
- The contract's `IERC20` integration is conventional ERC-20 `transferFrom`; Arc-specific USDC behavior, 6-decimal token units versus 18-decimal native gas units, blocklist behavior, and transfer failure semantics need live documentation and test validation.
- Mandate ancestry checks are linear in depth. Root depth is capped at 32, which bounds but does not eliminate gas considerations.
- Direct agent-held USDC and allowances expose operational key and approval risk. A production smart-account or wallet-policy integration is needed.
- Token blocklisting, malicious tokens, compromised agent keys, owner-key loss, bad task metadata, false service claims, refunds, and vendor disputes are not resolved by this prototype.
- `createTask` accepts a zero recipient to indicate an unrestricted recipient; it does not currently reject a zero task owner (unreachable for ordinary externally-owned accounts, but possible for contract callers).
- There is no dedicated invariant harness, property-based fuzz suite, or malicious-token reentrancy test yet.

## Review findings addressed

- **Spent delegation reservation remained locked — fixed.** A child's payment was included in the immediate parent's `spent` and remained in `allocated`, double-counting that amount. The immediate parent's outstanding allocation now decreases as the child spends, while sibling reservations remain intact.
- **Child expiry could exceed task deadline — fixed.** Delegation now caps expiry at both parent expiry and task deadline.
- **Task deadline did not stop live authority — fixed.** Execution and `isAuthorized` now apply the task deadline throughout the ancestry.
- **Child's own allocation constrained its payment — fixed.** A child cannot pay against budget it has already delegated; ancestor checks retain descendant reservations while the paying node excludes its own reservation.

Foundry/Slither were not installed in the current workspace, so these edits still require the CI/toolchain validation recorded by the next workflow run. No independent third-party audit has been performed.

## Required test matrix before deployment

- Child budget exceeding parent available remainder; exhaustion at parent and child; multiple children reservations; payment after delegation.
- Expiry widening, stale request, expired ancestor, and task deadline enforcement.
- Service bitmap widening/invalid multi-bit payment; recipient widening and invalid recipient.
- Delegation depth exhaustion and maximum depth boundary.
- Wrong agent on delegate/revoke/pay; task-owner authorization; unknown IDs.
- Request ID field tampering, nonce replay, duplicate payment, and concurrent/reentrant token callback.
- Root revoke and subtree revoke; retry fails without mutating counters.
- False-return/reverting/no-code token; zero address; blocked sender/recipient behavior.
- Outcome hash empty/tampering and event/storage binding semantics.
- Fuzz/invariant checks for `spent + allocated <= budget` at every mandate and total task spend <= task budget.

## Responsible use

Never commit `.env`, private keys, seed phrases, or funded wallet material. Deploy only after independent review, test deployment, exact chain/token verification, and an explicit human decision. Do not treat a local demo receipt as a real payment record.
