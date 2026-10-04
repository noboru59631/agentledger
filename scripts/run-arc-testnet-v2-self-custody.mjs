import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildDeploymentInitCode } from './deployment-init-code.mjs';
import {
  ARC_TESTNET, EVIDENCE_VERSION, assertConfiguration, byteLength, decodeKnownError,
  decodeTransferAgentId, hexQuantity, normalizeRuntimeBytecode, randomHex, sumReceiptFees,
} from './arc-testnet-v2-lifecycle-lib.mjs';

const args = new Set(process.argv.slice(2));
const phase = process.env.V2_TESTNET_PHASE ?? (args.has('--preflight') ? 'preflight' : args.has('--verify') ? 'verify' : null);
const evidencePath = resolve('docs/TESTNET_V2_SELF_CUSTODY_EVIDENCE.json');
const foundryBin = process.env.FOUNDRY_BIN ?? join(homedir(), '.foundry', 'bin');
const cast = process.platform === 'win32' ? join(foundryBin, 'cast.exe') : 'cast';
const forge = process.platform === 'win32' ? join(foundryBin, 'forge.exe') : 'forge';
const artifactPath = resolve('out/MandateGraphV2.sol/MandateGraphV2.json');
const zeroAddress = '0x0000000000000000000000000000000000000000';
const paymentOne = 5_000n;
const paymentTwo = 20_000n;
const exactAllowance = paymentOne + paymentTwo;
const initialAuthority = 10_000n;
const promotedAuthority = 50_000n;
const reducedAuthority = 25_000n;
const overCapAmount = 26_000n;
const walletBFundingWei = 50_000_000_000_000_000n;
const receiptPollAttempts = 240;
const receiptPollDelayMs = 1_000;

const config = {
  rpcUrl: process.env.V2_TESTNET_RPC_URL ?? ARC_TESTNET.rpcUrl,
  broadcastConfirmation: process.env.V2_TESTNET_BROADCAST,
  agentAId: process.env.V2_AGENT_A_ID ?? '897002',
  agentUri: process.env.V2_AGENT_B_URI ?? 'https://agentledger-livid.vercel.app/agent-registration.json',
  walletA: {
    account: process.env.V2_WALLET_A_ACCOUNT ?? 'agentledger-testnet',
    address: process.env.V2_WALLET_A_ADDRESS ?? '0x03607de69C487BcC460eaD7C4Bdfd25805658b75',
  },
  walletB: {
    account: process.env.V2_WALLET_B_ACCOUNT,
    address: process.env.V2_WALLET_B_ADDRESS,
  },
};

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
  const response = await fetch(config.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
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
  return castOutput(['call', target, signature, ...values, '--rpc-url', config.rpcUrl]);
}

async function readJsonCall(target, signature, values = []) {
  return JSON.parse(await castOutput(['call', target, signature, ...values, '--json', '--rpc-url', config.rpcUrl]));
}

