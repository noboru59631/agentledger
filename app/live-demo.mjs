import {
  ARC_CHAIN_HEX, ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_RPC_URL,
  IDENTITY_REGISTRY_ADDRESS, PUBLIC_CONTRACT_ADDRESS, PUBLIC_DEPLOYMENT_STATUS, REFERENCE_AGENT_ID,
  REFERENCE_CONTRACT_ADDRESS, REFERENCE_OPERATIONAL_AGENT, USDC_ADDRESS, USDC_DECIMALS,
  assertOwnedAgent, assertWriteReady, exactApprovalAmount, taskBudgetDecision,
} from './live-policy.mjs';

const VIEM_URL = 'https://esm.sh/viem@2.21.54';
const AUTHORITY_CAP_EXCEEDED_SELECTOR = '0xe5bbd38c';
const STORAGE_KEY = 'agentledger-owned-agent-ids';
const short = (value) => value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—';
const careerNames = ['Trainee', 'Associate', 'Manager', 'Director'];

const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
];
const identityAbi = [{ type: 'function', name: 'ownerOf', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'address' }] }];
const graphAbi = [
  { type: 'function', name: 'agents', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: 'operationalAgent', type: 'address' }, { name: 'career', type: 'uint8' }, { name: 'authorityCap', type: 'uint128' }, { name: 'completedWorks', type: 'uint32' }, { name: 'violations', type: 'uint32' }, { name: 'registered', type: 'bool' }] },
  { type: 'function', name: 'stoppedAgents', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'isPromotionEligible', stateMutability: 'view', inputs: [{ name: 'agentId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'nextMandateId', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  { type: 'function', name: 'tasks', stateMutability: 'view', inputs: [{ name: 'taskId', type: 'bytes32' }], outputs: [{ name: 'owner', type: 'address' }, { name: 'rootAgentId', type: 'uint256' }, { name: 'budget', type: 'uint128' }, { name: 'spent', type: 'uint128' }, { name: 'deadline', type: 'uint64' }, { name: 'taskHash', type: 'bytes32' }, { name: 'revoked', type: 'bool' }] },
  { type: 'function', name: 'mandates', stateMutability: 'view', inputs: [{ name: 'mandateId', type: 'uint256' }], outputs: [{ name: 'taskId', type: 'bytes32' }, { name: 'parentId', type: 'uint256' }, { name: 'agentId', type: 'uint256' }, { name: 'recipient', type: 'address' }, { name: 'budget', type: 'uint128' }, { name: 'spent', type: 'uint128' }, { name: 'allocated', type: 'uint128' }, { name: 'expiry', type: 'uint64' }, { name: 'depth', type: 'uint8' }, { name: 'serviceScope', type: 'uint256' }, { name: 'revoked', type: 'bool' }, { name: 'activeChildren', type: 'uint256' }] },
  { type: 'function', name: 'registerAgent', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'operationalAgent', type: 'address' }, { name: 'initialAuthorityCap', type: 'uint128' }], outputs: [] },
  { type: 'function', name: 'createTask', stateMutability: 'nonpayable', inputs: [{ name: 'taskSalt', type: 'bytes32' }, { name: 'taskHash', type: 'bytes32' }, { name: 'budget', type: 'uint128' }, { name: 'deadline', type: 'uint64' }, { name: 'serviceScope', type: 'uint256' }, { name: 'rootAgentId', type: 'uint256' }, { name: 'recipient', type: 'address' }, { name: 'depth', type: 'uint8' }], outputs: [{ name: 'taskId', type: 'bytes32' }, { name: 'rootMandateId', type: 'uint256' }] },
  { type: 'function', name: 'revokeTask', stateMutability: 'nonpayable', inputs: [{ name: 'taskId', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'computePaymentId', stateMutability: 'view', inputs: [{ name: 'taskId', type: 'bytes32' }, { name: 'mandateId', type: 'uint256' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint128' }, { name: 'serviceClass', type: 'uint256' }, { name: 'resourceHash', type: 'bytes32' }, { name: 'requestExpiry', type: 'uint64' }, { name: 'nonce', type: 'uint256' }], outputs: [{ name: '', type: 'bytes32' }] },
  { type: 'function', name: 'executePayment', stateMutability: 'nonpayable', inputs: [{ name: 'mandateId', type: 'uint256' }, { name: 'paymentId', type: 'bytes32' }, { name: 'recipient', type: 'address' }, { name: 'amount', type: 'uint128' }, { name: 'serviceClass', type: 'uint256' }, { name: 'resourceHash', type: 'bytes32' }, { name: 'requestExpiry', type: 'uint64' }, { name: 'nonce', type: 'uint256' }, { name: 'outcomeHash', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'recordWorkProof', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'taskId', type: 'bytes32' }, { name: 'paymentId', type: 'bytes32' }, { name: 'proofHash', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'promoteAgent', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'nextCareer', type: 'uint8' }, { name: 'nextAuthorityCap', type: 'uint128' }], outputs: [] },
  { type: 'function', name: 'demoteAgent', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'reasonHash', type: 'bytes32' }], outputs: [] },
  { type: 'function', name: 'reinstateAgent', stateMutability: 'nonpayable', inputs: [{ name: 'agentId', type: 'uint256' }, { name: 'remediationHash', type: 'bytes32' }], outputs: [] },
  { type: 'event', name: 'TaskCreated', inputs: [{ indexed: true, name: 'taskId', type: 'bytes32' }, { indexed: true, name: 'rootMandateId', type: 'uint256' }, { indexed: true, name: 'owner', type: 'address' }, { indexed: false, name: 'rootAgentId', type: 'uint256' }, { indexed: false, name: 'budget', type: 'uint128' }, { indexed: false, name: 'taskHash', type: 'bytes32' }] },
];
const referenceAbi = [
  { type: 'function', name: 'agents', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: 'agentId', type: 'uint256' }, { name: 'career', type: 'uint8' }, { name: 'authorityCap', type: 'uint128' }, { name: 'completedWorks', type: 'uint32' }, { name: 'violations', type: 'uint32' }, { name: 'active', type: 'bool' }] },
  { type: 'function', name: 'stoppedAgents', stateMutability: 'view', inputs: [{ name: 'agent', type: 'address' }], outputs: [{ name: '', type: 'bool' }] },
  { type: 'function', name: 'isAuthorized', stateMutability: 'view', inputs: [{ name: 'mandateId', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
];

function template() {
  const deployed = /^0x[\da-fA-F]{40}$/.test(PUBLIC_CONTRACT_ADDRESS ?? '');
  return `<div class="section-heading"><div><div class="eyebrow">PUBLIC SELF-CUSTODIAL MAINNET DAPP</div><h2>Connect your wallet.<br><em>Keep custody.</em></h2></div><div class="demo-badge live-badge"><span class="status-dot"></span>${deployed ? 'ARC MAINNET V2 · LIVE' : 'MAINNET WRITES · LOCKED'}</div></div>
    <div class="live-warning">Experimental and unaudited. Use small demo amounts only. AgentLedger never receives a private key and is not production custody. Every Mainnet write requires your wallet confirmation and a successful simulation.</div>
    <div class="live-card public-dapp"><div class="live-toolbar"><button class="button button-dark" id="walletConnect">Connect Wallet</button><button class="quiet" id="walletDisconnect" hidden>Disconnect</button><button class="quiet" id="walletSwitch" hidden>Switch to Arc Mainnet</button><span id="walletChain">Not connected</span><span id="walletAddress">—</span><span id="walletBalance">USDC —</span><span id="walletGas">Gas —</span></div>
      <div class="deployment-gate ${deployed ? 'ready' : ''}"><b>${deployed ? 'Verified public V2 contract active' : 'Mainnet writes intentionally locked'}</b><span>${deployed ? `<a href="${ARC_EXPLORER_URL}/address/${PUBLIC_CONTRACT_ADDRESS}" target="_blank" rel="noreferrer">${short(PUBLIC_CONTRACT_ADDRESS)}</a> · controlled smoke PASS · wallet-signed only` : `V2 deployment or controlled smoke evidence is incomplete.`}</span></div>
      <div class="public-grid"><section class="permission-card"><div class="eyebrow">MY AGENTS</div><h3>Onchain-owned only</h3><p>Enter an ERC-8004 agentId. It appears only after ownerOf matches the connected wallet. Reference Demo #1395 stays separate.</p><div class="inline-form"><input id="agentIdInput" inputmode="numeric" placeholder="ERC-8004 agentId"><button class="button button-dark" id="agentAdd">Verify & add</button></div><div id="agentList" class="agent-list"><span>Connect a wallet to verify ownership.</span></div><div class="permission-grid"><label>Initial Authority cap (USDC)<input id="initialCap" value="0.01" inputmode="decimal"></label><button class="button button-primary align-end" id="agentRegister" disabled>Register selected Agent</button></div></section>
        <section class="authority-hero"><div class="eyebrow">CURRENT AUTHORITY</div><strong id="authorityCap">—</strong><span>USDC per payment</span><div class="authority-stats"><b id="authorityStatus">Not loaded</b><span id="authorityCareer">Career —</span><span id="authorityWorks">Completed —</span><span id="authorityViolations">Violations —</span><span id="authorityOwner">Owner —</span></div></section></div>
      <section class="budget-overview" id="budgetOverview" hidden><div class="budget-heading"><div><div class="eyebrow">TASK BUDGET · ONCHAIN</div><h3>Committed funds are not available funds.</h3></div><span class="budget-status" id="budgetStatus">Active</span></div><div class="budget-metrics"><div class="available"><span>Available</span><strong id="budgetAvailable">—</strong><small>Uncommitted capacity</small></div><div class="reserved"><span>Reserved</span><strong id="budgetReserved">—</strong><small>Committed to child mandates</small></div><div class="spent"><span>Spent</span><strong id="budgetSpent">—</strong><small>Settled onchain</small></div></div><p class="budget-guard" id="budgetGuard">Loading task accounting…</p><div class="pending-panel"><div class="pending-heading"><span>Pending actions / commitments</span><b id="pendingCount">0</b></div><div id="pendingItems"></div></div></section>
      <section class="budget-approval" id="budgetApproval" hidden><div><div class="eyebrow">HUMAN APPROVAL REQUIRED</div><h3 id="budgetApprovalTitle">Budget exhausted · task paused</h3><p id="budgetApprovalCopy">No additional funds are granted automatically. The contract rejects spending beyond the remaining budget.</p></div><label>Additional budget for successor task (USDC)<input id="budgetIncrease" value="0.01" inputmode="decimal"></label><div class="budget-actions"><button class="button button-primary" id="budgetIncreaseAction">Increase budget</button><button class="revoke" id="taskEnd">End task</button><button class="button button-quiet" id="taskKeepPaused">Keep paused</button></div><small>Increase budget prepares a new owner-signed successor task; it never mutates this deployed V2 task. Reputation may inform a future proposal, but never authorizes an automatic increase.</small></section>
      <div class="workflow-grid"><section class="permission-card"><div class="eyebrow">1 · CREATE TASK</div><h3>Bound the work first</h3><div class="permission-grid"><label>Task budget (USDC)<input id="taskBudget" value="0.05" inputmode="decimal"></label><label>Payment amount (USDC)<input id="paymentAmount" value="0.005" inputmode="decimal"></label><label>Recipient<input id="taskRecipient" placeholder="0x…"></label><label>Service scope bit<input id="taskScope" value="1" inputmode="numeric"></label><label>Task description<input id="taskDescription" value="Public demo task"></label><label>Deadline hours<input id="taskDeadline" value="24" inputmode="numeric"></label></div><button class="button button-primary" id="taskCreate" disabled>Simulate → Create Task</button><p class="mini-state" id="taskState">No task created in this session.</p></section>
        <section class="permission-card"><div class="eyebrow">2 · APPROVE & WORK</div><h3>Exact allowance, then payment</h3><p>Approval is never unlimited. The button sets allowance to the exact payment amount; Revoke sets it to zero.</p><div class="allowance-row"><span>Allowance <b id="allowanceValue">—</b></span><button class="button button-quiet" id="approveExact" disabled>Approve exact amount</button><button class="quiet" id="approveRevoke" disabled>Revoke allowance</button></div><button class="button button-primary" id="paymentExecute" disabled>Simulate → Sign Work / Payment</button><button class="button button-dark" id="proofRecord" disabled>Record Work Proof</button><p class="mini-state" id="paymentState">No payment in this session.</p></section>
        <section class="permission-card"><div class="eyebrow">3 · AUTHORITY REVIEW</div><h3>Human-signed progression</h3><div class="permission-grid"><label>Next Authority cap (USDC)<input id="promotionCap" value="0.02" inputmode="decimal"></label><label>Reason / remediation<input id="authorityReason" value="Public demo review"></label></div><div class="live-actions"><button class="button button-primary" id="agentPromote" disabled>Promote & raise Authority</button><button class="revoke" id="agentDemote" disabled>STOP / Demote</button><button class="button button-quiet" id="agentReinstate" disabled>Reinstate reduced cap</button></div><button class="quiet test-limit" id="testLimit" disabled>Test over-cap with eth_call only</button><p class="mini-state" id="authorityMessage">Promotion is never automatic.</p></section></div>
      <p class="live-message" id="walletMessage">${deployed ? 'Connect your wallet to use your own ERC-8004 Agent and USDC on Arc Mainnet.' : 'Connect a wallet for read-only checks. Mainnet writes remain locked.'}</p><a class="latest-tx" id="walletTx" hidden target="_blank" rel="noreferrer">View transaction in Arc Explorer</a></div>
    <div class="reference-panel"><div><div class="eyebrow">REFERENCE DEMO · READ ONLY</div><h3>Agent #1395 · controlled Mainnet PoC</h3><p>Not shared with connected users. ERC-8004 supplies identity/reputation input; AgentLedger enforces financial authority.</p></div><div class="reference-sequence"><span>Work</span><i>→</i><span>Proof</span><i>→</i><span>Authority UP</span><i>→</i><span>Violation / STOP</span><i>→</i><span>Authority DOWN</span><i>→</i><span>Blocked</span></div><div id="referenceState" class="reference-state">Loading onchain reference…</div><div class="reference-links"><a href="${ARC_EXPLORER_URL}/address/${REFERENCE_CONTRACT_ADDRESS}" target="_blank" rel="noreferrer">Explorer</a><a href="https://sourcify.dev/server/v2/contract/5042/${REFERENCE_CONTRACT_ADDRESS.toLowerCase()}" target="_blank" rel="noreferrer">Sourcify exact match</a></div></div>`;
}

export async function initLiveDemo({ container }) {
  if (!container) return;
  container.innerHTML = template();
  const byId = (id) => container.querySelector(`#${id}`);
  const controlIds = ['agentAdd', 'agentRegister', 'taskCreate', 'approveExact', 'approveRevoke', 'paymentExecute', 'proofRecord', 'agentPromote', 'agentDemote', 'agentReinstate', 'testLimit', 'budgetIncreaseAction', 'taskEnd', 'taskKeepPaused'];
  const state = { provider: null, account: null, walletClient: null, selectedAgentId: null, profile: null, task: null, payment: null, allowance: 0n, chainId: null };
  const setMessage = (message, type = '') => { byId('walletMessage').textContent = message; byId('walletMessage').className = `live-message ${type}`; };
  const setAction = (id, message, type = '') => { byId(id).textContent = message; byId(id).className = `mini-state ${type}`; };
  const showTransaction = (hash) => { byId('walletTx').href = `${ARC_EXPLORER_URL}/tx/${hash}`; byId('walletTx').hidden = false; };

  let viem;
  try { viem = await import(VIEM_URL); } catch (error) { setMessage(`Wallet client failed to load: ${error.message}`, 'error'); return; }
  const { createPublicClient, createWalletClient, custom, decodeEventLog, defineChain, formatUnits, http, keccak256, parseUnits, toHex } = viem;
  const arc = defineChain({ id: Number(ARC_CHAIN_ID), name: 'Arc Mainnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [ARC_RPC_URL] } }, blockExplorers: { default: { name: 'Arc Explorer', url: ARC_EXPLORER_URL } } });
  const publicClient = createPublicClient({ chain: arc, transport: http(ARC_RPC_URL) });
  const hasPublicContract = /^0x[\da-fA-F]{40}$/.test(PUBLIC_CONTRACT_ADDRESS ?? '');
  const amount = (id) => parseUnits(byId(id).value.trim(), USDC_DECIMALS);
  const randomHash = (label) => keccak256(toHex(`${label}:${Date.now()}:${crypto.getRandomValues(new Uint32Array(4)).join(',')}`));
  const savedAgentIds = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]').map(BigInt); } catch { return []; } };
  const saveAgentId = (agentId) => localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...savedAgentIds().map(String), agentId.toString()])]));
  const writeGuard = () => assertWriteReady({ chainId: state.chainId, account: state.account, contractAddress: PUBLIC_CONTRACT_ADDRESS });

  function requestedPayment() {
    try { return amount('paymentAmount'); } catch { return 0n; }
  }

  function renderTaskBudget() {
    const overview = byId('budgetOverview'); const approval = byId('budgetApproval');
    if (!state.task || state.task.spent === undefined || state.task.reserved === undefined) { overview.hidden = true; approval.hidden = true; return; }
    overview.hidden = false;
    const decision = taskBudgetDecision(state.task, requestedPayment());
    const format = (value) => `${formatUnits(value, USDC_DECIMALS)} USDC`;
    byId('budgetAvailable').textContent = format(decision.available);
    byId('budgetReserved').textContent = format(decision.reserved);
    byId('budgetSpent').textContent = format(decision.spent);
    const ended = state.task.revoked;
    byId('budgetStatus').textContent = ended ? 'Ended' : decision.status === 'exhausted' ? 'Paused · exhausted' : decision.status === 'fully-committed' ? 'Fully committed' : 'Active';
    byId('budgetStatus').className = `budget-status ${ended || decision.status === 'exhausted' ? 'stopped' : decision.status === 'fully-committed' ? 'committed' : ''}`;
    byId('budgetGuard').textContent = ended ? 'Task ended by its owner. No further payment can execute.' : decision.status === 'exhausted' ? 'Hard stop: the full task budget is spent. Further payment is rejected onchain.' : decision.status === 'fully-committed' ? 'No unused capacity remains: every unspent unit is reserved to active child mandates.' : `${format(decision.available)} remains after subtracting both settled spend and reserved commitments.`;
    const pending = [];
    if (decision.reserved > 0n) pending.push(`<div><span>Reserved to ${state.task.activeChildren} active child mandate${state.task.activeChildren === 1n ? '' : 's'}</span><b>${format(decision.reserved)} · not available</b></div>`);
    if (decision.requested > 0n) pending.push(`<div class="${decision.requestBlocked ? 'blocked-request' : ''}"><span>Next payment request</span><b>${format(decision.requested)} · ${decision.requestBlocked ? 'blocked' : state.allowance >= decision.requested ? 'exact allowance ready' : 'awaiting approval'}</b></div>`);
    byId('pendingCount').textContent = String(pending.length);
    byId('pendingItems').innerHTML = pending.length ? pending.join('') : '<div><span>No pending actions</span><b>Clear</b></div>';
    approval.hidden = ended || !decision.humanApprovalRequired;
    byId('budgetApprovalTitle').textContent = decision.status === 'exhausted' ? 'Budget exhausted · task paused' : 'Payment exceeds available budget · task paused';
    byId('budgetApprovalCopy').textContent = decision.status === 'exhausted' ? 'No additional funds are granted automatically. The contract rejects all further spending for this task.' : `The ${format(decision.requested)} request exceeds ${format(decision.available)} available. Reserved funds cannot be reused.`;
    byId('budgetIncreaseAction').disabled = ended || decision.reserved > 0n;
    byId('taskEnd').disabled = ended;
    byId('taskKeepPaused').disabled = ended || state.task.paused === true;
    const canPay = !ended && !state.task.paused && decision.paymentAllowed && state.chainId === ARC_CHAIN_ID;
    byId('approveExact').disabled = !canPay;
    byId('approveRevoke').disabled = ended || state.chainId !== ARC_CHAIN_ID;
    byId('paymentExecute').disabled = !canPay;
    byId('testLimit').disabled = ended || state.chainId !== ARC_CHAIN_ID;
  }

  async function refreshTaskBudget() {
    if (!state.task || !hasPublicContract) { renderTaskBudget(); return; }
    const [task, mandate] = await Promise.all([
      publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'tasks', args: [state.task.taskId] }),
      publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'mandates', args: [state.task.mandateId] }),
    ]);
    Object.assign(state.task, { budget: task[2], spent: task[3], deadline: task[4], revoked: task[6] || mandate[10], recipient: mandate[3], reserved: mandate[6], scope: mandate[9], activeChildren: mandate[11] });
    renderTaskBudget();
  }

  async function refreshAllowance() {
    if (!state.account || !hasPublicContract) { state.allowance = 0n; byId('allowanceValue').textContent = '—'; renderTaskBudget(); return; }
    const value = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance', args: [state.account, PUBLIC_CONTRACT_ADDRESS] });
    state.allowance = value;
    byId('allowanceValue').textContent = `${formatUnits(value, USDC_DECIMALS)} USDC`;
    renderTaskBudget();
  }

  async function refreshWallet() {
    if (!state.account || !state.provider) return;
    state.chainId = BigInt(await state.provider.request({ method: 'eth_chainId' }));
    byId('walletChain').textContent = state.chainId === ARC_CHAIN_ID ? 'Arc Mainnet · 5042' : `Wrong network · ${state.chainId}`;
    byId('walletSwitch').hidden = state.chainId === ARC_CHAIN_ID;
    byId('walletAddress').textContent = short(state.account);
    const [balance, gas] = await Promise.all([
      publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [state.account] }),
      publicClient.getBalance({ address: state.account }),
    ]);
    byId('walletBalance').textContent = `USDC ${formatUnits(balance, USDC_DECIMALS)}`;
    byId('walletGas').textContent = `Gas ${Number(formatUnits(gas, 18)).toFixed(4)} USDC`;
    await refreshAllowance();
    controlIds.forEach((id) => { byId(id).disabled = true; });
    byId('agentAdd').disabled = state.chainId !== ARC_CHAIN_ID;
    if (state.selectedAgentId === null) byId('agentList').textContent = 'Enter an ERC-8004 agentId owned by this wallet.';
    if (state.selectedAgentId !== null && hasPublicContract && state.chainId === ARC_CHAIN_ID) await loadAgent(state.selectedAgentId);
    if (!hasPublicContract) setMessage('Wallet connected. Public V2 is unavailable, so all writes remain locked.', 'ok');
    else setMessage('Wallet connected. Only Agents owned by this wallet and this wallet’s USDC can be used.', 'ok');
  }

  async function loadAgent(agentId) {
    const owner = await publicClient.readContract({ address: IDENTITY_REGISTRY_ADDRESS, abi: identityAbi, functionName: 'ownerOf', args: [agentId] });
    assertOwnedAgent(owner, state.account);
    state.selectedAgentId = agentId; saveAgentId(agentId);
    byId('agentList').innerHTML = `<button class="agent-choice selected" type="button"><b>Agent #${agentId}</b><span>ownerOf ${short(owner)}</span></button>`;
    byId('authorityOwner').textContent = `Owner ${short(owner)}`;
    if (!hasPublicContract) { state.profile = null; byId('authorityCap').textContent = 'Pending V2'; byId('authorityStatus').textContent = 'Mainnet registration unavailable'; return; }
    const [profile, stopped, eligible] = await Promise.all([
      publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'agents', args: [agentId] }),
      publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'stoppedAgents', args: [agentId] }),
      publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'isPromotionEligible', args: [agentId] }),
    ]);
    state.profile = { operationalAgent: profile[0], career: Number(profile[1]), cap: profile[2], completed: profile[3], violations: profile[4], registered: profile[5], stopped, eligible };
    byId('authorityCap').textContent = profile[5] ? formatUnits(profile[2], USDC_DECIMALS) : 'Not registered';
    byId('authorityStatus').textContent = !profile[5] ? 'Registration required' : stopped ? 'STOPPED' : eligible ? 'Promotion eligible' : 'Active';
    byId('authorityCareer').textContent = `Career ${careerNames[Number(profile[1])]}`;
    byId('authorityWorks').textContent = `Completed ${profile[3]}`;
    byId('authorityViolations').textContent = `Violations ${profile[4]}`;
    byId('agentRegister').disabled = profile[5] || state.chainId !== ARC_CHAIN_ID;
    byId('taskCreate').disabled = !profile[5] || stopped || state.chainId !== ARC_CHAIN_ID;
    byId('agentPromote').disabled = !profile[5] || !eligible || stopped;
    byId('agentDemote').disabled = !profile[5]; byId('agentReinstate').disabled = !profile[5] || !stopped;
  }

  async function submit(functionName, args, label) {
    writeGuard();
    const simulation = await publicClient.simulateContract({ account: state.account, address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName, args });
    setMessage(`${label}: simulation passed. Confirm in your wallet.`, 'ok');
    const hash = await state.walletClient.writeContract(simulation.request);
    showTransaction(hash);
    setMessage(`${label}: pending ${short(hash)}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error(`${label} reverted.`);
    setMessage(`${label}: success. Open ${ARC_EXPLORER_URL}/tx/${hash}`, 'ok');
    return { hash, receipt };
  }

  async function connect() {
    if (!window.ethereum) throw new Error('No injected EVM wallet found. Install MetaMask or Rabby.');
    state.provider = window.ethereum;
    const accounts = await state.provider.request({ method: 'eth_requestAccounts' });
    state.account = accounts[0];
    state.walletClient = createWalletClient({ account: state.account, chain: arc, transport: custom(state.provider) });
    byId('walletConnect').textContent = short(state.account); byId('walletDisconnect').hidden = false;
    await refreshWallet();
    for (const agentId of savedAgentIds()) { try { await loadAgent(agentId); break; } catch {} }
  }

  async function switchNetwork() {
    try { await state.provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_HEX }] }); }
    catch (error) {
      if (error.code !== 4902) throw error;
      await state.provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: ARC_CHAIN_HEX, chainName: 'Arc Mainnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: [ARC_RPC_URL], blockExplorerUrls: [ARC_EXPLORER_URL] }] });
    }
    await refreshWallet();
  }

  byId('walletConnect').onclick = () => connect().catch((error) => setMessage(error.shortMessage || error.message, 'error'));
  byId('walletDisconnect').onclick = () => {
    Object.assign(state, { account: null, walletClient: null, selectedAgentId: null, profile: null, task: null, payment: null, allowance: 0n, chainId: null });
    byId('walletConnect').textContent = 'Connect Wallet'; byId('walletDisconnect').hidden = true; byId('walletSwitch').hidden = true;
    byId('walletChain').textContent = 'Not connected'; byId('walletAddress').textContent = '—'; byId('walletBalance').textContent = 'USDC —'; byId('walletGas').textContent = 'Gas —';
    byId('agentList').textContent = 'Connect a wallet to verify ownership.';
    controlIds.forEach((id) => { byId(id).disabled = true; });
    renderTaskBudget();
    setMessage('Disconnected locally. Use your wallet settings to revoke site permissions.', 'ok');
  };
  byId('walletSwitch').onclick = () => switchNetwork().catch((error) => setMessage(error.message, 'error'));
  byId('agentAdd').onclick = async () => {
    let agentId;
    try { agentId = BigInt(byId('agentIdInput').value.trim()); await loadAgent(agentId); }
    catch (error) {
      byId('agentList').textContent = agentId === undefined ? 'Enter a valid numeric ERC-8004 agentId.' : `Agent #${agentId} was not added. ownerOf must match this wallet.`;
      setMessage(error.shortMessage || error.message, 'error');
    }
  };
  byId('agentRegister').onclick = async () => {
    try { if (state.selectedAgentId === null) throw new Error('Verify an owned Agent first.'); await submit('registerAgent', [state.selectedAgentId, state.account, amount('initialCap')], 'Register Agent'); await loadAgent(state.selectedAgentId); }
    catch (error) { setMessage(error.shortMessage || error.message, 'error'); }
  };
  byId('taskCreate').onclick = async () => {
    try {
      if (state.selectedAgentId === null || !state.profile?.registered) throw new Error('Select a registered Agent.');
      const recipient = byId('taskRecipient').value.trim(); const budget = amount('taskBudget');
      const deadline = BigInt(Math.floor(Date.now() / 1000) + Number(byId('taskDeadline').value) * 3600);
      const salt = randomHash('task-salt'); const taskHash = keccak256(toHex(byId('taskDescription').value.trim()));
      const nextMandateId = await publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'nextMandateId' });
      const result = await submit('createTask', [salt, taskHash, budget, deadline, BigInt(byId('taskScope').value), state.selectedAgentId, recipient, 0], 'Create Task');
      let taskId; let mandateId = nextMandateId;
      for (const log of result.receipt.logs) { try { const decoded = decodeEventLog({ abi: graphAbi, data: log.data, topics: log.topics }); if (decoded.eventName === 'TaskCreated') { taskId = decoded.args.taskId; mandateId = decoded.args.rootMandateId; } } catch {} }
      if (!taskId) throw new Error('TaskCreated event was not found in the receipt.');
      state.task = { taskId, mandateId, recipient, budget, spent: 0n, reserved: 0n, activeChildren: 0n, deadline, scope: BigInt(byId('taskScope').value), revoked: false, paused: false };
      setAction('taskState', `Task ${short(taskId)} · mandate ${mandateId}`, 'ok');
      await refreshTaskBudget();
    } catch (error) { setAction('taskState', error.shortMessage || error.message, 'error'); }
  };
  byId('approveExact').onclick = async () => {
    try {
      writeGuard(); const approval = exactApprovalAmount(amount('paymentAmount'));
      const simulation = await publicClient.simulateContract({ account: state.account, address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [PUBLIC_CONTRACT_ADDRESS, approval] });
      const hash = await state.walletClient.writeContract(simulation.request); showTransaction(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash }); if (receipt.status !== 'success') throw new Error('Exact approval reverted.');
      await refreshAllowance(); setAction('paymentState', `Exact approval confirmed · ${formatUnits(approval, USDC_DECIMALS)} USDC`, 'ok');
    } catch (error) { setAction('paymentState', error.shortMessage || error.message, 'error'); }
  };
  byId('approveRevoke').onclick = async () => {
    try {
      writeGuard(); const simulation = await publicClient.simulateContract({ account: state.account, address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [PUBLIC_CONTRACT_ADDRESS, 0n] });
      const hash = await state.walletClient.writeContract(simulation.request); showTransaction(hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash }); if (receipt.status !== 'success') throw new Error('Allowance revoke reverted.');
      await refreshAllowance(); setAction('paymentState', 'Allowance revoked to 0.', 'ok');
    } catch (error) { setAction('paymentState', error.shortMessage || error.message, 'error'); }
  };
  byId('paymentExecute').onclick = async () => {
    try {
      if (!state.task) throw new Error('Create a task first.');
      const paymentAmount = amount('paymentAmount'); const nonce = BigInt(Date.now()); const resourceHash = randomHash('resource'); const outcomeHash = randomHash('outcome');
      const paymentId = await publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'computePaymentId', args: [state.task.taskId, state.task.mandateId, state.task.recipient, paymentAmount, state.task.scope, resourceHash, state.task.deadline, nonce] });
      const result = await submit('executePayment', [state.task.mandateId, paymentId, state.task.recipient, paymentAmount, state.task.scope, resourceHash, state.task.deadline, nonce, outcomeHash], 'Work / Payment');
      state.payment = { paymentId, outcomeHash, hash: result.hash }; setAction('paymentState', `Paid ${formatUnits(paymentAmount, USDC_DECIMALS)} USDC · ${short(result.hash)}`, 'ok');
      byId('proofRecord').disabled = false; await Promise.all([refreshAllowance(), refreshTaskBudget()]);
    } catch (error) { setAction('paymentState', error.shortMessage || error.message, 'error'); }
  };
  byId('proofRecord').onclick = async () => {
    try { if (!state.task || !state.payment) throw new Error('Complete a payment first.'); await submit('recordWorkProof', [state.selectedAgentId, state.task.taskId, state.payment.paymentId, state.payment.outcomeHash], 'Record Work Proof'); await loadAgent(state.selectedAgentId); setAction('paymentState', 'Work proof recorded. Promotion eligibility refreshed.', 'ok'); }
    catch (error) { setAction('paymentState', error.shortMessage || error.message, 'error'); }
  };
  byId('agentPromote').onclick = async () => {
    try { await submit('promoteAgent', [state.selectedAgentId, state.profile.career + 1, amount('promotionCap')], 'Promote Agent'); await loadAgent(state.selectedAgentId); setAction('authorityMessage', 'Authority increased by explicit owner signature.', 'ok'); }
    catch (error) { setAction('authorityMessage', error.shortMessage || error.message, 'error'); }
  };
  byId('agentDemote').onclick = async () => {
    try { await submit('demoteAgent', [state.selectedAgentId, keccak256(toHex(byId('authorityReason').value.trim()))], 'STOP / Demote'); await loadAgent(state.selectedAgentId); setAction('authorityMessage', 'STOP active. Authority cap reduced.', 'ok'); }
    catch (error) { setAction('authorityMessage', error.shortMessage || error.message, 'error'); }
  };
  byId('agentReinstate').onclick = async () => {
    try { const before = state.profile.cap; await submit('reinstateAgent', [state.selectedAgentId, keccak256(toHex(byId('authorityReason').value.trim()))], 'Reinstate Agent'); await loadAgent(state.selectedAgentId); setAction('authorityMessage', `Reinstated at reduced cap ${formatUnits(before, USDC_DECIMALS)} USDC.`, 'ok'); }
    catch (error) { setAction('authorityMessage', error.shortMessage || error.message, 'error'); }
  };
  byId('testLimit').onclick = async () => {
    try {
      if (!state.task || !state.profile) throw new Error('Create a task and load Authority first.');
      const overCap = state.profile.cap + 1n;
      if (state.task.budget < overCap) throw new Error(`Task budget must exceed current cap (${formatUnits(state.profile.cap, USDC_DECIMALS)} USDC) for this read-only test.`);
      const nonce = BigInt(Date.now()); const resourceHash = randomHash('limit'); const outcomeHash = randomHash('limit-outcome');
      const paymentId = await publicClient.readContract({ address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'computePaymentId', args: [state.task.taskId, state.task.mandateId, state.task.recipient, overCap, state.task.scope, resourceHash, state.task.deadline, nonce] });
      try { await publicClient.simulateContract({ account: state.account, address: PUBLIC_CONTRACT_ADDRESS, abi: graphAbi, functionName: 'executePayment', args: [state.task.mandateId, paymentId, state.task.recipient, overCap, state.task.scope, resourceHash, state.task.deadline, nonce, outcomeHash] }); throw new Error('Unexpectedly passed the over-cap simulation. No transaction was sent.'); }
      catch (error) { const serialized = `${error} ${error.cause ?? ''} ${error.data ?? ''}`; if (!serialized.includes(AUTHORITY_CAP_EXCEEDED_SELECTOR) && !serialized.includes('AuthorityCapExceeded')) throw error; }
      setAction('authorityMessage', `AuthorityCapExceeded confirmed for ${formatUnits(overCap, USDC_DECIMALS)} USDC via eth_call. No transaction sent.`, 'ok');
    } catch (error) { setAction('authorityMessage', error.shortMessage || error.message, 'error'); }
  };
  byId('paymentAmount').addEventListener('input', renderTaskBudget);
  byId('budgetIncreaseAction').onclick = () => {
    try {
      if (!state.task) throw new Error('Create a task first.');
      if (state.task.reserved > 0n) throw new Error('Review or release reserved child mandates before preparing more budget.');
      const additional = exactApprovalAmount(amount('budgetIncrease'));
      byId('taskBudget').value = formatUnits(state.task.budget + additional, USDC_DECIMALS);
      byId('taskDescription').value = `Successor to ${short(state.task.taskId)} — ${byId('taskDescription').value.trim()}`;
      setAction('taskState', 'Increase budget prepared as a new successor task. Review the fields, then simulate and sign Create Task.', 'ok');
      byId('taskCreate').focus();
    } catch (error) { setAction('taskState', error.message, 'error'); }
  };
  byId('taskEnd').onclick = async () => {
    try {
      if (!state.task) throw new Error('Create a task first.');
      await submit('revokeTask', [state.task.taskId], 'End Task');
      await refreshTaskBudget();
      setAction('taskState', `Task ${short(state.task.taskId)} ended by explicit owner signature.`, 'ok');
    } catch (error) { setAction('taskState', error.shortMessage || error.message, 'error'); }
  };
  byId('taskKeepPaused').onclick = () => {
    if (!state.task) return;
    state.task.paused = true;
    renderTaskBudget();
    setAction('taskState', 'Kept paused in this session. No transaction was sent; onchain budget limits remain enforced.', 'ok');
  };

  async function loadReference() {
    try {
      const [owner, profile, stopped, authorized] = await Promise.all([
        publicClient.readContract({ address: IDENTITY_REGISTRY_ADDRESS, abi: identityAbi, functionName: 'ownerOf', args: [REFERENCE_AGENT_ID] }),
        publicClient.readContract({ address: REFERENCE_CONTRACT_ADDRESS, abi: referenceAbi, functionName: 'agents', args: [REFERENCE_OPERATIONAL_AGENT] }),
        publicClient.readContract({ address: REFERENCE_CONTRACT_ADDRESS, abi: referenceAbi, functionName: 'stoppedAgents', args: [REFERENCE_OPERATIONAL_AGENT] }),
        publicClient.readContract({ address: REFERENCE_CONTRACT_ADDRESS, abi: referenceAbi, functionName: 'isAuthorized', args: [2n] }),
      ]);
      byId('referenceState').innerHTML = `<span>Owner <b>${short(owner)}</b></span><span>Career <b>${careerNames[Number(profile[1])]}</b></span><span>Authority <b>${formatUnits(profile[2], USDC_DECIMALS)} USDC</b></span><span>Completed <b>${profile[3]}</b></span><span>Violations <b>${profile[4]}</b></span><span>STOP <b>${stopped ? 'ACTIVE' : 'cleared after remediation'}</b></span><span>Mandate #2 <b>${authorized ? 'authorized at reduced cap' : 'blocked'}</b></span>`;
    } catch (error) { byId('referenceState').textContent = `Reference read unavailable: ${error.shortMessage || error.message}`; }
  }
  if (window.ethereum) {
    window.ethereum.on?.('accountsChanged', (accounts) => { state.account = accounts[0] ?? null; if (state.account) connect().catch(() => {}); });
    window.ethereum.on?.('chainChanged', () => refreshWallet().catch(() => {}));
  }
  await loadReference();
}
