# Security

## Status

MandateGraph is experimental, unaudited software. It has not been deployed. The JavaScript demo is fixture-only and makes no chain calls. Do not use this contract to custody or authorize production funds.

## Controls in source

- Task owner is immutable; only the owner can revoke the task.
- Only a mandate's agent can delegate or revoke that mandate.
- Child budget is reserved from the parent's available authority; descendant spend converts ancestor reservations into cumulative spend exactly once.
- Delegation cannot extend expiry, widen service bitmap, widen a fixed recipient, or exceed bounded depth.
- A payment caller must be the mandate agent; request expiry, recipient, service scope, unique request ID, task budget, and each ancestor's available budget are checked.
- Revocation and expiry are validated over the full ancestry. Mandates are revoked leaf-first, releasing only unused reservation; spent authority remains spent.
- The payment ID is recomputed onchain from request fields, preventing callers from changing fields while reusing an arbitrary ID.
- Payment effects are committed before external token interaction; the transfer function is guarded against reentrancy.
- Zero-address or no-code USDC constructor inputs and empty outcome hashes are rejected.

## Known limits and risks

- This is not an audit. Foundry fuzz and invariant tests have been added but still require an executable Foundry run; Slither and independent review also remain outstanding.
- `outcomeHash` is caller-supplied and is not evidence that a vendor delivered anything.
- The contract's `IERC20` integration is conventional ERC-20 `transferFrom`; Arc-specific USDC behavior, 6-decimal token units versus 18-decimal native gas units, blocklist behavior, and transfer failure semantics need live documentation and test validation.
- Mandate ancestry checks are linear in depth. Root depth is capped at 32, which bounds but does not eliminate gas considerations.
- Direct agent-held USDC and allowances expose operational key and approval risk. A production smart-account or wallet-policy integration is needed.
- Token blocklisting, malicious tokens, compromised agent keys, owner-key loss, bad task metadata, false service claims, refunds, and vendor disputes are not resolved by this prototype.
- Contract may need additional hardening around task-root lookup, nonzero owner/recipient policy, event completeness, explicit payment receipt state, and exact Arc token interface before deployment.

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
- Fuzz/invariant checks for `spent + allocated <= budget` at every mandate, root/task spend equality, and total task spend <= task budget.

## Responsible use

Never commit `.env`, private keys, seed phrases, or funded wallet material. Deploy only after independent review, test deployment, exact chain/token verification, and an explicit human decision. Do not treat a local demo receipt as a real payment record.