async function saveEvidence(evidence) {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function loadEvidence() {
  try {
    return JSON.parse(await readFile(evidencePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function buildArtifact() {
  await run(forge, ['build']);
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const creationBytecode = artifact.bytecode.object;
  const runtimeBytecode = artifact.deployedBytecode.object;
  const immutableReferences = artifact.deployedBytecode.immutableReferences ?? {};
  const constructorArgs = `0x${encodeAddress(ARC_TESTNET.usdc)}${encodeAddress(ARC_TESTNET.identityRegistry)}`;
  const initCode = buildDeploymentInitCode(creationBytecode, constructorArgs);
  const normalizedRuntime = normalizeRuntimeBytecode(runtimeBytecode, immutableReferences);
  return {
    artifact,
    creationBytecode,
    runtimeBytecode,
    immutableReferences,
    initCode,
    metadata: {
      artifact: 'out/MandateGraphV2.sol/MandateGraphV2.json',
      contract: 'contracts/MandateGraphV2.sol:MandateGraphV2',
      compiler: '0.8.28',
      optimizer: { enabled: true, runs: 200 },
      constructorArgs: [ARC_TESTNET.usdc, ARC_TESTNET.identityRegistry],
      creationBytecodeBytes: byteLength(creationBytecode),
      runtimeBytecodeBytes: byteLength(runtimeBytecode),
      creationBytecodeHash: await keccak(creationBytecode),
      normalizedRuntimeBytecodeHash: await keccak(normalizedRuntime),
      initCodeHash: await keccak(initCode),
    },
  };
}

function encodeAddress(address) {
  return address.slice(2).toLowerCase().padStart(64, '0');
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

function receiptFee(receipt) {
  return (BigInt(receipt.gasUsed ?? 0) * BigInt(receipt.effectiveGasPrice ?? receipt.gasPrice ?? 0)).toString();
}

async function waitForReceipt(hash) {
  for (let attempt = 0; attempt < receiptPollAttempts; attempt += 1) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt) return receipt;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, receiptPollDelayMs));
  }
  throw new Error(`Timed out waiting for ${hash}. Evidence remains resumable.`);
}

async function ensureSigner(account, expectedAddress) {
  const signer = parseAddress(await castOutput(['wallet', 'address', '--account', account]), 'keystore signer');
  if (signer.toLowerCase() !== expectedAddress.toLowerCase()) throw new Error(`Keystore ${account} does not match configured public address.`);
  return signer;
}

async function codeSummary(address) {
  const code = await rpc('eth_getCode', [address, 'latest']);
  return { address, bytes: byteLength(code), hash: await keccak(code) };
}

async function verifyRuntime(contract, artifact) {
  const onchain = await rpc('eth_getCode', [contract, 'latest']);
  if (onchain === '0x') throw new Error('V2 contract has no runtime bytecode.');
  const localNormalized = normalizeRuntimeBytecode(artifact.runtimeBytecode, artifact.immutableReferences);
  const onchainNormalized = normalizeRuntimeBytecode(onchain, artifact.immutableReferences);
  const localHash = await keccak(localNormalized);
  const onchainHash = await keccak(onchainNormalized);
  if (localHash !== onchainHash) throw new Error('V2 deployed runtime bytecode does not match the local artifact after immutable normalization.');
  return { address: contract, bytes: byteLength(onchain), normalizedHash: onchainHash, matchesLocalArtifact: true };
}

async function tokenBalance(address) {
  return parseInteger(await readCall(ARC_TESTNET.usdc, 'balanceOf(address)(uint256)', [address]));
}

async function allowance(owner, spender) {
  return parseInteger(await readCall(ARC_TESTNET.usdc, 'allowance(address,address)(uint256)', [owner, spender]));
}

async function ownerOf(agentId) {
  return parseAddress(await readCall(ARC_TESTNET.identityRegistry, 'ownerOf(uint256)(address)', [agentId]), 'ERC-8004 owner');
}

async function readAgent(contract, agentId) {
  const values = await readJsonCall(contract, 'agents(uint256)(address,uint8,uint128,uint32,uint32,bool)', [agentId]);
  return {
    operationalAgent: String(values[0]), career: Number(values[1]), authorityCapBaseUnits: String(values[2]),
    completedWorks: Number(values[3]), violations: Number(values[4]), registered: decodedBoolean(values[5]),
    stopped: parseBoolean(await readCall(contract, 'stoppedAgents(uint256)(bool)', [agentId])),
    promotionEligible: parseBoolean(await readCall(contract, 'isPromotionEligible(uint256)(bool)', [agentId])),
  };
}

async function readTask(contract, taskId) {
  const values = await readJsonCall(contract, 'tasks(bytes32)(address,uint256,uint128,uint128,uint64,bytes32,bool)', [taskId]);
  return {
    owner: String(values[0]), rootAgentId: String(values[1]), budgetBaseUnits: String(values[2]),
    spentBaseUnits: String(values[3]), deadline: String(values[4]), taskHash: String(values[5]), revoked: decodedBoolean(values[6]),
  };
}

async function readMandate(contract, mandateId) {
  const values = await readJsonCall(contract, 'mandates(uint256)(bytes32,uint256,uint256,address,uint128,uint128,uint128,uint64,uint8,uint256,bool,uint256)', [mandateId]);
  return {
    taskId: String(values[0]), parentId: String(values[1]), agentId: String(values[2]), recipient: String(values[3]),
    budgetBaseUnits: String(values[4]), spentBaseUnits: String(values[5]), allocatedBaseUnits: String(values[6]),
    expiry: String(values[7]), depth: Number(values[8]), serviceScope: String(values[9]), revoked: decodedBoolean(values[10]), activeChildren: String(values[11]),
  };
}

async function preflightSnapshot({ sender, target, contract, artifact, action, paymentRecipient = null }) {
  const chainId = BigInt(await rpc('eth_chainId'));
  if (chainId !== ARC_TESTNET.chainId) throw new Error(`Expected Arc Testnet chain ID ${ARC_TESTNET.chainId}; received ${chainId}.`);
  const [block, nonce, nativeBalance, usdcBalance, tokenCode, registryCode, targetCode] = await Promise.all([
    rpc('eth_getBlockByNumber', ['latest', false]),
    rpc('eth_getTransactionCount', [sender, 'pending']),
    rpc('eth_getBalance', [sender, 'latest']),
    tokenBalance(sender),
    codeSummary(ARC_TESTNET.usdc),
    codeSummary(ARC_TESTNET.identityRegistry),
    codeSummary(target),
  ]);
  if (tokenCode.bytes === 0 || registryCode.bytes === 0) throw new Error('Pinned USDC or Identity Registry has no bytecode.');
  let graph = null;
  let currentAllowance = null;
  if (contract) {
    graph = await verifyRuntime(contract, artifact);
    currentAllowance = (await allowance(sender, contract)).toString();
  }
  return {
    action,
    checkedAt: new Date().toISOString(),
    rpcUrl: config.rpcUrl,
    chainId: Number(chainId),
    latestBlock: parseInt(block.number, 16),
    sender,
    transactionTarget: target,
    paymentRecipient,
    nonce: BigInt(nonce).toString(),
    nativeBalanceWei: BigInt(nativeBalance).toString(),
    usdcBalanceBaseUnits: usdcBalance.toString(),
    allowanceBaseUnits: currentAllowance,
    contracts: { usdc: tokenCode, identityRegistry: registryCode, transactionTarget: targetCode, mandateGraphV2: graph },
  };
}

async function reconcileStep(evidence, action) {
  const step = evidence.steps[action];
  if (!step || step.status === 'success') return step;
  if (!step.hash) return null;
  const receipt = await rpc('eth_getTransactionReceipt', [step.hash]);
  if (!receipt) throw new Error(`${action} has a pending transaction ${step.hash}; refusing duplicate broadcast.`);
  step.status = BigInt(receipt.status) === 1n ? 'success' : 'reverted';
  step.receipt = summarizeReceipt(receipt);
  step.feeWei = receiptFee(receipt);
  await saveEvidence(evidence);
  if (step.status !== 'success') throw new Error(`${action} reverted in ${step.hash}.`);
  return step;
}

function summarizeReceipt(receipt) {
  return {
    blockNumber: BigInt(receipt.blockNumber).toString(),
    transactionIndex: BigInt(receipt.transactionIndex).toString(),
    gasUsed: BigInt(receipt.gasUsed).toString(),
    effectiveGasPriceWei: BigInt(receipt.effectiveGasPrice ?? receipt.gasPrice ?? 0).toString(),
    contractAddress: receipt.contractAddress,
    status: BigInt(receipt.status).toString(),
  };
}

async function sendStep(evidence, artifact, { action, sender, account, target, signature, values = [], value = 0n, paymentRecipient = null }) {
  const existing = await reconcileStep(evidence, action);
  if (existing?.status === 'success') return existing.hash ? rpc('eth_getTransactionReceipt', [existing.hash]) : null;
  const data = signature ? await calldata(signature, values) : '0x';
  const preflight = await preflightSnapshot({ sender, target, contract: evidence.contracts.mandateGraphV2.address, artifact, action, paymentRecipient });
  const transaction = { from: sender, to: target, data };
  if (value > 0n) transaction.value = hexQuantity(value);
  const simulationResult = await rpc('eth_call', [transaction, 'latest']);
  const estimatedGas = BigInt(await rpc('eth_estimateGas', [transaction])).toString();
  evidence.steps[action] = {
    status: 'prepared', signer: sender, account, target, signature, values: values.map(String), valueWei: value.toString(),
    calldata: data, simulationResult, estimatedGas, preflight,
  };
  await saveEvidence(evidence);
  const commandArgs = ['send', target];
  if (signature) commandArgs.push(signature, ...values.map(String));
  if (value > 0n) commandArgs.push('--value', value.toString());
  commandArgs.push('--from', sender, '--account', account, '--rpc-url', config.rpcUrl, '--async', '--json');
  const output = await castOutput(commandArgs);
  const hash = output.match(/0x[\da-fA-F]{64}/)?.[0];
  if (!hash) throw new Error(`Could not parse transaction hash for ${action}.`);
  evidence.steps[action].status = 'pending';
  evidence.steps[action].hash = hash;
  evidence.steps[action].explorerUrl = `${ARC_TESTNET.explorerUrl}/tx/${hash}`;
  await saveEvidence(evidence);
  const receipt = await waitForReceipt(hash);
  evidence.steps[action].status = BigInt(receipt.status) === 1n ? 'success' : 'reverted';
  evidence.steps[action].receipt = summarizeReceipt(receipt);
  evidence.steps[action].feeWei = receiptFee(receipt);
  await saveEvidence(evidence);
  if (evidence.steps[action].status !== 'success') throw new Error(`${action} reverted in ${hash}.`);
  return receipt;
}

async function deployStep(evidence, artifact) {
  const action = 'deployMandateGraphV2';
  const existing = await reconcileStep(evidence, action);
  if (existing?.status === 'success') {
    evidence.contracts.mandateGraphV2.address ??= existing.receipt.contractAddress;
    return evidence.contracts.mandateGraphV2.address;
  }
  const preflight = await preflightSnapshot({
    sender: config.walletA.address, target: ARC_TESTNET.identityRegistry, contract: null, artifact, action,
  });
  const transaction = { from: config.walletA.address, data: artifact.initCode };
  const simulationResult = await rpc('eth_call', [transaction, 'latest']);
  const estimatedGas = BigInt(await rpc('eth_estimateGas', [transaction])).toString();
  evidence.steps[action] = {
    status: 'prepared', signer: config.walletA.address, account: config.walletA.account,
    target: null, calldataHash: artifact.metadata.initCodeHash, simulationResult, estimatedGas, preflight,
  };
  await saveEvidence(evidence);
  const output = await castOutput([
    'send', '--account', config.walletA.account, '--rpc-url', config.rpcUrl, '--async', '--json',
    '--create', artifact.initCode,
  ]);
  const hash = output.match(/0x[\da-fA-F]{64}/)?.[0];
  if (!hash) throw new Error('Could not parse V2 deployment transaction hash.');
  evidence.steps[action].status = 'pending';
  evidence.steps[action].hash = hash;
  evidence.steps[action].explorerUrl = `${ARC_TESTNET.explorerUrl}/tx/${hash}`;
  await saveEvidence(evidence);
  const receipt = await waitForReceipt(hash);
  if (BigInt(receipt.status) !== 1n || !receipt.contractAddress) throw new Error(`V2 deployment failed in ${hash}.`);
  evidence.steps[action].status = 'success';
  evidence.steps[action].receipt = summarizeReceipt(receipt);
  evidence.steps[action].feeWei = receiptFee(receipt);
  evidence.contracts.mandateGraphV2.address = receipt.contractAddress;
  evidence.contracts.mandateGraphV2.explorerUrl = `${ARC_TESTNET.explorerUrl}/address/${receipt.contractAddress}`;
  evidence.contracts.mandateGraphV2.runtime = await verifyRuntime(receipt.contractAddress, artifact);
  await saveEvidence(evidence);
  return receipt.contractAddress;
}

async function simulateExpectedRevert(evidence, name, { from, to, signature, values = [], expectedSelector }) {
  const data = await calldata(signature, values);
  try {
    const result = await rpc('eth_call', [{ from, to, data }, 'latest']);
    evidence.simulations[name] = { status: 'unexpected-success', from, to, signature, values: values.map(String), calldata: data, result };
    await saveEvidence(evidence);
    throw new Error(`${name} unexpectedly succeeded in eth_call.`);
  } catch (error) {
    if (!(error instanceof RpcError)) throw error;
    const serialized = JSON.stringify(error.rpcError);
    const decoded = decodeKnownError(serialized);
    evidence.simulations[name] = {
      status: decoded.selector === expectedSelector.toLowerCase() ? 'pass' : 'wrong-revert',
      from, to, signature, values: values.map(String), calldata: data,
      revertData: extractRevertData(error.rpcError), selector: decoded.selector, decodedError: decoded.error,
      expectedSelector: expectedSelector.toLowerCase(), broadcast: false,
    };
    await saveEvidence(evidence);
    if (evidence.simulations[name].status !== 'pass') throw new Error(`${name} reverted with ${decoded.selector}, expected ${expectedSelector}.`);
    return evidence.simulations[name];
  }
}

async function simulateSuccess(evidence, name, { from, to, signature, values = [] }) {
  const data = await calldata(signature, values);
  const result = await rpc('eth_call', [{ from, to, data }, 'latest']);
  evidence.simulations[name] = { status: 'pass', from, to, signature, values: values.map(String), calldata: data, result, broadcast: false };
  await saveEvidence(evidence);
}

function extractRevertData(value) {
  const serialized = JSON.stringify(value);
  const matches = [...serialized.matchAll(/0x[\da-fA-F]{8,}/g)].map((match) => match[0]);
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

async function createEvidence(artifact) {
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  const gitHead = await run('git', ['-c', `safe.directory=${process.cwd().replaceAll('\\', '/')}`, 'rev-parse', 'HEAD']);
  const deadline = BigInt(block.timestamp) + 7n * 24n * 60n * 60n;
  return {
    version: EVIDENCE_VERSION,
    status: 'in_progress',
    network: ARC_TESTNET.name,
    chainId: Number(ARC_TESTNET.chainId),
    rpcUrl: config.rpcUrl,
    explorerUrl: ARC_TESTNET.explorerUrl,
    gitHead,
    startedAt: new Date().toISOString(),
    safety: {
      secretsRequestedStoredOrDisplayed: false,
      signerMode: 'encrypted Foundry keystores; password entered only in the local terminal',
      mainnetBroadcast: false,
      mainnetWriteLockChanged: false,
      failedTransactionsBroadcast: 0,
    },
    wallets: { a: { address: config.walletA.address }, b: { address: config.walletB.address } },
    contracts: {
      usdc: { address: ARC_TESTNET.usdc },
      identityRegistry: { address: ARC_TESTNET.identityRegistry },
      mandateGraphV2: { address: null, bytecode: artifact.metadata },
    },
    agents: { a: { agentId: config.agentAId }, b: { agentId: null, registrationUri: config.agentUri } },
    lifecycle: {
      sharedTaskSalt: randomHex(),
      taskAHash: randomHex(),
      taskBHash: randomHex(),
      deadline: deadline.toString(),
      serviceScope: '1',
      taskBudgetBaseUnits: '100000',
      paymentOneBaseUnits: paymentOne.toString(),
      paymentTwoBaseUnits: paymentTwo.toString(),
      exactAllowanceBaseUnits: exactAllowance.toString(),
      resourceOneHash: randomHex(),
      outcomeOneHash: randomHex(),
      resourceTwoHash: randomHex(),
      outcomeTwoHash: randomHex(),
      violationReasonHash: randomHex(),
      remediationHash: randomHex(),
      overCapResourceHash: randomHex(),
      overCapOutcomeHash: randomHex(),
      authorityTransitions: [],
      payments: [],
    },
    steps: {},
    simulations: {},
  };
}

async function ensureEvidence(artifact) {
  const evidence = await loadEvidence() ?? await createEvidence(artifact);
  if (evidence.version !== EVIDENCE_VERSION || evidence.chainId !== Number(ARC_TESTNET.chainId)) throw new Error('Existing V2 evidence has an incompatible version or chain.');
  if (evidence.status === 'pass') throw new Error('V2 evidence is already PASS; refusing to start another lifecycle in the same file.');
  if (evidence.wallets.a.address.toLowerCase() !== config.walletA.address.toLowerCase() || evidence.wallets.b.address.toLowerCase() !== config.walletB.address.toLowerCase()) {
    throw new Error('Configured wallets do not match the resumable V2 evidence.');
  }
  if (evidence.contracts.mandateGraphV2.bytecode.initCodeHash !== artifact.metadata.initCodeHash) {
    throw new Error('Local V2 init code changed after evidence initialization. Review before continuing.');
  }
  await saveEvidence(evidence);
  return evidence;
}

async function recordAuthority(evidence, label) {
  const profile = await readAgent(evidence.contracts.mandateGraphV2.address, evidence.agents.a.agentId);
  const latest = evidence.lifecycle.authorityTransitions.at(-1);
  if (!latest || latest.label !== label) evidence.lifecycle.authorityTransitions.push({ label, ...profile, observedAt: new Date().toISOString() });
  await saveEvidence(evidence);
  return profile;
}

async function runWalletAPhase(evidence, artifact) {
  await ensureSigner(config.walletA.account, config.walletA.address);
  const identityOwner = await ownerOf(config.agentAId);
  if (identityOwner.toLowerCase() !== config.walletA.address.toLowerCase()) throw new Error('Wallet A does not own configured Agent A.');
  const walletBNative = BigInt(await rpc('eth_getBalance', [config.walletB.address, 'latest']));
  if (evidence.steps.fundWalletBGas?.status === 'success') {
    if (walletBNative === 0n) throw new Error('Recorded Wallet B gas funding is no longer reflected onchain.');
  } else if (walletBNative < walletBFundingWei) {
    await sendStep(evidence, artifact, {
      action: 'fundWalletBGas', sender: config.walletA.address, account: config.walletA.account,
      target: config.walletB.address, value: walletBFundingWei - walletBNative,
    });
  } else {
    evidence.steps.fundWalletBGas = { status: 'success', inferredOnchain: true, existingBalanceWei: walletBNative.toString() };
    await saveEvidence(evidence);
  }
  const contract = await deployStep(evidence, artifact);
  await sendStep(evidence, artifact, {
    action: 'registerAgentA', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'registerAgent(uint256,address,uint128)', values: [config.agentAId, config.walletA.address, initialAuthority],
  });
  await recordAuthority(evidence, 'registered-trainee');
  if (!evidence.lifecycle.taskAId) {
    evidence.lifecycle.taskAId = (await readCall(contract, 'computeTaskId(address,bytes32)(bytes32)', [config.walletA.address, evidence.lifecycle.sharedTaskSalt])).trim();
    evidence.lifecycle.rootMandateAId = parseInteger(await readCall(contract, 'nextMandateId()(uint256)')).toString();
    await saveEvidence(evidence);
  }
  await sendStep(evidence, artifact, {
    action: 'createTaskA', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'createTask(bytes32,bytes32,uint128,uint64,uint256,uint256,address,uint8)',
    values: [evidence.lifecycle.sharedTaskSalt, evidence.lifecycle.taskAHash, 100_000n, evidence.lifecycle.deadline, 1n, config.agentAId, config.walletB.address, 0],
    paymentRecipient: config.walletB.address,
  });
  await sendStep(evidence, artifact, {
    action: 'approveExactUsdc', sender: config.walletA.address, account: config.walletA.account, target: ARC_TESTNET.usdc,
    signature: 'approve(address,uint256)', values: [contract, exactAllowance], paymentRecipient: contract,
  });
  if (!evidence.lifecycle.paymentOneId) {
    evidence.lifecycle.paymentOneId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
      evidence.lifecycle.taskAId, evidence.lifecycle.rootMandateAId, config.walletB.address, paymentOne, 1n,
      evidence.lifecycle.resourceOneHash, evidence.lifecycle.deadline, 1n,
    ])).trim();
    await saveEvidence(evidence);
  }
  await sendStep(evidence, artifact, {
    action: 'executeSmallPayment', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.rootMandateAId, evidence.lifecycle.paymentOneId, config.walletB.address, paymentOne, 1n, evidence.lifecycle.resourceOneHash, evidence.lifecycle.deadline, 1n, evidence.lifecycle.outcomeOneHash],
    paymentRecipient: config.walletB.address,
  });
  if (!evidence.lifecycle.payments.some((item) => item.paymentId === evidence.lifecycle.paymentOneId)) {
    evidence.lifecycle.payments.push({ paymentId: evidence.lifecycle.paymentOneId, payer: config.walletA.address, recipient: config.walletB.address, amountBaseUnits: paymentOne.toString(), transactionHash: evidence.steps.executeSmallPayment.hash });
  }
  await sendStep(evidence, artifact, {
    action: 'recordWorkProof', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'recordWorkProof(uint256,bytes32,bytes32,bytes32)', values: [config.agentAId, evidence.lifecycle.taskAId, evidence.lifecycle.paymentOneId, evidence.lifecycle.outcomeOneHash],
  });
  const beforePromotion = await readAgent(contract, config.agentAId);
  if (!beforePromotion.promotionEligible) throw new Error('Agent A is not promotion eligible after payment-bound work proof.');
  await sendStep(evidence, artifact, {
    action: 'promoteAgentA', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'promoteAgent(uint256,uint8,uint128)', values: [config.agentAId, 1, promotedAuthority],
  });
  await recordAuthority(evidence, 'owner-signed-promotion');
  if (!evidence.lifecycle.paymentTwoId) {
    evidence.lifecycle.paymentTwoId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
      evidence.lifecycle.taskAId, evidence.lifecycle.rootMandateAId, config.walletB.address, paymentTwo, 1n,
      evidence.lifecycle.resourceTwoHash, evidence.lifecycle.deadline, 2n,
    ])).trim();
    await saveEvidence(evidence);
  }
  await sendStep(evidence, artifact, {
    action: 'executeLargerPayment', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.rootMandateAId, evidence.lifecycle.paymentTwoId, config.walletB.address, paymentTwo, 1n, evidence.lifecycle.resourceTwoHash, evidence.lifecycle.deadline, 2n, evidence.lifecycle.outcomeTwoHash],
    paymentRecipient: config.walletB.address,
  });
  if (!evidence.lifecycle.payments.some((item) => item.paymentId === evidence.lifecycle.paymentTwoId)) {
    evidence.lifecycle.payments.push({ paymentId: evidence.lifecycle.paymentTwoId, payer: config.walletA.address, recipient: config.walletB.address, amountBaseUnits: paymentTwo.toString(), transactionHash: evidence.steps.executeLargerPayment.hash });
  }
  const remaining = await allowance(config.walletA.address, contract);
  if (remaining !== 0n) throw new Error(`Exact allowance was not fully consumed; remaining ${remaining}.`);
  evidence.phaseStatus = { ...(evidence.phaseStatus ?? {}), walletA: 'pass' };
  await saveEvidence(evidence);
}

