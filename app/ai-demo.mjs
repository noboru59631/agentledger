import { evaluateDemoPlan, fallbackPlan } from './ai-policy.mjs';

const byId = (id) => document.getElementById(id);
const money = (value) => `$${Number(value || 0).toFixed(2)}`;
let current = null;
let currentSource = 'fallback';
let revoked = false;

function render(result, source, reason) {
  const plan = current;
  byId('aiSource').textContent = source === 'gemini' ? 'GEMINI PLAN · POLICY APPROVED' : 'DEMO FALLBACK · NON-AI';
  byId('aiReason').textContent = reason || 'LLM output is a proposal only; every decision below is deterministic.';
  byId('aiSummary').textContent = plan.taskSummary;
  byId('aiBudgetMetric').textContent = money(byId('aiBudget').value);
  byId('aiAllocated').textContent = money(result.allocated);
  byId('aiReserved').textContent = money(result.reserved);
  byId('aiSpent').textContent = money(result.spent);
  byId('aiRemaining').textContent = money(result.remaining);
  byId('aiAgents').innerHTML = `<li><b>Human task</b><span>${money(byId('aiBudget').value)} cap</span><ul><li><b>${plan.rootAgent.role}</b><span>${money(plan.rootAgent.budget)} allocated</span>${(plan.subAgents || []).map((agent) => `<ul><li><b>${agent.role}</b><span>${money(agent.budget)} reserved</span></li></ul>`).join('')}</li></ul></li>`;
  byId('aiServices').innerHTML = result.decisions.map((decision) => `<li class="${decision.status === 'blocked' ? 'blocked-row' : ''}"><b>${decision.category}</b><span>${decision.status} · ${money(decision.estimatedCost)}</span><small>${decision.reason}</small></li>`).join('');
  byId('aiBlocked').innerHTML = result.blockedActions.length ? result.blockedActions.map((item) => `<li>${item}</li>`).join('') : '<li>No blocked actions in the valid proposal.</li>';
  byId('aiReport').textContent = revoked ? 'STOP received. The report remains readable, but no queued descendant action can execute.' : `Draft ${plan.finalOutputType}: ${plan.taskSummary} Two simulated service requests were evaluated against the task budget and allowlist. No vendor was contacted and no USDC was settled.`;
  byId('aiDashboard').hidden = false;
}

function showPlan(payload) { current = payload.proposal; currentSource = payload.source; render(evaluateDemoPlan(current, Number(byId('aiBudget').value), { revoked }), currentSource, payload.reason); }

export function initAIDemo() {
  const form = byId('aiForm'); if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); revoked = false; byId('aiRun').disabled = true; byId('aiStatus').textContent = 'Asking the server-side planner…';
    try {
      const response = await fetch('/api/orchestrate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goal: byId('aiGoal').value, budget: byId('aiBudget').value }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Planner unavailable.');
      showPlan(payload); byId('aiStatus').textContent = payload.source === 'gemini' ? 'Plan received and checked by deterministic policy.' : `Fallback plan loaded: ${payload.reason || 'the live planner was unavailable.'}`;
    } catch (error) { current = fallbackPlan(byId('aiGoal').value, Number(byId('aiBudget').value)); render(evaluateDemoPlan(current, Number(byId('aiBudget').value)), 'fallback', error.message); byId('aiStatus').textContent = 'Network fallback loaded; no AI call was completed.'; }
    byId('aiRun').disabled = false;
  });
  byId('aiStop').addEventListener('click', () => { if (!current) return; revoked = true; render(evaluateDemoPlan(current, Number(byId('aiBudget').value), { revoked }), currentSource, 'STOP is deterministic and propagates to queued descendants.'); byId('aiStatus').textContent = 'STOP propagated: descendant actions are blocked.'; });
  byId('aiInvalid').addEventListener('click', () => { if (!current) return; const invalid = structuredClone(current); invalid.services = [...invalid.services, { category: 'wallet-drain', description: 'Intentionally invalid demo request', estimatedCost: Number(byId('aiBudget').value) }]; render(evaluateDemoPlan(invalid, Number(byId('aiBudget').value)), currentSource, 'Intentionally invalid proposal injected to demonstrate policy enforcement.'); byId('aiStatus').textContent = 'Blocked invalid proposal: disallowed service and over-budget request.'; });
}
