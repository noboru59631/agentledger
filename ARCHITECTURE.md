# Architecture

## Product boundary

AgentLedger connects a human task to bounded agent authority, payment attempts, and outcome evidence. The repository has a local fixture simulation, a real Gemini proposal route with deterministic browser policy checks, a legacy Arc Mainnet demo/evidence surface, and a newer undeployed ERC-8004-aware authorization/settlement candidate. The AI demo does not settle; this audit performs no Mainnet writes.

```text
Human intent → task metadata hash → root mandate → delegated mandates
             → request-bound USDC transfer → outcome hash/event
```

## Components and current state

| Component | Intended responsibility | Current implementation |
| --- | --- | --- |
| Dashboard | Explain objective, budget, lineage, request checks, receipt, and revocation | Static HTML with three explicitly separated demo surfaces |
| AI planner | Propose structured multi-agent plans | Gemini-backed `/api/orchestrate`; deterministic policy decides approval; no settlement |
| Policy engine | Reproduce deterministic budget, scope, expiry, depth, and STOP checks | Browser policy modules; not a production SDK |
| MandateGraph | Store identity-bound career authority, enforce budget/scope/expiry/revocation/STOP, execute transfer | Legacy version deployed experimentally; current ERC-8004 candidate not deployed |
| USDC adapter | Configure Arc RPC/token and submit signed transactions | Wallet-connected live demo with explicit confirmation for each write |
| Evidence/indexing | Link chain tx, service evidence, and result | Not implemented; fixture hashes are not proof |

## Contract lifecycle

1. An ERC-8004 token owner binds one operational address to one valid Identity Registry `agentId`; current token ownership governs later promotion, demotion, and reinstatement.
2. A task owner records a metadata hash and creates a root mandate with a budget, deadline, service bitmap, and maximum delegation depth.
3. The root agent delegates budget reserved from its unspent/unallocated balance. Child expiry and service scope cannot widen, recipient restrictions remain fixed, and STOP blocks new assignments.
4. A payment ID must equal the onchain ABI-encoded hash of task ID, mandate ID, recipient, amount, service class, resource hash, request expiry, and nonce.
5. The contract checks the calling agent, Authority cap, payment expiry, recipient/scope, task budget, and every ancestor's revocation, STOP, expiry, and available budget.
6. It consumes the payment ID, updates accounting, and emits evidence before the USDC external call; a contract-wide reentrancy guard protects all state-changing entry points.
7. Successful payment outcomes can be recorded once as work proof. Fresh proof permits one human-approved career promotion and Authority increase.
8. Demotion halves Authority, records a violation, applies STOP, and requires explicit reinstatement. Task revocation blocks all descendants; leaf-first mandate revocation releases only unused reservation.

## Arc integration requirements

Before real use, a client still needs to:

1. Confirm mainnet RPC, chain ID, explorer, gas model, and native/ ERC-20 USDC details in current official Arc documentation.
2. Create a user-controlled signer or smart account; fund it with Arc USDC and approve the token contract.
3. Register an ERC-8004 identity, then deploy the reviewed candidate to Arc Testnet with the verified USDC and official Identity Registry addresses.
4. The current demo has a chain-aware wallet client and explicit confirmation; production still needs transaction simulation, robust error handling, and an event indexer.
5. Bind the transaction hash plus independently obtained vendor delivery evidence to a durable receipt.

The 2026-10-04 read-only preflight confirmed Arc Testnet chain ID `5042002`, USDC ERC-20 metadata (`USDC`, 6 decimals), bytecode at all three official ERC-8004 registries, and Identity Registry bindings from Reputation/Validation. Validation exists onchain but is not an MVP dependency.

## Trust boundaries

- The model may suggest a task or payment, but it cannot set or bypass contract constraints.
- The Illustrative Simulation is presentation-only and is not an authorization source. The AI planner is proposal-only; the live wallet panel is the only UI surface that can request Mainnet writes.
- A task hash proves bytes were committed, not that the task is legitimate.
- An outcome hash proves only that a caller supplied a hash; it does not attest service quality.
- USDC, the immutable official ERC-8004 Identity Registry, and the signer are external dependencies; deployment and contract behavior require validation.

## Deferred work

Production needs a client SDK, canonical JSON/hash format, signed request format, wallet abstraction, chain reads, allowance management, transaction monitoring, event indexer, receipt storage, real service evidence, and independent audit. The current contract also needs broader adversarial tests before it should secure funds.
