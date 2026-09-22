import { initLiveDemo } from './live-demo.mjs';

const livePanel = document.getElementById('live-demo');
const heroActions = document.querySelector('.hero-actions');
if (heroActions && livePanel) {
  const launch = document.createElement('a');
  launch.className = 'button button-primary launch-live';
  launch.href = '#live-demo';
  launch.innerHTML = 'Launch Mainnet Demo <span>↘</span>';
  heroActions.prepend(launch);
}
if (livePanel) {
  const intro = document.createElement('div');
  intro.className = 'live-how';
  intro.innerHTML = '<strong>How to use this live demo</strong><ol><li>Connect your wallet and switch to Arc Mainnet.</li><li>Review your address and USDC balance.</li><li>Set the recipient and run each action from left to right.</li><li>Review every wallet prompt and Arc Explorer receipt.</li></ol>';
  livePanel.querySelector('.live-warning').before(intro);
  const steps = document.createElement('div');
  steps.className = 'wizard-steps';
  steps.setAttribute('aria-label', 'Live demo progress');
  ['Connect wallet', 'Network & balance', 'Create task / permissions', 'Delegate (optional)', 'Approve USDC', 'Execute payment', 'Revoke / finish'].forEach((label, index) => {
    const item = document.createElement('span'); item.dataset.step = String(index + 1); item.textContent = `${index + 1} ${label}`; steps.append(item);
  });
  livePanel.querySelector('.live-card').prepend(steps);
  const permission = document.createElement('div');
  permission.className = 'permission-card';
  permission.innerHTML = '<div class="eyebrow">TASK PERMISSIONS</div><h3>Set the authority before you create it</h3><p>These are plain-language boundaries. Delegated child authority can only become narrower.</p><div class="permission-grid"><label>Task budget<small>Total USDC reserved for this job.</small><input id="liveBudget" value="1" inputmode="decimal"></label><label>Deadline<small>When this authority expires.</small><input id="liveDeadline" type="datetime-local"></label><label>Service scope<small>What kind of service is allowed.</small><select id="liveScope"><option value="1">Research / data</option><option value="2">Translation</option><option value="3">API / software</option></select></label><label>Delegation depth<small>Maximum child handoffs.</small><input id="liveDepth" type="number" min="0" max="8" value="2"></label></div><p class="helper-warning">Recipient restriction is required below and must differ from the sender.</p>';
  livePanel.querySelector('.live-toolbar').after(permission);
  const compare = document.createElement('div');
  compare.className = 'authority-compare';
  compare.innerHTML = '<div><span>Parent authority</span><b>Budget — · scope — · depth —</b></div><div class="narrow-arrow">→</div><div><span>Child authority</span><b>Created after delegation · cannot widen</b></div>';
  livePanel.querySelector('.live-state').before(compare);
}

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

initLiveDemo({ ui: {
  connect: byId('liveConnect'), switchButton: byId('liveSwitch'), chain: byId('liveChain'), address: byId('liveAddress'), balance: byId('liveBalance'),
  recipient: byId('liveRecipient'), amount: byId('liveAmount'), cap: byId('liveCap'), create: byId('liveCreate'), delegate: byId('liveDelegate'),
  approve: byId('liveApprove'), execute: byId('liveExecute'), revoke: byId('liveRevoke'), root: byId('liveRoot'), child: byId('liveChild'), tx: byId('liveTx'), message: byId('liveMessage'),
  modal: byId('liveModal'), modalTitle: byId('liveModalTitle'), modalBody: byId('liveModalBody'), modalConfirm: byId('liveModalConfirm'), modalCancel: byId('liveModalCancel'), steps: document.querySelectorAll('.wizard-steps span'),
} }).catch((error) => byId('liveMessage').textContent = `Live mode unavailable until the wallet client loads: ${error.message}`);
