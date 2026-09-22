# Architecture

## Product boundary

AgentLedger connects a human task to bounded agent authority, payment attempts, and outcome evidence. The repository has a local fixture simulation, a real Gemini proposal route with deterministic browser policy checks, a wallet-connected Arc Mainnet Demo Mode, and an experimental onchain authorization/settlement contract. The AI demo does not settle; Mainnet writes are explicit user-confirmed actions.

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
| MandateGraph | Store authority, enforce budget/scope/expiry/revocation, execute transfer | Solidity contract deployed experimentally on Arc Mainnet |
| USDC adapter | Configure Arc RPC/token and submit signed transactions | Wallet-connected live demo with explicit confirmation for each write |
| Evidence/indexing | Link chain tx, service evidence, and result | Not implemented; fixture hashes are not proof |

## Contract lifecycle

1. A task owner records a metadata hash and creates a root mandate with a budget, deadline, service bitmap, and maximum delegation depth.
2. The root agent delegates budget reserved from its unspent/unallocated balance. Child expiry and service scope cannot widen, and recipient restrictions remain fixed.
3. A child payment ID must equal the onchain ABI-encoded hash of task ID, mandate ID, recipient, amount, service class, resource hash, request expiry, and nonce.
4. The contract checks the calling agent, payment expiry, recipient/scope, task budget, and every ancestor's revocation, expiry, and available budget.
5. It consumes the payment ID and updates accounting before the USDC external call; a reentrancy guard protects the interaction.
6. The contract emits request and outcome hashes with payment details. It cannot establish that the offchain service or output is truthful.
7. Task revocation blocks all descendants. Mandate revocation blocks its descendants when ancestry is next checked.

## Arc integration requirements

Before real use, a client still needs to:

1. Confirm mainnet RPC, chain ID, explorer, gas model, and native/ ERC-20 USDC details in current official Arc documentation.
2. Create a user-controlled signer or smart account; fund it with Arc USDC and approve the token contract.
3. Deploy the reviewed contract with the verified Arc USDC ERC-20 address.
4. The current demo has a chain-aware wallet client and explicit confirmation; production still needs transaction simulation, robust error handling, and an event indexer.
5. Bind the transaction hash plus independently obtained vendor delivery evidence to a durable receipt.

The 2026-09-21 Arc docs index states USDC is the gas asset but also contains a stale testnet-only statement. It links an EVM differences document that distinguishes 18-decimal native gas units from the 6-decimal USDC ERC-20 interface. Third-party explorer documentation currently reports mainnet chain ID 5042 and RPC `https://rpc.arc-scan.org`; treat these as candidate values until independently checked against current official endpoints.

## Trust boundaries

- The model may suggest a task or payment, but it cannot set or bypass contract constraints.
- The Illustrative Simulation is presentation-only and is not an authorization source. The AI planner is proposal-only; the live wallet panel is the only UI surface that can request Mainnet writes.
- A task hash proves bytes were committed, not that the task is legitimate.
- An outcome hash proves only that a caller supplied a hash; it does not attest service quality.
- The token contract and signer are external dependencies; deployment and token behavior require validation.

## Deferred work

Production needs a client SDK, canonical JSON/hash format, signed request format, wallet abstraction, chain reads, allowance management, transaction monitoring, event indexer, receipt storage, real service evidence, and independent audit. The current contract also needs broader adversarial tests before it should secure funds.
