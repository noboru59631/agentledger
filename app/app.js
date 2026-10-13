import { initLiveDemo } from './live-demo.mjs';
import { initAIDemo } from './ai-demo.mjs';
import { initResearchExample } from './research-demo.mjs';

const aiSection = document.createElement('section');
aiSection.className = 'section ai-section';
aiSection.id = 'ai-demo';
aiSection.innerHTML = `<div class="section-heading"><div><div class="eyebrow">OPTIONAL AI PROPOSAL DEMO</div><h2>Turn a goal into a<br><em>bounded agent plan.</em></h2></div><div class="demo-badge"><span class="status-dot"></span> PROPOSALS ONLY · SIMULATED COSTS</div></div><div class="ai-card"><div class="ai-intro"><p>Use the same 5 USDC competitor research task. When configured, Gemini proposes a plan; deterministic policy checks its budget, scope, and STOP state. This does not buy services, produce a researched report, or execute Mainnet payments.</p><form id="aiForm"><label>Natural-language goal<textarea id="aiGoal" rows="3">Research competing projects on Arc and produce a comparison report.</textarea></label><label>Task budget (USDC)<input id="aiBudget" value="5" type="number" min="0.01" max="100" step="0.01"></label><button class="button button-primary" id="aiRun" type="submit">Generate proposal only <span>→</span></button></form><p class="ai-status" id="aiStatus">A missing key or exhausted quota automatically uses the labeled non-AI fallback.</p></div><div class="ai-explainer"><span>LLM</span><b>Proposal only</b><small>Strict JSON schema</small><i>↓</i><span>POLICY</span><b>Deterministic checks</b><small>Budget · scope · STOP</small><i>↓</i><span>LEDGER</span><b>Auditable state</b><small>No real settlement</small></div></div><div class="ai-dashboard" id="aiDashboard" hidden><div class="ai-dashboard-top"><div><span class="pill" id="aiSource">DEMO FALLBACK · NON-AI</span><h3 id="aiSummary">—</h3><p id="aiReason">—</p></div><div class="ai-controls"><button class="button button-quiet" id="aiInvalid" type="button">Inject invalid proposal</button><button class="revoke" id="aiStop" type="button">STOP / kill switch</button></div></div><div class="metrics ai-metrics"><div><span>Budget</span><strong id="aiBudgetMetric">$5.00</strong><small>Task cap · simulated</small></div><div><span>Allocated</span><strong id="aiAllocated">$0.00</strong><small>Child budgets</small></div><div><span>Reserved</span><strong id="aiReserved">$0.00</strong><small>Held for descendants</small></div><div><span>Spent</span><strong id="aiSpent">$0.00</strong><small>Simulated service costs</small></div><div><span>Available</span><strong id="aiRemaining">$0.00</strong><small>Available after policy</small></div></div><div class="ai-columns"><div class="ai-panel"><div class="eyebrow">AGENT TREE</div><ul id="aiAgents"></ul><div class="eyebrow">SERVICE DECISIONS</div><ul id="aiServices"></ul></div><div class="ai-panel ai-dark"><div class="eyebrow">BLOCKED ACTIONS</div><ul id="aiBlocked"></ul><div class="eyebrow">ILLUSTRATIVE REPORT PREVIEW</div><p id="aiReport"></p><details><summary>Advanced / audit</summary><code>policy=deterministic<br>root=task-bound<br>settlement=disabled<br>mandate IDs hidden in main UX</code></details></div></div></div>`;
document.getElementById('demo')?.after(aiSection);
const livePanel = document.getElementById('live-demo');

const byId = (id) => document.getElementById(id);
initResearchExample();
byId('menuToggle').addEventListener('click', () => {
  const expanded = byId('menuToggle').getAttribute('aria-expanded') === 'true';
  byId('menuToggle').setAttribute('aria-expanded', String(!expanded));
  document.querySelector('.nav-links').classList.toggle('open', !expanded);
});
document.querySelectorAll('.nav-links a').forEach((link) => link.addEventListener('click', () => {
  document.querySelector('.nav-links').classList.remove('open');
  byId('menuToggle').setAttribute('aria-expanded', 'false');
}));

initLiveDemo({ container: livePanel }).catch((error) => {
  const message = byId('liveMessage');
  if (!message) return;
  message.textContent = `Live mode unavailable until the wallet client loads: ${error.message}`;
  message.className = 'live-message error';
  message.setAttribute('role', 'alert');
});

initAIDemo();
