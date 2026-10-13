import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { arcMainnet } from './arc-mainnet-config.mjs';
import { byteLength, normalizeImmutableReferences } from './runtime-bytecode.mjs';

const args = new Set(process.argv.slice(2));
const mode = args.has('--preflight') ? 'preflight' : args.has('--execute') ? 'execute' : args.has('--verify') ? 'verify' : null;
const confirmation = 'ARC_MAINNET_V2_SMOKE_ONLY';
const contract = '0x015099f831c247460b467154c73028804Ea38a10';
const sender = '0x03607de69C487BcC460eaD7C4Bdfd25805658b75';
const recipient = '0x89A4EF745831CFe8957391Ad2e3CF55Dc3a6e502';
const isolationWallet = recipient;
const agentId = 1395n;
const expectedCreationHash = '0x5dec88089cacd7ab0e0f03eceb35c28e11c4895efc9ae12125fadb9c468df75f';
const expectedRuntimeHash = '0xc546ab56c555c9d661c10795752f51457e7226fde6af9d1c3bbd7ce1395e2689';
const sourceVerificationUrl = 'https://sourcify.dev/server/v2/contract/5042/0x015099f831c247460b467154c73028804ea38a10';
const sourceVerificationJobUrl = 'https://sourcify.dev/server/verify-ui/jobs/897518d7-6bf7-4cbf-92c2-0d59fbb848ae';
const preflightPath = resolve('docs/MAINNET_V2_SMOKE_PREFLIGHT.json');
const evidencePath = resolve('docs/MAINNET_V2_SELF_CUSTODY_EVIDENCE.json');
const artifactPath = resolve('out/MandateGraphV2.sol/MandateGraphV2.json');
const foundryBin = process.env.FOUNDRY_BIN ?? join(homedir(), '.foundry', 'bin');
const cast = process.platform === 'win32' ? join(foundryBin, 'cast.exe') : 'cast';
const forge = process.platform === 'win32' ? join(foundryBin, 'forge.exe') : 'forge';
const account = process.env.V2_MAINNET_ACCOUNT ?? 'agentledger-testnet';
const initialAuthority = 10_000n;
const promotedAuthority = 50_000n;
const reducedAuthority = 25_000n;
const paymentOne = 5_000n;
const paymentTwo = 20_000n;
const exactAllowance = paymentOne + paymentTwo;
const overCapAmount = 26_000n;
const taskBudget = 100_000n;
const maxGasPriceWei = 25_000_000_000n;
const maxLifecycleFeeWei = 120_000_000_000_000_000n;
const receiptPollAttempts = 240;
const receiptPollDelayMs = 1_000;

const errorSelectors = Object.freeze({
  '0x23d966b2': 'NotTaskOwner()',
  '0x53b37e7f': 'NotMandateOperator()',
  '0x390772fc': 'NotAgentOwner()',
  '0xe5bbd38c': 'AuthorityCapExceeded()',
});

class RpcError extends Error {
  constructor(method, payload) {
    super(`${method} failed: ${payload?.message ?? 'unknown RPC error'}`);
    this.rpcError = payload;
  }
}

function run(command, commandArgs, { stdin = null, stderr = 'inherit' } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, commandArgs.map(String), { stdio: [stdin === null ? 'inherit' : 'pipe', 'pipe', stderr] });
    let stdout = '';
    let stderrOutput = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    if (stderr === 'pipe') {
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk) => { stderrOutput += chunk; });
    }
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) reject(new Error(`${command} failed with exit code ${code ?? 1}${stderrOutput ? `: ${stderrOutput.trim()}` : ''}`));
      else resolveResult(stdout.trim());
    });
    if (stdin !== null) child.stdin.end(stdin);
  });
}