async function runWalletBPhase(evidence, artifact) {
  const contract = evidence.contracts.mandateGraphV2.address;
  if (!contract) throw new Error('Run the wallet-a phase first.');
  await ensureSigner(config.walletB.account, config.walletB.address);
  if (!evidence.agents.b.agentId) {
    const receipt = await sendStep(evidence, artifact, {
      action: 'registerIdentityAgentB', sender: config.walletB.address, account: config.walletB.account,
      target: ARC_TESTNET.identityRegistry, signature: 'register(string)', values: [config.agentUri],
    });
    evidence.agents.b.agentId = decodeTransferAgentId(receipt, ARC_TESTNET.identityRegistry, config.walletB.address);
    await saveEvidence(evidence);
  }
  const agentBId = evidence.agents.b.agentId;
  const owner = await ownerOf(agentBId);
  if (owner.toLowerCase() !== config.walletB.address.toLowerCase()) throw new Error('Wallet B does not own Agent B before V2 registration.');
  await sendStep(evidence, artifact, {
    action: 'registerAgentB', sender: config.walletB.address, account: config.walletB.account, target: contract,
    signature: 'registerAgent(uint256,address,uint128)', values: [agentBId, config.walletB.address, 1_000n],
  });
  if (!evidence.lifecycle.taskBId) {
    evidence.lifecycle.taskBId = (await readCall(contract, 'computeTaskId(address,bytes32)(bytes32)', [config.walletB.address, evidence.lifecycle.sharedTaskSalt])).trim();
    evidence.lifecycle.rootMandateBId = parseInteger(await readCall(contract, 'nextMandateId()(uint256)')).toString();
    await saveEvidence(evidence);
  }
  if (evidence.lifecycle.taskAId.toLowerCase() === evidence.lifecycle.taskBId.toLowerCase()) throw new Error('Wallet-namespaced task IDs unexpectedly collided.');
  await sendStep(evidence, artifact, {
    action: 'createTaskB', sender: config.walletB.address, account: config.walletB.account, target: contract,
    signature: 'createTask(bytes32,bytes32,uint128,uint64,uint256,uint256,address,uint8)',
    values: [evidence.lifecycle.sharedTaskSalt, evidence.lifecycle.taskBHash, 2_000n, evidence.lifecycle.deadline, 1n, agentBId, config.walletA.address, 0],
    paymentRecipient: config.walletA.address,
  });
  await runCrossUserSimulations(evidence, contract, agentBId);
  await sendStep(evidence, artifact, {
    action: 'transferAgentBToWalletA', sender: config.walletB.address, account: config.walletB.account,
    target: ARC_TESTNET.identityRegistry, signature: 'transferFrom(address,address,uint256)',
    values: [config.walletB.address, config.walletA.address, agentBId], paymentRecipient: config.walletA.address,
  });
  const transferredOwner = await ownerOf(agentBId);
  if (transferredOwner.toLowerCase() !== config.walletA.address.toLowerCase()) throw new Error('Agent B ownership did not move to Wallet A.');
  const authorizedAfterTransfer = parseBoolean(await readCall(contract, 'isAuthorized(uint256)(bool)', [evidence.lifecycle.rootMandateBId]));
  if (authorizedAfterTransfer) throw new Error('Wallet B task remained authorized after its root Agent moved to Wallet A.');
  await simulateExpectedRevert(evidence, 'oldOwnerAdminFrozenAfterTransfer', {
    from: config.walletB.address, to: contract, signature: 'demoteAgent(uint256,bytes32)', values: [agentBId, randomHex()], expectedSelector: '0x390772fc',
  });
  const transferResourceHash = randomHex();
  const transferOutcomeHash = randomHex();
  const transferPaymentId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
    evidence.lifecycle.taskBId, evidence.lifecycle.rootMandateBId, config.walletA.address, 1n, 1n, transferResourceHash, evidence.lifecycle.deadline, 1n,
  ])).trim();
  await simulateExpectedRevert(evidence, 'oldTaskFrozenAfterAgentOwnershipTransfer', {
    from: config.walletB.address, to: contract,
    signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.rootMandateBId, transferPaymentId, config.walletA.address, 1n, 1n, transferResourceHash, evidence.lifecycle.deadline, 1n, transferOutcomeHash],
    expectedSelector: '0x3961b4d3',
  });
  await simulateSuccess(evidence, 'newOwnerAdministrationFollowsOwnerOf', {
    from: config.walletA.address, to: contract, signature: 'updateOperationalAgent(uint256,address)', values: [agentBId, config.walletA.address],
  });
  evidence.phaseStatus = { ...(evidence.phaseStatus ?? {}), walletB: 'pass' };
  await saveEvidence(evidence);
}

