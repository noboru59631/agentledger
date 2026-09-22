const state = { revoked: false, spent: 0.2, failed: 0 };
const byId = (id) => document.getElementById(id);
const money = (value) => `$${value.toFixed(2)}`;

function render() {
  byId('spent').textContent = money(state.spent);
  byId('remaining').textContent = money(5 - state.spent);
  byId('failed').textContent = money(state.failed);
  byId('payStatus').textContent = 'SIMULATED · $0.20 USDC';
  if (!state.revoked) return;
  byId('taskStatus').textContent = 'REVOKED';
  byId('taskStatus').classList.add('revoked');
  byId('revoke').textContent = 'Authority revoked';
  byId('revoke').disabled = true;
  byId('execute').textContent = 'Blocked by policy';
  byId('execute').disabled = true;
  byId('checks').lastElementChild.innerHTML = '<b>×</b> Full authority chain active <span>ROOT REVOKED</span>';
  byId('blocked').classList.add('active');
  byId('blockedTitle').textContent = 'Payment blocked: root authority revoked';
  byId('blockedText').textContent = 'Translation Agent’s retry cannot cross a revoked root mandate.';
  byId('blockedCode').textContent = 'AUTHORITY_REVOKED(root: tsk_8f7a…42d1)';
  byId('failedDetail').textContent = 'Blocked before settlement';
}

byId('revoke').addEventListener('click', () => { state.revoked = true; state.failed = 0.03; render(); });
byId('execute').addEventListener('click', () => { if (!state.revoked) { state.spent += 0.2; render(); } });
byId('reset').addEventListener('click', () => window.location.reload());
byId('menuToggle').addEventListener('click', () => {
  const expanded = byId('menuToggle').getAttribute('aria-expanded') === 'true';
  byId('menuToggle').setAttribute('aria-expanded', String(!expanded));
  document.querySelector('.nav-links').classList.toggle('open', !expanded);
});
document.querySelectorAll('.nav-links a').forEach((link) => link.addEventListener('click', () => {
  document.querySelector('.nav-links').classList.remove('open');
  byId('menuToggle').setAttribute('aria-expanded', 'false');
}));
render();
