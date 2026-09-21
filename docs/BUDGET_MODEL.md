# Delegated Budget Accounting

## Accounting model

Each mandate is a bounded allocation. A delegation immediately reserves its full budget from the parent's unspent, unreserved authority. The parent cannot spend that reservation. Allocations are non-transferable between siblings unless the original child mandate is revoked and a fresh delegation is created.

For each mandate `m`:

```text
grantedBudget(m)       = the mandate's fixed budget
spentDirectly(m)       = payments made by this mandate's agent
spentByDescendants(m)  = payments made under child mandates, at every depth
spent(m)               = spentDirectly(m) + spentByDescendants(m)
reservedToChildren(m)  = sum of each active child's unspent, unreserved budget
availableBudget(m)     = grantedBudget(m) - spent(m) - reservedToChildren(m)
committed(m)           = spent(m) + reservedToChildren(m)
```

All quantities are in the token's smallest unit. The contract stores cumulative `spent` on each node along a payment's ancestry and stores the remaining reservation on each ancestor. On a descendant payment of `x`, `spent` increases by `x` on the paying mandate and each ancestor, while each ancestor's reservation decreases by `x`. This converts reserved authority into realized spend without double-charging: `committed` stays constant at each ancestor. The paying mandate consumes its own budget directly and does not reserve against itself.

Delegation of `x` is allowed only when `x <= availableBudget(parent)`. It increases `reservedToChildren(parent)` by `x`; creating the child does not change any other ancestor's reservation because that authority is already covered by the parent's allocation.

## Revocation and reuse

A mandate can be revoked only after all its direct children have been revoked. This leaf-first rule makes subtree release explicit and prevents an ancestor reservation from being released while a descendant remains live. Revoking a child releases only `grantedBudget(child) - spent(child)` to its parent. The spent part remains spent at every ancestor and can never become reusable. After revocation the parent may delegate the released remainder again, subject to its available budget. Task/root revocation makes every descendant unusable; it does not erase or release accounting history.

Expired mandates remain reserved until explicitly revoked. This avoids silently changing accounting based on wall-clock time and lets the agent reclaim an expired child mandate's unused balance explicitly.

## Invariants

For every mandate `m`:

```text
0 <= spent(m) <= grantedBudget(m)
0 <= reservedToChildren(m) <= grantedBudget(m) - spent(m)
committed(m) <= grantedBudget(m)
availableBudget(m) >= 0
```

For every active child `c` of `m`, its unspent/unreserved commitment is covered by the parent's reservation; ancestor accounting counts that authority once, at the ancestor's child allocation. A payment of `x` requires every ancestor to have a reservation of at least `x`. Total task spend never exceeds the root grant. Depth, expiry, service scope, and fixed-recipient restrictions only narrow with delegation.

## Example

Root has 100 units. It delegates 60 to child A and 20 to child B, leaving 20 available. A delegates 40 to grandchild G; A has 20 available and root still has 20 available because the 40 remains part of A's already-reserved 60. G spends 15: root, A, and G each record 15 spent; root's reservation to A falls from 60 to 45, and A's reservation to G falls from 40 to 25. Root's commitment remains 80 and its available balance remains 20. Revoking G releases 25 to A, leaving A with 45 committed (15 spent, 30 reserved for any other child) and does not restore the 15 spent. Revoking A after its other children are revoked releases its remaining unspent allocation to root.

## Edge cases

- Delegating the entire available balance is valid; the parent then has zero available for direct spending or sibling delegation.
- Zero-budget tasks, delegations, and payments are rejected. A one-unit allocation and a one-unit spend follow the same equations.
- Siblings cannot collectively reserve more than their parent's available balance.
- A parent's own payments are limited by `availableBudget`; descendant payments consume their existing reservations.
- Child revocation is leaf-first; attempting to revoke a mandate with active children reverts.
- Revocation never changes cumulative spend. Revoked mandates cannot pay or delegate.
- Task revocation blocks all descendants regardless of remaining budget.
- Nonce/payment replay protection and all authority attenuation checks apply independently of accounting.