async function runCrossUserSimulations(evidence, contract, agentBId) {
  const common = { from: config.walletB.address, to: contract };
  await simulateExpectedRevert(evidence, 'walletBCannotDemoteAgentA', { ...common, signature: 'demoteAgent(uint256,bytes32)', values: [config.agentAId, randomHex()], expectedSelector: '0x390772fc' });
  await simulateExpectedRevert(evidence, 'walletBCannotPromoteAgentA', { ...common, signature: 'promoteAgent(uint256,uint8,uint128)', values: [config.agentAId, 2, 60_000n], expectedSelector: '0x390772fc' });
  await simulateExpectedRevert(evidence, 'walletBCannotUpdateAgentA', { ...common, signature: 'updateOperationalAgent(uint256,address)', values: [config.agentAId, config.walletB.address], expectedSelector: '0x390772fc' });
  await simulateExpectedRevert(evidence, 'walletBCannotCreateTaskForAgentA', {
    ...common, signature: 'createTask(bytes32,bytes32,uint128,uint64,uint256,uint256,address,uint8)',
    values: [randomHex(), randomHex(), 1_000n, evidence.lifecycle.deadline, 1n, config.agentAId, config.walletB.address, 0], expectedSelector: '0x390772fc',
  });
  await simulateExpectedRevert(evidence, 'walletBCannotRevokeTaskA', { ...common, signature: 'revokeTask(bytes32)', values: [evidence.lifecycle.taskAId], expectedSelector: '0x23d966b2' });
  const resourceHash = randomHex();
  const outcomeHash = randomHex();
  const paymentId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
    evidence.lifecycle.taskAId, evidence.lifecycle.rootMandateAId, config.walletB.address, 1n, 1n, resourceHash, evidence.lifecycle.deadline, 99n,
  ])).trim();
  await simulateExpectedRevert(evidence, 'walletBCannotExecuteTaskAPayment', {
    ...common, signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.rootMandateAId, paymentId, config.walletB.address, 1n, 1n, resourceHash, evidence.lifecycle.deadline, 99n, outcomeHash], expectedSelector: '0x53b37e7f',
  });
  await simulateExpectedRevert(evidence, 'walletBCannotRecordAgentAWork', {
    ...common, signature: 'recordWorkProof(uint256,bytes32,bytes32,bytes32)',
    values: [config.agentAId, evidence.lifecycle.taskAId, evidence.lifecycle.paymentOneId, evidence.lifecycle.outcomeOneHash], expectedSelector: '0x23d966b2',
  });
  await simulateExpectedRevert(evidence, 'walletBCannotDelegateUnderTaskA', {
    ...common, signature: 'delegate(uint256,uint256,uint128,uint64,uint256,address)',
    values: [evidence.lifecycle.rootMandateAId, agentBId, 1n, evidence.lifecycle.deadline, 1n, config.walletB.address], expectedSelector: '0x53b37e7f',
  });
}

