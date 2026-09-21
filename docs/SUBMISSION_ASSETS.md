# Submission Screenshot Shot List

Capture clean browser screenshots at readable zoom. Keep the browser address bar or page title visible when it helps establish provenance. Do not crop away fixture labels or imply the local simulation is connected to Arc.

| # | Screen to capture | Suggested caption |
|---|---|---|
| 1 | Arc Explorer contract page for [0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da](https://explorer.arc.io/address/0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da) | “AgentLedger MandateGraph contract deployed on Arc Mainnet (chain ID 5042).” |
| 2 | Arc Explorer page for the [executePayment transaction](https://explorer.arc.io/tx/0xba0064e2a6cb13daeffafe90e79fc53c94d25ea7ae0a205e58bbee53c46eec6e) | “Recorded 0.01 USDC payment execution in the mainnet lifecycle rehearsal; recipient was a separately controlled demo wallet.” |
| 3 | Arc Explorer page for the [revokeTask transaction](https://explorer.arc.io/tx/0x7a694807ac98d25f6e4145fd2fc7f715838269544155309ac69602b66c8f65ba) beside the relevant `retryBlocked: true` entry in [MAINNET_EVIDENCE.json](MAINNET_EVIDENCE.json) | “Task revocation recorded onchain; a subsequent retry was confirmed blocked by a read-only check.” |
| 4 | Local simulation’s task card, budget metrics, and delegation/payment lineage with “Local simulation · fixture data” visible | “Conceptual task and payment flow in the local fixture UI; this screen does not read from or write to Arc.” |
| 5 | A simple architecture graphic or the flow in [ARCHITECTURE.md](../ARCHITECTURE.md): human task → root mandate → reserved child mandate → bound payment → revocation check | “MandateGraph links payment authorization to task scope and delegated authority.” |
| 6 | Latest passing GitHub Actions CI run for the submitted commit, if available when capturing | “Automated contract, lifecycle, Node, and syntax checks for the submitted source revision.” |

## Capture notes

- Prefer screenshots 1–4 as the core submission set. Include 5–6 when the application allows additional evidence.
- For the retry-blocked claim, show the evidence JSON entry and label the verification as read-only; there is no retry transaction to screenshot.
- Keep transaction hashes, network context, and explorer domain legible.
- Do not use screenshots of the local simulation as proof of payment execution or service delivery.
- No screenshot should suggest that the demo recipient was an independent vendor or that an outcome hash authenticates service.