async function rpc(method, params = []) {
  const response = await fetch(arcMainnet.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (payload.error || payload.result === undefined) throw new RpcError(method, payload.error);
  return payload.result;
}

async function castOutput(commandArgs) {
  return run(cast, commandArgs);
}

async function calldata(signature, values = []) {
  return castOutput(['calldata', signature, ...values]);
}

async function keccak(value) {
  return run(cast, ['keccak'], { stdin: value, stderr: 'pipe' });
}

async function readCall(target, signature, values = []) {
  return castOutput(['call', target, signature, ...values, '--rpc-url', arcMainnet.rpcUrl]);
}

async function readJsonCall(target, signature, values = []) {
  return JSON.parse(await castOutput(['call', target, signature, ...values, '--json', '--rpc-url', arcMainnet.rpcUrl]));
}

function randomHex() {
  return `0x${randomBytes(32).toString('hex')}`;
}

function parseAddress(value, label = 'address') {
  const match = String(value).match(/0x[\da-fA-F]{40}/);
  if (!match) throw new Error(`Could not decode ${label}.`);
  return match[0];
}

function parseInteger(value) {
  return BigInt(String(value).trim().split(/\s+/)[0]);
}

function parseBoolean(value) {
  return String(value).trim().toLowerCase() === 'true';
}

function decodedBoolean(value) {
  return value === true || String(value).trim().toLowerCase() === 'true';
}

function formatUnits(value, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function receiptFee(receipt) {
  return BigInt(receipt.gasUsed ?? 0) * BigInt(receipt.effectiveGasPrice ?? receipt.gasPrice ?? 0);
}

function summarizeReceipt(receipt) {
  const feeWei = receiptFee(receipt);
  return {
    blockNumber: BigInt(receipt.blockNumber).toString(),
    transactionIndex: BigInt(receipt.transactionIndex).toString(),
    gasUsed: BigInt(receipt.gasUsed).toString(),
    effectiveGasPriceWei: BigInt(receipt.effectiveGasPrice ?? receipt.gasPrice ?? 0).toString(),
    feeWei: feeWei.toString(),
    feeNative: formatUnits(feeWei, 18),
    status: BigInt(receipt.status).toString(),
  };
}

async function waitForReceipt(hash) {
  for (let attempt = 0; attempt < receiptPollAttempts; attempt += 1) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt) return receipt;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, receiptPollDelayMs));
  }
  throw new Error(`Timed out waiting for ${hash}. Evidence remains resumable.`);
}

async function loadJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function saveJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function buildArtifact() {
  await run(forge, ['build']);
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const creationHash = await keccak(artifact.bytecode.object);
  const normalizedRuntime = normalizeImmutableReferences(artifact.deployedBytecode.object, artifact.deployedBytecode.immutableReferences ?? {});
  const normalizedRuntimeHash = await keccak(normalizedRuntime);
  if (creationHash !== expectedCreationHash || normalizedRuntimeHash !== expectedRuntimeHash) {
    throw new Error('Local V2 bytecode changed from the exact-match deployed artifact. Contract review is required; no Mainnet write allowed.');
  }
  return { artifact, creationHash, normalizedRuntimeHash };
}

async function codeSummary(address) {
  const code = await rpc('eth_getCode', [address, 'latest']);
  return { address, bytes: byteLength(code), hash: await keccak(code) };
}

async function verifyRuntime(artifact) {
  const code = await rpc('eth_getCode', [contract, 'latest']);
  if (code === '0x') throw new Error('V2 contract has no runtime bytecode.');
  const normalized = normalizeImmutableReferences(code, artifact.deployedBytecode.immutableReferences ?? {});
  const normalizedHash = await keccak(normalized);
  if (normalizedHash !== expectedRuntimeHash) throw new Error('Deployed V2 runtime differs from the reviewed exact-match artifact.');
  return { address: contract, bytes: byteLength(code), normalizedHash, matchesLocalArtifact: true };
}

async function ownerOf(id = agentId) {
  return parseAddress(await readCall(arcMainnet.identityRegistry, 'ownerOf(uint256)(address)', [id]), 'ERC-8004 owner');
}

async function allowance() {
  return parseInteger(await readCall(arcMainnet.usdcAddress, 'allowance(address,address)(uint256)', [sender, contract]));
}

async function tokenBalance(address) {
  return parseInteger(await readCall(arcMainnet.usdcAddress, 'balanceOf(address)(uint256)', [address]));
}

async function readAgent() {
  const values = await readJsonCall(contract, 'agents(uint256)(address,uint8,uint128,uint32,uint32,bool)', [agentId]);
  return {
    operationalAgent: String(values[0]),
    career: Number(values[1]),
    authorityCapBaseUnits: String(values[2]),
    completedWorks: Number(values[3]),
    violations: Number(values[4]),
    registered: decodedBoolean(values[5]),
    stopped: parseBoolean(await readCall(contract, 'stoppedAgents(uint256)(bool)', [agentId])),
    promotionEligible: parseBoolean(await readCall(contract, 'isPromotionEligible(uint256)(bool)', [agentId])),
  };
}

async function readTask(taskId) {
  const values = await readJsonCall(contract, 'tasks(bytes32)(address,uint256,uint128,uint128,uint64,bytes32,bool)', [taskId]);
  return {
    owner: String(values[0]), rootAgentId: String(values[1]), budgetBaseUnits: String(values[2]),
    spentBaseUnits: String(values[3]), deadline: String(values[4]), taskHash: String(values[5]), revoked: decodedBoolean(values[6]),
  };
}