async function runWalletAFinalizePhase(evidence, artifact) {
  const contract = evidence.contracts.mandateGraphV2.address;
  const agentBId = evidence.agents.b.agentId;
  if (!contract || !agentBId) throw new Error('Run wallet-a and wallet-b phases first.');
  await ensureSigner(config.walletA.account, config.walletA.address);
  const transferredOwner = await ownerOf(agentBId);
  if (transferredOwner.toLowerCase() !== config.walletA.address.toLowerCase()) throw new Error('Agent B is not held by Wallet A at the finalize checkpoint.');
  await sendStep(evidence, artifact, {
    action: 'returnAgentBToWalletB', sender: config.walletA.address, account: config.walletA.account,
    target: ARC_TESTNET.identityRegistry, signature: 'transferFrom(address,address,uint256)',
    values: [config.walletA.address, config.walletB.address, agentBId], paymentRecipient: config.walletB.address,
  });
  const returnedOwner = await ownerOf(agentBId);
  if (returnedOwner.toLowerCase() !== config.walletB.address.toLowerCase()) throw new Error('Agent B was not returned to Wallet B.');
  const authorizedAfterReturn = parseBoolean(await readCall(contract, 'isAuthorized(uint256)(bool)', [evidence.lifecycle.rootMandateBId]));
  if (!authorizedAfterReturn) throw new Error('Wallet B task authority did not recover after Agent B returned to its task owner.');
  await sendStep(evidence, artifact, {
    action: 'stopAndDemoteAgentA', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'demoteAgent(uint256,bytes32)', values: [config.agentAId, evidence.lifecycle.violationReasonHash],
  });
  const demoted = await recordAuthority(evidence, 'stop-demotion');
  if (!demoted.stopped || BigInt(demoted.authorityCapBaseUnits) !== reducedAuthority) throw new Error('STOP/demotion did not reduce Agent A Authority to 25,000 base units.');
  await sendStep(evidence, artifact, {
    action: 'reinstateAgentA', sender: config.walletA.address, account: config.walletA.account, target: contract,
    signature: 'reinstateAgent(uint256,bytes32)', values: [config.agentAId, evidence.lifecycle.remediationHash],
  });
  const reinstated = await recordAuthority(evidence, 'reinstated-reduced-cap');
  if (reinstated.stopped || BigInt(reinstated.authorityCapBaseUnits) !== reducedAuthority) throw new Error('Reinstatement restored or changed the reduced Authority cap.');
  const rejectedPaymentId = (await readCall(contract, 'computePaymentId(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)(bytes32)', [
    evidence.lifecycle.taskAId, evidence.lifecycle.rootMandateAId, config.walletB.address, overCapAmount, 1n,
    evidence.lifecycle.overCapResourceHash, evidence.lifecycle.deadline, 3n,
  ])).trim();
  await simulateExpectedRevert(evidence, 'overCapPaymentRejected', {
    from: config.walletA.address, to: contract,
    signature: 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    values: [evidence.lifecycle.rootMandateAId, rejectedPaymentId, config.walletB.address, overCapAmount, 1n, evidence.lifecycle.overCapResourceHash, evidence.lifecycle.deadline, 3n, evidence.lifecycle.overCapOutcomeHash],
    expectedSelector: '0xe5bbd38c',
  });
  await finalizeEvidence(evidence, artifact);
}

