import {
  ARC_CHAIN_HEX, ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_RPC_URL, CONTRACT_ADDRESS, DEMO_PAYMENT_CAP,
  USDC_ADDRESS, USDC_DECIMALS, assertArcChain, assertDistinctRecipient, assertDemoPaymentAmount,
  buildConfirmationPayload, validateTaskPermissions,
} from './live-policy.mjs';

const VIEM_URL = 'https://esm.sh/viem@2.21.54';

export const mandateGraphAbi = [
  { type: 'function', name: 'createTask', stateMutability: 'nonpayable', inputs: [
    { name: 'taskId', type: 'bytes32' }, { name: 'taskHash', type: 'bytes32' }, { name: 'budget', type: 'uint128' },
    { name: 'deadline', type: 'uint64' }, { name: 'serviceScope', type: 'uint256' }, { name: 'rootAgent', type: 'address' },
    { name: 'recipient', type: 'address' }, { name: 'depth', type: 'uint8' },
  ], outputs: [{ name: 'rootMandateId', type: 'uint256' }] },
  { type: 'function', name: 'delegate', stateMutability: 'nonpayable', inputs: [
    { name: 'parentId', type: 'uint256' }, { name: 'childAgent', type: 'address' }, { name: 'childBudget', type: 'uint128' },
    { name: 'childExpiry', type: 'uint64' }, { name: 'childScope', type: 'uint256' }, { name: 'childRecipient', type: 'address' },
  ], outputs: [{ name: 'childId', type: 'uint256' }] },
  { type: 'function', name: 'executePayment', stateMutability: 'nonpayable', inputs: [
    { name: 'mandateId', type: 'uint256' }, { name: 'paymentId', type: 'bytes32' }, { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint128' }, { name: 'serviceClass', type: 'uint256' }, { name: 'resourceHash', type: 'bytes32' },
    { name: 'requestExpiry', type: 'uint64' }, { name: 'nonce', type: 'uint256' }, { name: 'outcomeHash', type: 'bytes32' },
  ], outputs: [] },
  { type: 'function', name: 'revokeTask', stateMutability: 'nonpayable', inputs: [{ name: 'taskId', type: 'bytes32' }], outputs: [] },
  { type: 'event', name: 'TaskCreated', inputs: [
    { name: 'taskId', type: 'bytes32', indexed: true }, { name: 'rootMandateId', type: 'uint256', indexed: true },
    { name: 'owner', type: 'address', indexed: true }, { name: 'budget', type: 'uint128', indexed: false }, { name: 'taskHash', type: 'bytes32', indexed: false },
  ], anonymous: false },
  { type: 'event', name: 'MandateDelegated', inputs: [
    { name: 'parentId', type: 'uint256', indexed: true }, { name: 'mandateId', type: 'uint256', indexed: true },
    { name: 'agent', type: 'address', indexed: true }, { name: 'budget', type: 'uint128', indexed: false }, { name: 'expiry', type: 'uint64', indexed: false },
  ], anonymous: false },
];

const erc20Abi = [{ type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [
  { name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' },
], outputs: [{ name: '', type: 'bool' }] }, { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }];

const short = (value) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const asBytes32 = (value) => value.startsWith('0x') ? value : `0x${value.padStart(64, '0')}`;

export async function initLiveDemo({ ui }) {
  ui.approve.disabled = true;
  ui.approve.title = 'Create and delegate a task first';
  const setUnavailable = (message) => { ui.message.textContent = message; ui.message.className = 'live-message error'; ui.message.setAttribute('role', 'alert'); };
  ui.connect.onclick = () => setUnavailable(window.ethereum ? 'Wallet client is still loading. Reload the page and try again.' : 'No injected EVM wallet found. Install MetaMask or Rabby, then reload this page.');
  let viem;
  try { viem = await import(VIEM_URL); } catch (error) { setUnavailable(`Live wallet client failed to load: ${error.message}`); return; }
  const { createPublicClient, createWalletClient, custom, http, parseUnits, formatUnits, keccak256, encodeAbiParameters, stringToHex, decodeEventLog, isAddress, defineChain } = viem;
  const arc = defineChain({ id: Number(ARC_CHAIN_ID), name: 'Arc Mainnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [ARC_RPC_URL] } }, blockExplorers: { default: { name: 'Arc Explorer', url: ARC_EXPLORER_URL } } });
  let provider; let account; let taskId; let rootMandateId; let childMandateId; let paymentId;
  const publicClient = createPublicClient({ chain: arc, transport: http(ARC_RPC_URL) });
  const setMessage = (message, type = '') => { ui.message.textContent = message; ui.message.className = `live-message ${type}`; ui.message.setAttribute('role', type === 'error' ? 'alert' : 'status'); };
  const setStep = (step) => ui.steps?.forEach((item, index) => item.classList.toggle('active', index + 1 === step));
  const requireReady = async () => { if (!provider || !account) throw new Error('Connect an injected wallet first.'); assertArcChain(await provider.request({ method: 'eth_chainId' })); };
  const refresh = async () => {
    if (!account) return;
    const chainId = await provider.request({ method: 'eth_chainId' });
    ui.chain.textContent = BigInt(chainId) === ARC_CHAIN_ID ? 'Arc Mainnet · 5042' : `Wrong network · ${BigInt(chainId)}`;
    ui.address.textContent = short(account);
    try { const balance = await publicClient.readContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'balanceOf', args: [account] }); ui.balance.textContent = `${formatUnits(balance, USDC_DECIMALS)} USDC`; } catch { ui.balance.textContent = 'Balance unavailable'; }
  };
  const connect = async () => {
    if (!window.ethereum) throw new Error('No injected EVM wallet found. Install MetaMask or Rabby.');
    provider = window.ethereum;
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    account = accounts[0]; setStep(2);
    await refresh();
    if (BigInt(await provider.request({ method: 'eth_chainId' })) !== ARC_CHAIN_ID) ui.switchButton.hidden = false;
    ui.connect.textContent = short(account);
    setMessage('Wallet connected. Check the network and balances before preparing a write.', 'ok');
  };
  const switchNetwork = async () => {
    try { await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_HEX }] }); }
    catch (error) { if (error.code !== 4902) throw error; await provider.request({ method: 'wallet_addEthereumChain', params: [{ chainId: ARC_CHAIN_HEX, chainName: 'Arc Mainnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: [ARC_RPC_URL], blockExplorerUrls: [ARC_EXPLORER_URL] }] }); }
    await refresh(); ui.switchButton.hidden = true; setMessage('Arc Mainnet selected.', 'ok');
  };
  const confirmWrite = async (payload, request) => {
    ui.modalTitle.textContent = `Confirm ${payload.action}`;
    ui.modalBody.textContent = JSON.stringify(payload, null, 2);
    ui.modal.hidden = false;
    const confirmed = await new Promise((resolve) => { ui.modalConfirm.onclick = () => { ui.modal.hidden = true; resolve(true); }; ui.modalCancel.onclick = () => { ui.modal.hidden = true; resolve(false); }; });
    if (!confirmed) return;
    setMessage(`Confirm ${payload.action} in your wallet…`);
    const hash = await request();
    ui.tx.textContent = hash; ui.tx.href = `${ARC_EXPLORER_URL}/tx/${hash}`; ui.tx.hidden = false;
    setMessage(`${payload.action} submitted. Waiting for confirmation…`);
    await publicClient.waitForTransactionReceipt({ hash });
    setMessage(`${payload.action} confirmed.`, 'ok');
    const progress = { 'Create Task': 3, Delegate: 4, 'Approve USDC': 5, 'Execute Payment': 6, 'Revoke Task': 7 };
    setStep(progress[payload.action] || 2);
    await refresh();
  };
  const now = () => BigInt(Math.floor(Date.now() / 1000) + 3600);
  const wallet = () => createWalletClient({ account, chain: arc, transport: custom(provider) });
  ui.connect.onclick = () => connect().catch((error) => setMessage(error.shortMessage || error.message, 'error'));
  ui.switchButton.onclick = () => switchNetwork().catch((error) => setMessage(error.message, 'error'));
  ui.create.onclick = async () => { try { await requireReady(); const recipient = ui.recipient.value.trim(); if (!isAddress(recipient)) throw new Error('Enter a valid recipient address.'); assertDistinctRecipient(account, recipient); const budget = parseUnits(ui.budget.value || '1', USDC_DECIMALS); const deadline = ui.deadline.value ? BigInt(Math.floor(new Date(ui.deadline.value).getTime() / 1000)) : now(); const serviceScope = BigInt(ui.scope.value); const delegationDepth = Number(ui.depth.value); validateTaskPermissions({ budget: budget.toString(), deadline: deadline.toString(), serviceScope: serviceScope.toString(), recipient, delegationDepth }); taskId = keccak256(stringToHex(`agentledger-demo-${Date.now()}`)); const taskHash = keccak256(stringToHex('AgentLedger Arc Mainnet Demo Task')); const payload = buildConfirmationPayload('Create Task', { taskId, taskHash, budget: budget.toString(), deadline: deadline.toString(), serviceScope: serviceScope.toString(), rootAgent: account, recipient, depth: delegationDepth }); await confirmWrite(payload, () => wallet().writeContract({ address: CONTRACT_ADDRESS, abi: mandateGraphAbi, functionName: 'createTask', args: [taskId, taskHash, budget, deadline, serviceScope, account, recipient, delegationDepth] }).then(async (hash) => { const receipt = await publicClient.waitForTransactionReceipt({ hash }); const event = receipt.logs.find((log) => log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()); if (event) { try { rootMandateId = decodeEventLog({ abi: mandateGraphAbi, data: event.data, topics: event.topics, eventName: 'TaskCreated' }).args.rootMandateId; ui.root.textContent = rootMandateId.toString(); } catch {} } return hash; })); ui.delegate.disabled = false; ui.revoke.disabled = false; } catch (error) { setMessage(error.shortMessage || error.message, 'error'); } };
  ui.delegate.onclick = async () => { try { await requireReady(); if (!rootMandateId) throw new Error('Create a task first and wait for confirmation.'); const recipient = ui.recipient.value.trim(); const expiry = now(); const payload = buildConfirmationPayload('Delegate', { parentId: rootMandateId.toString(), childAgent: account, childBudget: '500000', childExpiry: expiry.toString(), childScope: '1', childRecipient: recipient }); await confirmWrite(payload, () => wallet().writeContract({ address: CONTRACT_ADDRESS, abi: mandateGraphAbi, functionName: 'delegate', args: [rootMandateId, account, 500000n, expiry, 1n, recipient] }).then(async (hash) => { const receipt = await publicClient.waitForTransactionReceipt({ hash }); const event = receipt.logs.find((log) => log.address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase()); if (event) { try { childMandateId = decodeEventLog({ abi: mandateGraphAbi, data: event.data, topics: event.topics, eventName: 'MandateDelegated' }).args.mandateId; ui.child.textContent = childMandateId.toString(); } catch {} } return hash; })); ui.approve.disabled = false; ui.approve.title = 'Approve the configured USDC amount'; ui.execute.disabled = !childMandateId; } catch (error) { setMessage(error.shortMessage || error.message, 'error'); } };
  ui.approve.onclick = async () => { try { await requireReady(); const amount = assertDemoPaymentAmount(parseUnits(ui.amount.value || '0', USDC_DECIMALS)); const payload = buildConfirmationPayload('Approve USDC', { token: USDC_ADDRESS, spender: CONTRACT_ADDRESS, amount: amount.toString() }); await confirmWrite(payload, () => wallet().writeContract({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [CONTRACT_ADDRESS, amount] })); } catch (error) { setMessage(error.shortMessage || error.message, 'error'); } };
  ui.execute.onclick = async () => { try { await requireReady(); if (!childMandateId) throw new Error('Delegate a child mandate first.'); const recipient = ui.recipient.value.trim(); assertDistinctRecipient(account, recipient); const amount = assertDemoPaymentAmount(parseUnits(ui.amount.value || '0', USDC_DECIMALS)); const expiry = now(); const resourceHash = keccak256(stringToHex('AgentLedger demo resource')); const outcomeHash = keccak256(stringToHex('AgentLedger demo outcome')); const nonce = BigInt(Date.now()); paymentId = keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }, { type: 'uint128' }, { type: 'uint256' }, { type: 'bytes32' }, { type: 'uint64' }, { type: 'uint256' }], [taskId, childMandateId, recipient, amount, 1n, resourceHash, expiry, nonce])); const payload = buildConfirmationPayload('Execute Payment', { mandateId: childMandateId.toString(), paymentId, recipient, amount: amount.toString(), serviceClass: '1', resourceHash, requestExpiry: expiry.toString(), nonce: nonce.toString(), outcomeHash }); await confirmWrite(payload, () => wallet().writeContract({ address: CONTRACT_ADDRESS, abi: mandateGraphAbi, functionName: 'executePayment', args: [childMandateId, paymentId, recipient, amount, 1n, resourceHash, expiry, nonce, outcomeHash] })); } catch (error) { setMessage(error.shortMessage || error.message, 'error'); } };
  ui.revoke.onclick = async () => { try { await requireReady(); if (!taskId) throw new Error('Create a task first.'); const payload = buildConfirmationPayload('Revoke Task', { taskId }); await confirmWrite(payload, () => wallet().writeContract({ address: CONTRACT_ADDRESS, abi: mandateGraphAbi, functionName: 'revokeTask', args: [taskId] })); } catch (error) { setMessage(error.shortMessage || error.message, 'error'); } };
  if (window.ethereum) window.ethereum.on?.('accountsChanged', (accounts) => { account = accounts[0]; refresh().catch(() => {}); });
  if (window.ethereum) window.ethereum.on?.('chainChanged', () => refresh().catch(() => {}));
  ui.cap.textContent = `${Number(DEMO_PAYMENT_CAP) / 1e6} USDC max`;
}