async function readMandate(mandateId) {
  const values = await readJsonCall(contract, 'mandates(uint256)(bytes32,uint256,uint256,address,uint128,uint128,uint128,uint64,uint8,uint256,bool,uint256)', [mandateId]);
  return {
    taskId: String(values[0]), parentId: String(values[1]), agentId: String(values[2]), recipient: String(values[3]),
    budgetBaseUnits: String(values[4]), spentBaseUnits: String(values[5]), allocatedBaseUnits: String(values[6]),
    expiry: String(values[7]), depth: Number(values[8]), serviceScope: String(values[9]), revoked: decodedBoolean(values[10]), activeChildren: String(values[11]),
  };
}

async function readSourcifyStatus() {
  const response = await fetch(sourceVerificationUrl);
  if (!response.ok) throw new Error(`Sourcify status returned HTTP ${response.status}.`);
  const result = await response.json();
  const status = {
    provider: 'Sourcify', status: result.match, creationMatch: result.creationMatch, runtimeMatch: result.runtimeMatch,
    matchId: result.matchId, verifiedAt: result.verifiedAt, apiUrl: sourceVerificationUrl, jobUrl: sourceVerificationJobUrl,
  };
  if (status.status !== 'exact_match' || status.creationMatch !== 'exact_match' || status.runtimeMatch !== 'exact_match') {
    throw new Error('Sourcify no longer reports exact creation and runtime matches.');
  }
  return status;
}

async function snapshot(artifact, { requireInitial }) {
  const [chainIdHex, block, nonceHex, nativeBalanceHex, usdcBalance, owner, currentAllowance, profile, nextMandateId, usdcCode, registryCode, runtime, sourceVerification] = await Promise.all([
    rpc('eth_chainId'), rpc('eth_getBlockByNumber', ['latest', false]), rpc('eth_getTransactionCount', [sender, 'pending']),
    rpc('eth_getBalance', [sender, 'latest']), tokenBalance(sender), ownerOf(), allowance(), readAgent(),
    readCall(contract, 'nextMandateId()(uint256)').then(parseInteger), codeSummary(arcMainnet.usdcAddress),
    codeSummary(arcMainnet.identityRegistry), verifyRuntime(artifact), readSourcifyStatus(),
  ]);
  const chainId = BigInt(chainIdHex);
  const nativeBalance = BigInt(nativeBalanceHex);
  if (chainId !== arcMainnet.chainId) throw new Error(`Expected Arc Mainnet chain ID 5042; received ${chainId}.`);
  if (owner.toLowerCase() !== sender.toLowerCase()) throw new Error('Signer no longer owns ERC-8004 Agent #1395.');
  if (usdcCode.bytes === 0 || registryCode.bytes === 0) throw new Error('Pinned USDC or Identity Registry has no bytecode.');
  if (nativeBalance < maxLifecycleFeeWei) throw new Error('Native gas balance is below the lifecycle fee safety reserve.');
  if (usdcBalance < exactAllowance) throw new Error('ERC-20 USDC balance is below the 0.025 USDC smoke amount.');
  if (requireInitial) {
    if (profile.registered || nextMandateId !== 1n || currentAllowance !== 0n) {
      throw new Error('V2 initial state is no longer empty as expected. Review onchain state before any write.');
    }
  }
  return {
    checkedAt: new Date().toISOString(), chainId: Number(chainId), latestBlock: BigInt(block.number).toString(),
    latestBlockTimestamp: BigInt(block.timestamp).toString(), sender, recipient, agentId: agentId.toString(),
    nonce: BigInt(nonceHex).toString(), nativeBalanceWei: nativeBalance.toString(), nativeBalance: formatUnits(nativeBalance, 18),
    usdcBalanceBaseUnits: usdcBalance.toString(), usdcBalance: formatUnits(usdcBalance, 6), allowanceBaseUnits: currentAllowance.toString(),
    agent: profile, nextMandateId: nextMandateId.toString(), contracts: { usdc: usdcCode, identityRegistry: registryCode, mandateGraphV2: runtime },
    sourceVerification,
  };
}

