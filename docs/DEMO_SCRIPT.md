# Demo Script (60–90 seconds)

## Recording truthfully

The current UI is a local deterministic fixture. Before recording it, show the visible “Simulation only” label. Do not describe fixture values, service delivery, receipts, or revocation as live Arc transactions. This script is for the current prototype; a submission video must be recorded again after the live mainnet flow exists.

## Script

**0–10 sec — The job**
“I ask an AI team to compare agent-wallet infrastructure. I set a five USDC budget and a clear deadline. The goal is to let the work happen without handing an agent an unrestricted wallet.”

**10–25 sec — Narrow delegation**
“The Research Agent can delegate part of its authority to a Translation Agent. The child budget, service scope, expiry, and delegation depth stay within the parent’s mandate.”

**25–40 sec — A payment request**
“The Translation Agent requests a small payment. MandateGraph binds the request to the task, agent mandate, recipient, amount, service class, resource, expiry, and nonce. The contract checks the full authority chain before a USDC transfer.”

**40–55 sec — Outcome and attribution**
“The product view connects the payment request to the service and result, and attributes cost to the task and participating agents. In this prototype, these values are fixtures; the contract emits a caller-supplied outcome hash but does not verify delivery.”

**55–70 sec — Revoke**
“The human revokes the root task. A child-agent retry is blocked because no descendant can outlive the root authority.”

**70–85 sec — Arc fit**
“On Arc, USDC is the settlement asset and pays network fees. AgentLedger is designed to make each autonomous expense traceable to the human job and delegated authority behind it.”

## For a future live recording

Show the public app URL, exact contract address, Arc mainnet transaction and explorer page, a real successful request/receipt, and a real revoke-blocked retry. Remove all fixture wording only after those states are read from verified chain transactions and independently recorded service evidence.
