# AgentLedger Demo Video Package

Target length: 75–90 seconds. The public recording should show the three product surfaces in order: AI proposal and deterministic policy, illustrative fixture simulation, and Arc Mainnet evidence/live controls. Keep each mode label visible.

## Recording setup

1. Open the public app at <https://agentledger-livid.vercel.app/> at readable zoom in a clean Chromium window.
2. Open the Arc Explorer contract page, payment execution transaction, task revocation transaction, and `docs/MAINNET_EVIDENCE.json` in separate tabs.
3. Use a 1920×1080 capture if possible. Hide bookmarks and keep the browser address bar visible for Explorer shots.
4. Do not send a transaction during recording unless the recording is explicitly intended to demonstrate a user-confirmed Mainnet write. The published video should use the evidence already recorded.

## Timed shot list and narration

| Time | Screen / exact action | Narration |
|---|---|---|
| 0:00–0:08 | Website hero. Hold on the headline and public links. | “AgentLedger gives AI a budget for the job, not a wallet full of money. AI proposes; AgentLedger decides.” |
| 0:08–0:17 | Scroll through **From human intent to accountable outcome**. Pause on the full flow: Human Intent → Task → Mandate → Agent → Sub-Agent → Payment → Service → Outcome. | “A human starts with a task. Authority moves through agents only when budget, scope, recipient, expiry, and depth stay within the parent boundary.” |
| 0:17–0:31 | Open **AI Orchestrated Demo**, submit the default goal, and show `GEMINI PLAN · POLICY APPROVED` when the live provider is configured. | “Gemini proposes a structured multi-agent plan. AgentLedger checks the budget and scope deterministically; service costs are simulated and no chain write occurs.” |
| 0:31–0:40 | Click **Inject invalid proposal**, then **STOP / kill switch**. | “An invalid proposal is blocked, and STOP propagates revocation to queued descendants.” |
| 0:40–0:51 | Show **Illustrative Simulation**, keep the fixture labels visible, and click **Revoke task authority**. | “The local fixture view makes the same lineage legible: a bounded child request becomes blocked after root revocation.” |
| 0:51–1:04 | Scroll to **Arc Mainnet Demo Mode**, show wallet connection and explicit confirmation language, then switch to the Arc Explorer contract page. | “The separate live mode connects a wallet and asks for confirmation one action at a time. The deployed contract is on Arc Mainnet, chain ID 5042.” |
| 1:04–1:15 | Show the payment execution transaction with Explorer domain and status legible. | “This page records the 0.01 USDC payment execution. The recipient was a separately controlled demo wallet, not a verified vendor.” |
| 1:15–1:26 | Show the revocation transaction, then `retryBlocked: true` in `docs/MAINNET_EVIDENCE.json`. | “Task revocation is also recorded onchain. The evidence file records a retry blocked by a read-only check; no retry transaction was sent.” |
| 1:26–1:35 | Return to limitations, public links, and the GitHub CTA. | “The contract is experimental and unaudited. AI costs are simulated, the recipient was a controlled demo wallet, and outcome hashes do not independently prove service delivery.” |

## Accuracy checklist

- Say “simulated,” “fixture,” or “illustrative” for local and AI service-cost states.
- Say “real Gemini proposal” only when the UI shows the Gemini source label; mention that deterministic policy still decides approval.
- Say “Arc Mainnet lifecycle rehearsal” for the real evidence; do not imply the browser executed it.
- Say “separately controlled demo wallet,” never “vendor,” “customer,” or “service provider.”
- Describe `retryBlocked: true` as a read-only verification; there is no retry transaction.
- Do not claim service delivery, output quality, a security audit, or an outcome hash attestation.

## Captions

The synchronized SRT is in [`docs/DEMO_CAPTIONS.srt`](DEMO_CAPTIONS.srt).