async function createPreflight(artifactBundle) {
  const state = await snapshot(artifactBundle.artifact, { requireInitial: true });
  const gitHead = await run('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD']);
  const deadline = BigInt(state.latestBlockTimestamp) + 7n * 24n * 60n * 60n;
  const preflight = {
    version: 1, status: 'ready', generatedAt: new Date().toISOString(), mode: 'read-only', gitHead,
    network: { name: 'Arc Mainnet', chainId: 5042, rpcUrl: arcMainnet.rpcUrl, explorerUrl: arcMainnet.explorerUrl },
    safety: {
      transactionsSent: false, privateKeyRead: false, passwordRequested: false, contractDeployment: false,
      paymentBaseUnits: exactAllowance.toString(), paymentUsdc: formatUnits(exactAllowance, 6),
      maximumLifecycleFeeWei: maxLifecycleFeeWei.toString(), maximumLifecycleFeeNative: formatUnits(maxLifecycleFeeWei, 18),
      maximumGasPriceWei: maxGasPriceWei.toString(), failedTransactionsBroadcast: 0,
    },
    addresses: { contract, sender, recipient, isolationWallet, agentId: agentId.toString(), usdc: arcMainnet.usdcAddress, identityRegistry: arcMainnet.identityRegistry },
    artifact: { path: 'out/MandateGraphV2.sol/MandateGraphV2.json', creationHash: artifactBundle.creationHash, normalizedRuntimeHash: artifactBundle.normalizedRuntimeHash },
    initialState: state,
    lifecycle: {
      taskSalt: randomHex(), taskHash: randomHex(), deadline: deadline.toString(), taskBudgetBaseUnits: taskBudget.toString(),
      rootServiceScope: '3', childServiceScope: '1', initialAuthorityBaseUnits: initialAuthority.toString(),
      promotedAuthorityBaseUnits: promotedAuthority.toString(), reducedAuthorityBaseUnits: reducedAuthority.toString(),
      exactAllowanceBaseUnits: exactAllowance.toString(), smallPaymentBaseUnits: paymentOne.toString(), largerPaymentBaseUnits: paymentTwo.toString(),
      totalPaymentBaseUnits: exactAllowance.toString(), overCapAmountBaseUnits: overCapAmount.toString(),
      resourceOneHash: randomHex(), outcomeOneHash: randomHex(), resourceTwoHash: randomHex(), outcomeTwoHash: randomHex(),
      violationReasonHash: randomHex(), remediationHash: randomHex(), overCapResourceHash: randomHex(), overCapOutcomeHash: randomHex(),
    },
  };
  await saveJson(preflightPath, preflight);
  return preflight;
}

async function ensureSigner() {
  const signer = parseAddress(await castOutput(['wallet', 'address', '--account', account]), 'keystore signer');
  if (signer.toLowerCase() !== sender.toLowerCase()) throw new Error(`Keystore account ${account} does not match the approved sender.`);
}

async function reconcileStep(evidence, action) {
  const step = evidence.steps[action];
  if (!step || step.status === 'success') return step;
  if (!step.hash) return null;
  const receipt = await rpc('eth_getTransactionReceipt', [step.hash]);
  if (!receipt) throw new Error(`${action} has pending transaction ${step.hash}; refusing duplicate broadcast.`);
  step.status = BigInt(receipt.status) === 1n ? 'success' : 'reverted';
  step.receipt = summarizeReceipt(receipt);
  await saveJson(evidencePath, evidence);
  if (step.status !== 'success') throw new Error(`${action} reverted in ${step.hash}.`);
  return step;
}

function successfulFees(evidence) {
  return Object.values(evidence.steps).reduce((total, step) => total + BigInt(step?.receipt?.feeWei ?? 0), 0n);
}

async function sendStep(evidence, { action, target, signature, values = [] }) {
  const existing = await reconcileStep(evidence, action);
  if (existing?.status === 'success') return existing;
  const data = await calldata(signature, values);
  const transaction = { from: sender, to: target, data };
  const simulationResult = await rpc('eth_call', [transaction, 'latest']);
  const estimatedGas = BigInt(await rpc('eth_estimateGas', [transaction]));
  const currentGasPrice = BigInt(await rpc('eth_gasPrice'));
  if (currentGasPrice > maxGasPriceWei) throw new Error(`Gas price ${currentGasPrice} exceeds the approved safety ceiling ${maxGasPriceWei}.`);
  const gasPrice = currentGasPrice > arcMainnet.fallbackGasPrice ? currentGasPrice : arcMainnet.fallbackGasPrice;
  const gasLimit = (estimatedGas * 3n + 1n) / 2n;
  const worstCaseFee = gasLimit * gasPrice;
  if (successfulFees(evidence) + worstCaseFee > maxLifecycleFeeWei) throw new Error('Lifecycle fee ceiling would be exceeded; no transaction sent.');
  const nonce = BigInt(await rpc('eth_getTransactionCount', [sender, 'pending']));
  evidence.steps[action] = {
    status: 'prepared', signer: sender, account, target, signature, values: values.map(String), calldata: data,
    simulationResult, nonce: nonce.toString(), estimatedGas: estimatedGas.toString(), gasLimit: gasLimit.toString(),
    gasPriceWei: gasPrice.toString(), worstCaseFeeWei: worstCaseFee.toString(), preparedAt: new Date().toISOString(),
  };
  await saveJson(evidencePath, evidence);
  const output = await castOutput([
    'send', target, signature, ...values, '--from', sender, '--account', account, '--rpc-url', arcMainnet.rpcUrl,
    '--gas-limit', gasLimit, '--gas-price', gasPrice, '--async', '--json',
  ]);
  const hash = output.match(/0x[\da-fA-F]{64}/)?.[0];
  if (!hash) throw new Error(`Could not parse transaction hash for ${action}.`);
  evidence.steps[action].status = 'pending';
  evidence.steps[action].hash = hash;
  evidence.steps[action].explorerUrl = `${arcMainnet.explorerUrl}/tx/${hash}`;
  await saveJson(evidencePath, evidence);
  const receipt = await waitForReceipt(hash);
  evidence.steps[action].status = BigInt(receipt.status) === 1n ? 'success' : 'reverted';
  evidence.steps[action].receipt = summarizeReceipt(receipt);
  await saveJson(evidencePath, evidence);
  if (evidence.steps[action].status !== 'success') throw new Error(`${action} reverted in ${hash}.`);
  return evidence.steps[action];
}

