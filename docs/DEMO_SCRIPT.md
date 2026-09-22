# AgentLedger Demo Video Package

Target length: 75–90 seconds. The website is a polished presentation of the repository’s deterministic browser simulation. Keep the `ILLUSTRATIVE LOCAL DEMO` and `Local simulation · fixture data` labels visible whenever the demo frame is on screen.

## Recording setup

1. Run `npm start` and open `http://localhost:4173` at 110–125% zoom in a clean Chromium window.
2. Open the Arc Explorer contract page, payment execution transaction, task revocation transaction, and `docs/MAINNET_EVIDENCE.json` in separate tabs.
3. Use a 1920×1080 capture if possible. Hide bookmarks and keep the browser address bar visible for Explorer shots.
4. Do not connect a wallet or send a transaction. The only click in the local demo is the fixture interaction that revokes the task.

## Timed shot list and narration

| Time | Screen / exact action | Narration |
|---|---|---|
| 0:00–0:08 | Website hero. Hold on the headline, then click **Explore the demo**. | “AgentLedger gives AI a budget for the job, not a wallet full of money. It connects human intent to delegated mandates and payment evidence.” |
| 0:08–0:17 | Scroll through **From human intent to accountable outcome**. Pause on the full flow: Human Intent → Task → Mandate → Agent → Sub-Agent → Payment → Service → Outcome. | “A human starts with a task. Authority moves through agents only when budget, scope, recipient, expiry, and depth stay within the parent boundary.” |
| 0:17–0:33 | Scroll to **See the budget boundary in motion**. Keep both the demo badge and fixture label visible. Show the $5.00 cap, $1.00 delegated child budget, and $0.20 simulated request. | “This local simulation shows a five USDC research task. The Research Agent delegates a reserved one USDC child budget to a Translation Agent, then proposes a twenty-cent request.” |
| 0:33–0:42 | Move across the four request checks, then click **Revoke task authority**. | “The request is bound to the task, mandate, recipient, amount, service class, resource, expiry, and nonce. The interface is illustrative fixture data; it does not read from Arc.” |
| 0:42–0:51 | Hold on `Payment blocked: root authority revoked` and `AUTHORITY_REVOKED`. | “When the root authority is revoked, the delegated retry is blocked before settlement. That is the boundary we want agents to inherit.” |
| 0:51–1:04 | Scroll to **Real settlement evidence**. Switch to the Arc Explorer contract page. | “Separately, AgentLedger completed a documented Arc Mainnet lifecycle rehearsal. This is the deployed MandateGraph contract on chain ID 5042.” |
| 1:04–1:15 | Show the payment execution transaction with Explorer domain and status legible. | “This page records the 0.01 USDC payment execution. The recipient was a separately controlled demo wallet, not a verified vendor.” |
| 1:15–1:26 | Show the revocation transaction, then `retryBlocked: true` in `docs/MAINNET_EVIDENCE.json`. | “Task revocation is also recorded onchain. The evidence file records a retry blocked by a read-only check; no retry transaction was sent.” |
| 1:26–1:35 | Return to limitations and the GitHub CTA. | “The contract is experimental and unaudited, the browser UI is fixture-based, and outcome hashes do not independently prove service delivery. The full prototype, tests, and evidence are open on GitHub.” |

## Accuracy checklist

- Say “simulated,” “fixture,” or “illustrative” for every browser-demo state.
- Say “Arc Mainnet lifecycle rehearsal” for the real evidence; do not imply the browser executed it.
- Say “separately controlled demo wallet,” never “vendor,” “customer,” or “service provider.”
- Describe `retryBlocked: true` as a read-only verification; there is no retry transaction.
- Do not claim service delivery, output quality, a security audit, or an outcome hash attestation.

## Captions

The synchronized SRT is in [`docs/DEMO_CAPTIONS.srt`](DEMO_CAPTIONS.srt).
