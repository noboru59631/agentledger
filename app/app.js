const state = { revoked: false, spent: 0.2, failed: 0 };
const byId = (id) => document.getElementById(id);
function money(value) { return `$${value.toFixed(2)}`; }
function render() {
  byId('spent').textContent = money(state.spent); byId('remaining').textContent = money(5 - state.spent);
  byId('failed').textContent = money(state.failed);
  byId('payStatus').textContent = 'SIMULATED · $0.20 USDC';
  if (!state.revoked) return;
  byId('taskStatus').textContent = 'REVOKED'; byId('taskStatus').style.color = '#a2463e';
  byId('revoke').textContent = 'Authority revoked'; byId('revoke').disabled = true;
  byId('execute').textContent = 'Blocked by policy'; byId('execute').disabled = true;
  byId('checks').lastElementChild.innerHTML = '<b>×</b> Full authority chain active <span>ROOT REVOKED</span>';
  byId('blocked').classList.add('active'); byId('blockedTitle').textContent = 'Payment blocked: root authority revoked';
  byId('blockedText').textContent = 'Translation Agent’s retry cannot cross a revoked root mandate.';
  byId('blockedCode').textContent = 'AUTHORITY_REVOKED(root: tsk_8f7a…42d1)';
  byId('failedDetail').textContent = 'Blocked before settlement';
}
byId('revoke').addEventListener('click', () => { state.revoked = true; state.failed = .03; render(); });
byId('execute').addEventListener('click', () => { if (!state.revoked) { state.spent += .2; render(); } });
byId('reset').addEventListener('click', () => location.reload()); render();