function extractRevertData(value) {
  const matches = [...JSON.stringify(value).matchAll(/0x[\da-fA-F]{8,}/g)].map((match) => match[0]);
  return matches.sort((left, right) => right.length - left.length)[0] ?? null;
}

function selectorOf(value) {
  return String(value ?? '').match(/0x[\da-fA-F]{8}/)?.[0]?.toLowerCase() ?? null;
}

async function simulateExpectedRevert(evidence, name, { from, signature, values, expectedSelector }) {
  const data = await calldata(signature, values);
  try {
    const result = await rpc('eth_call', [{ from, to: contract, data }, 'latest']);
    evidence.simulations[name] = { status: 'unexpected-success', from, to: contract, signature, values: values.map(String), calldata: data, result, broadcast: false };
    await saveJson(evidencePath, evidence);
    throw new Error(`${name} unexpectedly succeeded.`);
  } catch (error) {
    if (!(error instanceof RpcError)) throw error;
    const revertData = extractRevertData(error.rpcError);
    const selector = selectorOf(revertData ?? JSON.stringify(error.rpcError));
    evidence.simulations[name] = {
      status: selector === expectedSelector ? 'pass' : 'wrong-revert', from, to: contract, signature, values: values.map(String), calldata: data,
      revertData, selector, decodedError: errorSelectors[selector] ?? 'Unknown custom error', expectedSelector, broadcast: false,
    };
    await saveJson(evidencePath, evidence);
    if (selector !== expectedSelector) throw new Error(`${name} reverted with ${selector}, expected ${expectedSelector}.`);
  }
}

async function runIsolationSimulations(evidence) {
  const common = { from: isolationWallet };
  await simulateExpectedRevert(evidence, 'walletBCannotDemoteAgentA', { ...common, signature: 'demoteAgent(uint256,bytes32)', values: [agentId, randomHex()], expectedSelector: '0x390772fc' });
  await simulateExpectedRevert(evidence, 'walletBCannotPromoteAgentA', { ...common, signature: 'promoteAgent(uint256,uint8,uint128)', values: [agentId, 1, 30_000n], expectedSelector: '0x390772fc' });
  await simulateExpectedRevert(evidence, 'walletBCannotUpdateAgentA', { ...common, signature: 'updateOperationalAgent(uint256,address)', values: [agentId, isolationWallet], expectedSelector: '0x390772fc' });
  await simulateExpectedRevert(evidence, 'walletBCannotCreateTaskForAgentA', {
    ...common, signature: 'createTask(bytes32,bytes32,uint128,uint64,uint256,uint256,address,uint8)',
    values: [randomHex(), randomHex(), 1_000n, evidence.lifecycle.deadline, 1n, agentId, isolationWallet, 0], expectedSelector: '0x390772fc',
  });
  await simulateExpectedRevert(evidence, 'walletBCannotRevokeTaskA', { ...common, signature: 'revokeTask(bytes32)', values: [evidence.lifecycle.taskId], expectedSelector: '0x23d966b2' });
  const resourceHash = randomHex();
  const outcomeHash = randomHex();
  const paymentId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
    evidence.lifecycle.taskId, evidence.lifecycle.childMandateId, recipient, 1n, 1n, resourceHash, evidence.lifecycle.deadline, 99n,
  ])).trim();
  await simulateExpectedRevert(evidence, 'walletBCannotExecuteTaskAPayment', {
    ...common, signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.childMandateId, paymentId, recipient, 1n, 1n, resourceHash, evidence.lifecycle.deadline, 99n, outcomeHash], expectedSelector: '0x53b37e7f',
  });
  await simulateExpectedRevert(evidence, 'walletBCannotRecordAgentAWork', {
    ...common, signature: 'recordWorkProof(uint256,bytes32,bytes32,bytes32)',
    values: [agentId, evidence.lifecycle.taskId, evidence.lifecycle.paymentOneId, evidence.lifecycle.outcomeOneHash], expectedSelector: '0x23d966b2',
  });
  await simulateExpectedRevert(evidence, 'walletBCannotDelegateUnderTaskA', {
    ...common, signature: 'delegate(uint256,uint256,uint128,uint64,uint256,address)',
    values: [evidence.lifecycle.childMandateId, agentId, 1n, evidence.lifecycle.deadline, 1n, recipient], expectedSelector: '0x53b37e7f',
  });
}

