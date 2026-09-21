# Demo Script (60–90 Seconds)

## Recording setup

Open these tabs before recording: the local browser simulation, the GitHub repository README, the Arc explorer contract page, the payment execution transaction, the task revocation transaction, and `docs/MAINNET_EVIDENCE.json`. Keep the simulation’s “Local simulation · fixture data” label visible whenever the UI is shown. The UI is not connected to Arc.

## Timed walkthrough

**0–10 sec — Introduce the project (GitHub README)**  
“AgentLedger gives an AI team a budget for a specific job, with spending authority that can be traced back through its delegation chain. The repository includes the contract prototype, local simulation, tests, and public evidence.”

**10–27 sec — Show the product journey (local simulation)**  
“Here a human task has a five USDC cap. The Research Agent delegates a reserved one USDC child budget to a Translation Agent. Delegated authority can only narrow: a child cannot increase the budget, widen the service scope, extend expiry, or loosen a recipient restriction.”

**27–43 sec — Explain payment lineage (local simulation, then Arc contract page)**  
“The request is tied to the task, mandate, recipient, amount, service class, resource, expiry, and nonce. This screen is illustrative fixture data. The Arc explorer page is the deployed contract; the UI itself does not call it.”

**43–59 sec — Show the mainnet payment (payment execution transaction)**  
“This transaction is the recorded 0.01 USDC payment execution in the Arc Mainnet lifecycle rehearsal. The recipient was a separately controlled demo wallet, so this demonstrates the transaction path rather than an independent vendor purchase or service delivery.”

**59–73 sec — Show revocation (revocation transaction, then evidence JSON)**  
“Task revocation is recorded here. The evidence file also records `retryBlocked: true`, confirmed by a read-only check after revocation. No retry transaction was sent.”

**73–88 sec — Close on the evidence and limitations (evidence JSON / README)**  
“AgentLedger demonstrates task-bound mandates, reserved delegated budgets, payment lineage, revocation, and blocked retry on Arc Mainnet. The contract is unaudited, the browser demo is local fixture data, and outcome hashes do not independently prove service delivery.”

## Screens to include

1. GitHub repository README and project status.
2. Local simulation with the fixture label visible; show task, budget, delegation path, and revocation state.
3. Arc explorer contract page.
4. Arc explorer payment execution transaction.
5. Arc explorer task revocation transaction.
6. `docs/MAINNET_EVIDENCE.json` showing the transaction hashes and `retryBlocked`.
7. Optional: latest GitHub Actions CI run for the source revision being submitted.

Do not describe fixture UI values as live chain state, and do not call the demo wallet a vendor.