async function finalizeEvidence(evidence, artifact) {
  const contract = evidence.contracts.mandateGraphV2.address;
  const [agentAOwner, agentBOwner, agentA, agentB, taskA, taskB, mandateA, mandateB, allowanceA, runtime] = await Promise.all([
    ownerOf(evidence.agents.a.agentId), ownerOf(evidence.agents.b.agentId),
    readAgent(contract, evidence.agents.a.agentId), readAgent(contract, evidence.agents.b.agentId),
    readTask(contract, evidence.lifecycle.taskAId), readTask(contract, evidence.lifecycle.taskBId),
    readMandate(contract, evidence.lifecycle.rootMandateAId), readMandate(contract, evidence.lifecycle.rootMandateBId),
    allowance(config.walletA.address, contract), verifyRuntime(contract, artifact),
  ]);
  const authorizedA = parseBoolean(await readCall(contract, 'isAuthorized(uint256)(bool)', [evidence.lifecycle.rootMandateAId]));
  const authorizedB = parseBoolean(await readCall(contract, 'isAuthorized(uint256)(bool)', [evidence.lifecycle.rootMandateBId]));
  if (agentAOwner.toLowerCase() !== config.walletA.address.toLowerCase() || agentBOwner.toLowerCase() !== config.walletB.address.toLowerCase()) throw new Error('Final ERC-8004 ownership mismatch.');
  if (!authorizedA || !authorizedB || allowanceA !== 0n) throw new Error('Final authorization or allowance state mismatch.');
  if (BigInt(agentA.authorityCapBaseUnits) !== reducedAuthority || agentA.career !== 0 || agentA.completedWorks !== 1 || agentA.violations !== 1 || agentA.stopped) {
    throw new Error('Final Agent A Authority state mismatch.');
  }
  const feeWei = sumReceiptFees(evidence.steps);
  evidence.finalState = {
    observedAt: new Date().toISOString(),
    owners: { agentA: agentAOwner, agentB: agentBOwner },
    agentA, agentB, taskA, taskB, mandateA, mandateB,
    authorized: { taskA: authorizedA, taskB: authorizedB },
    allowanceAtoV2BaseUnits: allowanceA.toString(),
    runtimeBytecode: runtime,
  };
  evidence.totals = {
    successfulTransactions: Object.values(evidence.steps).filter((step) => step.status === 'success' && step.hash).length,
    failedTransactionsBroadcast: 0,
    executedPaymentBaseUnits: evidence.lifecycle.payments.reduce((sum, item) => sum + BigInt(item.amountBaseUnits), 0n).toString(),
    receiptFeesWei: feeWei.toString(),
  };
  evidence.phaseStatus = { ...(evidence.phaseStatus ?? {}), finalize: 'pass' };
  evidence.status = 'pass';
  evidence.completedAt = new Date().toISOString();
  await saveEvidence(evidence);
}