async function recordAuthority(evidence, label) {
  const profile = await readAgent();
  if (!evidence.authorityTransitions.some((item) => item.label === label)) {
    evidence.authorityTransitions.push({ label, ...profile, observedAt: new Date().toISOString() });
    await saveJson(evidencePath, evidence);
  }
  return profile;
}

async function execute(artifactBundle) {
  if (process.env.V2_MAINNET_SMOKE_BROADCAST !== confirmation) {
    throw new Error(`Set V2_MAINNET_SMOKE_BROADCAST=${confirmation} to authorize only this bounded V2 smoke lifecycle.`);
  }
  const preflight = await loadJson(preflightPath);
  if (!preflight || preflight.status !== 'ready' || preflight.addresses.contract.toLowerCase() !== contract.toLowerCase()) {
    throw new Error('Run the read-only V2 Mainnet smoke preflight first.');
  }
  let evidence = await loadJson(evidencePath);
  if (!evidence) {
    evidence = {
      version: 1, status: 'in_progress', startedAt: new Date().toISOString(), gitHead: preflight.gitHead,
      network: preflight.network, safety: { ...preflight.safety, transactionsSent: true, passwordRequested: true, passwordHandledByLocalFoundryPromptOnly: true },
      addresses: preflight.addresses, artifact: preflight.artifact, sourceVerification: preflight.initialState.sourceVerification,
      initialState: preflight.initialState, lifecycle: { ...preflight.lifecycle, payments: [] }, authorityTransitions: [], steps: {}, simulations: {},
    };
    await saveJson(evidencePath, evidence);
  }
  if (evidence.status === 'pass') throw new Error('Mainnet V2 smoke evidence is already PASS; refusing another lifecycle.');
  if (evidence.gitHead !== preflight.gitHead || evidence.artifact.normalizedRuntimeHash !== artifactBundle.normalizedRuntimeHash) {
    throw new Error('Preflight, evidence, or local V2 artifact changed. Review before resuming.');
  }
  await snapshot(artifactBundle.artifact, { requireInitial: Object.keys(evidence.steps).length === 0 });
  await ensureSigner();

  await sendStep(evidence, { action: 'registerAgent', target: contract, signature: 'registerAgent(uint256,address,uint128)', values: [agentId, sender, initialAuthority] });
  const registered = await recordAuthority(evidence, 'registered-trainee');
  if (!registered.registered || registered.career !== 0 || BigInt(registered.authorityCapBaseUnits) !== initialAuthority) throw new Error('Agent registration state mismatch.');

  if (!evidence.lifecycle.taskId) {
    evidence.lifecycle.taskId = (await readCall(contract, 'computeTaskId(address,bytes32)(bytes32)', [sender, evidence.lifecycle.taskSalt])).trim();
    evidence.lifecycle.rootMandateId = parseInteger(await readCall(contract, 'nextMandateId()(uint256)')).toString();
    await saveJson(evidencePath, evidence);
  }
  await sendStep(evidence, {
    action: 'createTask', target: contract, signature: 'createTask(bytes32,bytes32,uint128,uint64,uint256,uint256,address,uint8)',
    values: [evidence.lifecycle.taskSalt, evidence.lifecycle.taskHash, taskBudget, evidence.lifecycle.deadline, 3n, agentId, recipient, 1],
  });
  const createdTask = await readTask(evidence.lifecycle.taskId);
  if (createdTask.owner.toLowerCase() !== sender.toLowerCase() || BigInt(createdTask.rootAgentId) !== agentId) throw new Error('Created task state mismatch.');

  if (!evidence.lifecycle.childMandateId) {
    evidence.lifecycle.childMandateId = parseInteger(await readCall(contract, 'nextMandateId()(uint256)')).toString();
    await saveJson(evidencePath, evidence);
  }
  await sendStep(evidence, {
    action: 'delegate', target: contract, signature: 'delegate(uint256,uint256,uint128,uint64,uint256,address)',
    values: [evidence.lifecycle.rootMandateId, agentId, taskBudget, evidence.lifecycle.deadline, 1n, recipient],
  });
  const delegated = await readMandate(evidence.lifecycle.childMandateId);
  if (delegated.parentId !== evidence.lifecycle.rootMandateId || BigInt(delegated.agentId) !== agentId) throw new Error('Delegated mandate state mismatch.');

  await sendStep(evidence, { action: 'approveExactUsdc', target: arcMainnet.usdcAddress, signature: 'approve(address,uint256)', values: [contract, exactAllowance] });
  if (await allowance() !== exactAllowance) throw new Error('Exact USDC allowance state mismatch.');

  if (!evidence.lifecycle.paymentOneId) {
    evidence.lifecycle.paymentOneId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
      evidence.lifecycle.taskId, evidence.lifecycle.childMandateId, recipient, paymentOne, 1n,
      evidence.lifecycle.resourceOneHash, evidence.lifecycle.deadline, 1n,
    ])).trim();
    await saveJson(evidencePath, evidence);
  }
  await sendStep(evidence, {
    action: 'executeSmallPayment', target: contract,
    signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.childMandateId, evidence.lifecycle.paymentOneId, recipient, paymentOne, 1n, evidence.lifecycle.resourceOneHash, evidence.lifecycle.deadline, 1n, evidence.lifecycle.outcomeOneHash],
  });
  if (!evidence.lifecycle.payments.some((item) => item.paymentId === evidence.lifecycle.paymentOneId)) {
    evidence.lifecycle.payments.push({ paymentId: evidence.lifecycle.paymentOneId, amountBaseUnits: paymentOne.toString(), transactionHash: evidence.steps.executeSmallPayment.hash });
    await saveJson(evidencePath, evidence);
  }

  await sendStep(evidence, {
    action: 'recordWorkProof', target: contract, signature: 'recordWorkProof(uint256,bytes32,bytes32,bytes32)',
    values: [agentId, evidence.lifecycle.taskId, evidence.lifecycle.paymentOneId, evidence.lifecycle.outcomeOneHash],
  });
  const beforePromotion = await readAgent();
  if (!beforePromotion.promotionEligible || beforePromotion.completedWorks !== 1) throw new Error('Payment-bound work proof did not create promotion eligibility.');

  await sendStep(evidence, { action: 'promoteAgent', target: contract, signature: 'promoteAgent(uint256,uint8,uint128)', values: [agentId, 1, promotedAuthority] });
  const promoted = await recordAuthority(evidence, 'owner-signed-promotion');
  if (promoted.career !== 1 || BigInt(promoted.authorityCapBaseUnits) !== promotedAuthority) throw new Error('Promotion state mismatch.');

  if (!evidence.lifecycle.paymentTwoId) {
    evidence.lifecycle.paymentTwoId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
      evidence.lifecycle.taskId, evidence.lifecycle.childMandateId, recipient, paymentTwo, 1n,
      evidence.lifecycle.resourceTwoHash, evidence.lifecycle.deadline, 2n,
    ])).trim();
    await saveJson(evidencePath, evidence);
  }
  await sendStep(evidence, {
    action: 'executeLargerPayment', target: contract,
    signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.childMandateId, evidence.lifecycle.paymentTwoId, recipient, paymentTwo, 1n, evidence.lifecycle.resourceTwoHash, evidence.lifecycle.deadline, 2n, evidence.lifecycle.outcomeTwoHash],
  });
  if (!evidence.lifecycle.payments.some((item) => item.paymentId === evidence.lifecycle.paymentTwoId)) {
    evidence.lifecycle.payments.push({ paymentId: evidence.lifecycle.paymentTwoId, amountBaseUnits: paymentTwo.toString(), transactionHash: evidence.steps.executeLargerPayment.hash });
    await saveJson(evidencePath, evidence);
  }
  if (await allowance() !== 0n) throw new Error('Exact allowance was not fully consumed.');

  await sendStep(evidence, { action: 'stopAndDemoteAgent', target: contract, signature: 'demoteAgent(uint256,bytes32)', values: [agentId, evidence.lifecycle.violationReasonHash] });
  const demoted = await recordAuthority(evidence, 'stop-demotion');
  if (!demoted.stopped || demoted.career !== 0 || BigInt(demoted.authorityCapBaseUnits) !== reducedAuthority) throw new Error('STOP/demotion state mismatch.');

  await sendStep(evidence, { action: 'reinstateAgent', target: contract, signature: 'reinstateAgent(uint256,bytes32)', values: [agentId, evidence.lifecycle.remediationHash] });
  const reinstated = await recordAuthority(evidence, 'reinstated-reduced-cap');
  if (reinstated.stopped || BigInt(reinstated.authorityCapBaseUnits) !== reducedAuthority) throw new Error('Reinstatement state mismatch.');

  const rejectedPaymentId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
    evidence.lifecycle.taskId, evidence.lifecycle.childMandateId, recipient, overCapAmount, 1n,
    evidence.lifecycle.overCapResourceHash, evidence.lifecycle.deadline, 3n,
  ])).trim();
  await simulateExpectedRevert(evidence, 'overCapPaymentRejected', {
    from: sender, signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.childMandateId, rejectedPaymentId, recipient, overCapAmount, 1n, evidence.lifecycle.overCapResourceHash, evidence.lifecycle.deadline, 3n, evidence.lifecycle.overCapOutcomeHash],
    expectedSelector: '0xe5bbd38c',
  });
  await runIsolationSimulations(evidence);
  await finalize(evidence, artifactBundle.artifact);
}

