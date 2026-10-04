# AgentLedger Demo Video Package

Target length: 75–90 seconds. Show the Authority thesis, the public self-custodial V2 controls, and verified Arc Mainnet evidence. Keep the experimental/unaudited label visible.

## Recording setup

1. Open the public app at <https://agentledger-livid.vercel.app/> at readable zoom in a clean Chromium window.
2. Open the V2 Arc Explorer contract, Promotion, STOP/Demotion, and `docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json` in separate tabs.
3. Use a 1920×1080 capture if possible. Hide bookmarks and keep the browser address bar visible for Explorer shots.
4. Do not send a large or automated write during recording. Use the completed lifecycle evidence; wallet connection and read-only Agent verification are sufficient.

## Timed shot list and narration

| Time | Screen / exact action | Narration |
|---|---|---|
| 0:00–0:08 | Website hero. Hold on the headline and public links. | “AgentLedger gives AI a budget for the job, not a wallet full of money. AI proposes; AgentLedger decides.” |
| 0:08–0:17 | Scroll through **From human intent to accountable outcome**. Pause on the full flow: Human Intent → Task → Mandate → Agent → Sub-Agent → Payment → Service → Outcome. | “A human starts with a task. Authority moves through agents only when budget, scope, recipient, expiry, and depth stay within the parent boundary.” |
| 0:17–0:31 | Open **AI Orchestrated Demo**, submit the default goal, and show `GEMINI PLAN · POLICY APPROVED` when the live provider is configured. | “Gemini proposes a structured multi-agent plan. AgentLedger checks the budget and scope deterministically; service costs are simulated and no chain write occurs.” |
| 0:31–0:40 | Click **Inject invalid proposal**, then **STOP / kill switch**. | “An invalid proposal is blocked, and STOP propagates revocation to queued descendants.” |
| 0:40–0:51 | Show **Illustrative Simulation**, keep the fixture labels visible, and click **Revoke task authority**. | “The local fixture view makes the same lineage legible: a bounded child request becomes blocked after root revocation.” |
| 0:51–1:04 | Scroll to **Public Self-Custodial Mainnet dApp**, show Connect Wallet, My Agents, Current Authority, exact approval, and STOP controls. | “The public V2 dApp verifies ERC-8004 ownership and uses only the connected wallet’s Agent and USDC.” |
| 1:04–1:15 | Show the V2 payment and Promotion transactions with Explorer status legible. | “The verified lifecycle paid 0.025 USDC and raised Authority from 0.01 to 0.05 only after payment-bound proof and an owner signature.” |
| 1:15–1:26 | Show STOP/Demotion and the evidence file’s `AuthorityCapExceeded` simulation plus allowance zero. | “A violation cut Authority to 0.025. A 0.026 request was rejected by eth_call, and no failed transaction was broadcast.” |
| 1:26–1:35 | Return to limitations, public links, and the GitHub CTA. | “The contract is experimental and unaudited. AI costs are simulated, the recipient was a controlled demo wallet, and outcome hashes do not independently prove service delivery.” |

## Accuracy checklist

- Say “simulated,” “fixture,” or “illustrative” for local and AI service-cost states.
- Say “real Gemini proposal” only when the UI shows the Gemini source label; mention that deterministic policy still decides approval.
- Say “verified Arc Mainnet V2 lifecycle” for the real evidence; distinguish it from any current recording session.
- Say “separately controlled demo wallet,” never “vendor,” “customer,” or “service provider.”
- Describe over-cap and Wallet B isolation as read-only simulations; no failing transaction was sent.
- Do not claim service delivery, output quality, a security audit, or an outcome hash attestation.

## Captions

The synchronized SRT is in [`docs/DEMO_CAPTIONS.srt`](DEMO_CAPTIONS.srt).
