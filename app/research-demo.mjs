import { taskBudgetBreakdown, taskBudgetDecision } from './live-policy.mjs';

export function createResearchExample() {
  return { budget: 5_000_000n, reserved: 1_000_000n, spent: 0n, phase: 'proposal' };
}

export function researchExampleAction(state, action) {
  if (action === 'stop') return { ...state, phase: 'stopped' };
  if (action === 'pay' && state.phase === 'proposal') {
    const cost = 200_000n;
    const decision = taskBudgetDecision({ budget: state.reserved, reserved: 0n, spent: 0n }, cost);
    if (!decision.paymentAllowed) return { ...state, phase: 'paused' };
    return { ...state, reserved: state.reserved - cost, spent: state.spent + cost, phase: 'paid' };
  }
  if (action === 'over-budget' && state.phase === 'paid') {
    const decision = taskBudgetDecision(state, 4_800_000n);
    if (decision.humanApprovalRequired) return { ...state, phase: 'paused' };
  }
  return state;
}

export function initResearchExample() {
  const byId = (id) => document.getElementById(id);
  const money = (amount) => `${(Number(amount) / 1_000_000).toFixed(2)} USDC`;
  let state = createResearchExample();

  function render() {
    const totals = taskBudgetBreakdown(state);
    const stopped = state.phase === 'stopped';
    const paused = state.phase === 'paused';
    byId('available').textContent = money(totals.available);
    byId('reserved').textContent = money(totals.reserved);
    byId('spent').textContent = money(totals.spent);
    byId('helperReservation').textContent = money(totals.reserved);
    byId('authorityState').textContent = stopped ? 'STOPPED' : paused ? 'PAUSED' : 'ACTIVE';
    byId('authorityIcon').textContent = stopped || paused ? '×' : '✓';
    byId('exampleAuthority').classList.toggle('denied', stopped || paused);
    byId('taskStatus').textContent = `${stopped ? 'STOPPED' : paused ? 'PAUSED' : 'ACTIVE'} · SIMULATED`;
    byId('taskStatus').classList.toggle('revoked', stopped || paused);
    byId('execute').disabled = state.phase !== 'proposal';
    byId('overBudget').disabled = state.phase !== 'paid';
    byId('revoke').disabled = stopped;
    byId('humanDecision').hidden = !paused;
    byId('payStatus').textContent = state.spent > 0n ? 'SIMULATED · 0.20 USDC permitted' : 'No payment yet';
    byId('blocked').classList.toggle('active', stopped || paused);
    byId('blockedTitle').textContent = stopped ? 'STOP: task authority revoked' : paused ? '4.80 USDC request blocked. Task paused.' : state.phase === 'paid' ? 'Permitted payment simulated' : 'Ready to check the proposal';
    byId('blockedText').textContent = stopped ? 'No further simulated payments can execute. Accounting history is preserved.' : paused ? 'The parent has 4.00 USDC available. The helper’s remaining 0.80 USDC is reserved, so it cannot fund this request. No additional spend occurred.' : state.phase === 'paid' ? 'Reserved decreased to 0.80 USDC; Spent increased to 0.20 USDC. Try the over-budget request next.' : 'Simulate the permitted payment, then try the over-budget request.';
  }

  function act(action) { state = researchExampleAction(state, action); render(); }
  byId('execute').addEventListener('click', () => act('pay'));
  byId('overBudget').addEventListener('click', () => act('over-budget'));
  byId('revoke').addEventListener('click', () => act('stop'));
  byId('endTask').addEventListener('click', () => act('stop'));
  byId('keepPaused').addEventListener('click', () => {
    byId('humanChoice').textContent = 'Human decision: keep paused. No further spending is permitted.';
  });
  byId('reset').addEventListener('click', () => {
    state = createResearchExample();
    byId('humanChoice').textContent = 'Waiting for the human’s decision.';
    render();
  });
  render();
}