async function finalize(evidence, artifact, { persist = true } = {}) {
  const [owner, profile, task, rootMandate, childMandate, currentAllowance, runtime, recipientBalance, authorized] = await Promise.all([
    ownerOf(), readAgent(), readTask(evidence.lifecycle.taskId), readMandate(evidence.lifecycle.rootMandateId),
    readMandate(evidence.lifecycle.childMandateId), allowance(), verifyRuntime(artifact), tokenBalance(recipient),
    readCall(contract, 'isAuthorized(uint256)(bool)', [evidence.lifecycle.childMandateId]).then(parseBoolean),
  ]);
  if (owner.toLowerCase() !== sender.toLowerCase() || currentAllowance !== 0n || !authorized) throw new Error('Final ownership, allowance, or authorization state mismatch.');
  if (profile.career !== 0 || BigInt(profile.authorityCapBaseUnits) !== reducedAuthority || profile.completedWorks !== 1 || profile.violations !== 1 || profile.stopped) {
    throw new Error('Final Agent Authority state mismatch.');
  }
  if (BigInt(task.spentBaseUnits) !== exactAllowance || BigInt(rootMandate.spentBaseUnits) !== exactAllowance || BigInt(childMandate.spentBaseUnits) !== exactAllowance) {
    throw new Error('Final task or mandate spending state mismatch.');
  }
  const totalFees = successfulFees(evidence);
  evidence.finalState = {
    observedAt: new Date().toISOString(), owner, agent: profile, task, rootMandate, childMandate, authorized,
    allowanceBaseUnits: currentAllowance.toString(), recipientBalanceBaseUnits: recipientBalance.toString(), runtimeBytecode: runtime,
  };
  evidence.totals = {
    successfulTransactions: Object.values(evidence.steps).filter((step) => step.status === 'success' && step.hash).length,
    failedTransactionsBroadcast: 0, executedPaymentBaseUnits: exactAllowance.toString(), executedPaymentUsdc: formatUnits(exactAllowance, 6),
    receiptFeesWei: totalFees.toString(), receiptFeesNative: formatUnits(totalFees, 18),
  };
  evidence.safety.finalAllowanceBaseUnits = currentAllowance.toString();
  evidence.safety.crossUserWrites = 0;
  evidence.safety.contractRedeployed = false;
  evidence.status = 'pass';
  if (persist) {
    evidence.completedAt = new Date().toISOString();
    await saveJson(evidencePath, evidence);
  }
  process.stdout.write(`${JSON.stringify({ status: evidence.status, contract, evidencePath, totals: evidence.totals }, null, 2)}\n`);
}

async function verify(artifact) {
  const evidence = await loadJson(evidencePath);
  if (!evidence || evidence.status !== 'pass') throw new Error('Mainnet V2 smoke evidence is not PASS.');
  await finalize(evidence, artifact, { persist: false });
}

async function main() {
  if (!mode) throw new Error('Use --preflight, --execute, or --verify. Mainnet broadcast is never the default.');
  const artifactBundle = await buildArtifact();
  if (mode === 'preflight') {
    const preflight = await createPreflight(artifactBundle);
    process.stdout.write(`${JSON.stringify({ status: preflight.status, preflightPath, initialState: preflight.initialState, safety: preflight.safety }, null, 2)}\n`);
    return;
  }
  if (mode === 'execute') {
    await execute(artifactBundle);
    return;
  }
  await verify(artifactBundle.artifact);
}

await main();