async function readonlyPreflight(artifact) {
  const chainId = BigInt(await rpc('eth_chainId'));
  if (chainId !== ARC_TESTNET.chainId) throw new Error(`Unexpected chain ID ${chainId}.`);
  const [block, token, identity, ownerA, nativeA, nativeB, usdcA, usdcB] = await Promise.all([
    rpc('eth_getBlockByNumber', ['latest', false]), codeSummary(ARC_TESTNET.usdc), codeSummary(ARC_TESTNET.identityRegistry),
    ownerOf(config.agentAId), rpc('eth_getBalance', [config.walletA.address, 'latest']), rpc('eth_getBalance', [config.walletB.address, 'latest']),
    tokenBalance(config.walletA.address), tokenBalance(config.walletB.address),
  ]);
  if (ownerA.toLowerCase() !== config.walletA.address.toLowerCase()) throw new Error('Wallet A no longer owns Agent A.');
  return {
    mode: 'read-only', rpcUrl: config.rpcUrl, chainId: Number(chainId), latestBlock: parseInt(block.number, 16),
    walletA: { address: config.walletA.address, agentAId: config.agentAId, nativeBalanceWei: BigInt(nativeA).toString(), usdcBalanceBaseUnits: usdcA.toString() },
    walletB: { address: config.walletB.address, nativeBalanceWei: BigInt(nativeB).toString(), usdcBalanceBaseUnits: usdcB.toString() },
    contracts: { usdc: token, identityRegistry: identity }, localV2: artifact.metadata, broadcast: false,
  };
}

async function verifyCompletedEvidence(artifact) {
  const evidence = await loadEvidence();
  if (!evidence) throw new Error(`Missing ${evidencePath}.`);
  if (evidence.status !== 'pass') throw new Error(`Evidence status is ${evidence.status}, not pass.`);
  const runtime = await verifyRuntime(evidence.contracts.mandateGraphV2.address, artifact);
  process.stdout.write(`${JSON.stringify({ status: evidence.status, contract: evidence.contracts.mandateGraphV2.address, runtime, totals: evidence.totals }, null, 2)}\n`);
}

async function main() {
  if (!phase || !['preflight', 'wallet-a', 'wallet-b', 'wallet-a-finalize', 'verify'].includes(phase)) {
    throw new Error('Set V2_TESTNET_PHASE to preflight, wallet-a, wallet-b, wallet-a-finalize, or verify.');
  }
  assertConfiguration(config, { broadcast: !['preflight', 'verify'].includes(phase) });
  const artifact = await buildArtifact();
  if (phase === 'preflight') {
    process.stdout.write(`${JSON.stringify(await readonlyPreflight(artifact), null, 2)}\n`);
    return;
  }
  if (phase === 'verify') {
    await verifyCompletedEvidence(artifact);
    return;
  }
  const evidence = await ensureEvidence(artifact);
  if (phase === 'wallet-a') await runWalletAPhase(evidence, artifact);
  if (phase === 'wallet-b') await runWalletBPhase(evidence, artifact);
  if (phase === 'wallet-a-finalize') await runWalletAFinalizePhase(evidence, artifact);
  process.stdout.write(`${JSON.stringify({ status: evidence.status, phase, phaseStatus: evidence.phaseStatus, evidencePath }, null, 2)}\n`);
}

await main();
