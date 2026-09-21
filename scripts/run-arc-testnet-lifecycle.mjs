import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const rpcUrl = process.env.LIFECYCLE_RPC_URL ?? 'https://rpc.testnet.arc.io';
const account = process.env.LIFECYCLE_ACCOUNT;
const sender = process.env.LIFECYCLE_SENDER;
const resumeMode = process.argv.includes('--resume');
const token = '0x3600000000000000000000000000000000000000';
const expectedChainId = 5042002n;
const paymentAmount = 10_000n;
const taskBudget = 1_000_000n;
const delegatedBudget = 500_000n;
const rootScope = 3n;
const paymentServiceClass = 1n;
const paymentNonce = 1n;
const explorer = 'https://testnet.arcscan.app';
const evidencePath = resolve('docs/TESTNET_EVIDENCE.json');
const receiptPollAttempts = 180;
const receiptPollDelayMs = 1_000;
const droppedAfterConsecutiveMisses = 45;
const zeroAddress = '0x0000000000000000000000000000000000000000';

function randomHex(bytes = 32) {
  return `0x${randomBytes(bytes).toString('hex')}`;
}

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error || payload.result === undefined) throw new Error(`${method} failed: ${payload.error?.message ?? 'missing result'}`);
  return payload.result;
}

async function optionalRpc(method, params = []) {
  try {
    return { ok: true, value: await rpc(method, params) };
  } catch (error) {
    return { ok: false, error };
  }
}

function run(command, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args.map(String), { stdio: ['inherit', 'pipe', 'inherit'] });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code !== 0) reject(new Error(`${command} failed with exit code ${code ?? 1}`));
      else resolveResult(stdout.trim());
    });
  });
}

const forge = process.platform === 'win32' ? 'forge.exe' : 'forge';
const cast = process.platform === 'win32' ? 'cast.exe' : 'cast';

async function castOutput(args) {
  return run(cast, [...args, '--rpc-url', rpcUrl]);
}

function castInteger(output) {
  const integer = output.trim().split(/\s+/)[0];
  return BigInt(integer);
}

function outputLines(output) {
  return output.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

async function saveEvidence(evidence) {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

function ensureEvidenceShape(evidence) {
  evidence.steps ??= {};
  evidence.transactions ??= [];
  evidence.retryBlocked ??= false;
  return evidence;
}

function upsertSuccessfulTransaction(evidence, action, hash) {
  if (!evidence.transactions.some((transaction) => transaction.action === action && transaction.hash === hash)) {
    evidence.transactions.push({ action, hash, explorerUrl: `${explorer}/tx/${hash}` });
  }
}

async function confirmTransaction(hash) {
  let consecutiveMisses = 0;
  let lastRpcError = null;

  for (let attempt = 0; attempt < receiptPollAttempts; attempt += 1) {
    const receiptResult = await optionalRpc('eth_getTransactionReceipt', [hash]);
    if (receiptResult.ok && receiptResult.value !== null) {
      const receipt = receiptResult.value;
      return BigInt(receipt.status) === 1n
        ? { state: 'success', receipt }
        : { state: 'reverted', receipt };
    }
    if (!receiptResult.ok) lastRpcError = receiptResult.error;

    const transactionResult = await optionalRpc('eth_getTransactionByHash', [hash]);
    if (transactionResult.ok) {
      if (transactionResult.value !== null) {
        consecutiveMisses = 0;
      } else if (receiptResult.ok) {
        consecutiveMisses += 1;
      }
    } else {
      lastRpcError = transactionResult.error;
    }

    if (consecutiveMisses >= droppedAfterConsecutiveMisses) {
      return { state: 'dropped', consecutiveMisses };
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, receiptPollDelayMs));
  }

  return { state: 'timeout', lastRpcError: lastRpcError?.message ?? null };
}

async function reconcileRecordedPending(evidence) {
  for (const [action, step] of Object.entries(evidence.steps)) {
    if (step?.status !== 'pending' || !step.hash) continue;

    const receipt = await optionalRpc('eth_getTransactionReceipt', [step.hash]);
    if (receipt.ok && receipt.value !== null) {
      if (BigInt(receipt.value.status) !== 1n) {
        step.status = 'reverted';
        await saveEvidence(evidence);
        throw new Error(`Recorded ${action} transaction ${step.hash} reverted. No transaction sent.`);
      }
      step.status = 'success';
      upsertSuccessfulTransaction(evidence, action, step.hash);
      await saveEvidence(evidence);
      continue;
    }

    const transaction = await optionalRpc('eth_getTransactionByHash', [step.hash]);
    if (transaction.ok && transaction.value !== null) {
      const result = await confirmTransaction(step.hash);
      if (result.state === 'success') {
        step.status = 'success';
        upsertSuccessfulTransaction(evidence, action, step.hash);
        await saveEvidence(evidence);
        continue;
      }
      step.status = result.state;
      await saveEvidence(evidence);
      throw new Error(`Recorded ${action} transaction ${step.hash} is ${result.state}. No new transaction sent; run resume again only after reviewing the evidence.`);
    }

    if (receipt.ok && transaction.ok) {
      step.status = 'dropped';
      await saveEvidence(evidence);
      throw new Error(`Recorded ${action} transaction ${step.hash} is no longer present on Arc testnet. Marked dropped; no new transaction sent. Run resume again to retry this step deliberately.`);
    }

    throw new Error(`Could not reconcile recorded ${action} transaction because Arc RPC returned an error. No transaction sent.`);
  }
}

async function sendStep(evidence, action, target, signature, values = []) {
  const previous = evidence.steps[action];
  if (previous?.status === 'pending') {
    throw new Error(`${action} still has a pending transaction in evidence; refusing to duplicate it.`);
  }

  const output = await run(cast, [
    'send', target, signature, ...values,
    '--account', account, '--rpc-url', rpcUrl, '--async', '--json',
  ]);
  const hash = output.match(/0x[\da-fA-F]{64}/)?.[0];
  if (!hash) throw new Error(`Could not read transaction hash from cast send ${signature} output`);

  evidence.steps[action] = { status: 'pending', hash, explorerUrl: `${explorer}/tx/${hash}` };
  await saveEvidence(evidence);

  const result = await confirmTransaction(hash);
  evidence.steps[action].status = result.state;
  await saveEvidence(evidence);

  if (result.state !== 'success') {
    throw new Error(
      result.state === 'dropped'
        ? `Transaction ${hash} for ${action} disappeared from Arc testnet after sustained polling. Evidence was preserved; run resume again to retry deliberately.`
        : `Transaction ${hash} for ${action} ended as ${result.state}. Evidence was preserved.`,
    );
  }

  upsertSuccessfulTransaction(evidence, action, hash);
  await saveEvidence(evidence);
  return hash;
}

async function readTask(contract, taskId) {
  const output = await castOutput([
    'call', contract,
    'tasks(bytes32)(address,uint128,uint128,uint64,bytes32,bool)',
    taskId, '--json',
  ]);
  const values = JSON.parse(output);
  if (!Array.isArray(values) || values.length < 6) throw new Error('Could not decode task state from MandateGraph.');
  return {
    owner: String(values[0]),
    budget: BigInt(String(values[1])),
    spent: BigInt(String(values[2])),
    deadline: BigInt(String(values[3])),
    taskHash: String(values[4]),
    revoked: values[5] === true || String(values[5]).toLowerCase() === 'true',
  };
}

async function readMandate(contract, mandateId) {
  const output = await castOutput([
    'call', contract,
    'mandates(uint256)(bytes32,uint256,address,address,uint128,uint128,uint128,uint64,uint8,uint256,bool,uint256)',
    mandateId, '--json',
  ]);
  const values = JSON.parse(output);
  if (!Array.isArray(values) || values.length < 12) throw new Error(`Could not decode mandate ${mandateId} state.`);
  return {
    taskId: String(values[0]),
    parentId: BigInt(String(values[1])),
    agent: String(values[2]),
    recipient: String(values[3]),
    budget: BigInt(String(values[4])),
    spent: BigInt(String(values[5])),
    allocated: BigInt(String(values[6])),
    expiry: BigInt(String(values[7])),
    depth: BigInt(String(values[8])),
    serviceScope: BigInt(String(values[9])),
    revoked: values[10] === true || String(values[10]).toLowerCase() === 'true',
    activeChildren: BigInt(String(values[11])),
  };
}

async function validateEnvironment(evidence = null) {
  if (!account || !sender) throw new Error('Set LIFECYCLE_ACCOUNT and LIFECYCLE_SENDER; the encrypted Foundry keystore is used for signing.');
  if (!/^0x[\da-fA-F]{40}$/.test(sender)) throw new Error('LIFECYCLE_SENDER must be a valid address.');
  if (new URL(rpcUrl).href !== 'https://rpc.testnet.arc.io/') {
    throw new Error('Arc lifecycle is restricted to https://rpc.testnet.arc.io.');
  }

  const signerOutput = await run(cast, ['wallet', 'address', '--account', account]);
  const signer = signerOutput.match(/0x[\da-fA-F]{40}/)?.[0];
  if (!signer || signer.toLowerCase() !== sender.toLowerCase()) {
    throw new Error('LIFECYCLE_SENDER does not match the selected Foundry keystore account.');
  }

  const chainId = BigInt(await rpc('eth_chainId'));
  if (chainId !== expectedChainId) throw new Error(`Expected Arc testnet chain ID ${expectedChainId}; received ${chainId}. No transaction sent.`);

  const tokenCode = await rpc('eth_getCode', [token, 'latest']);
  if (tokenCode === '0x' || tokenCode.length <= 2) throw new Error('Arc testnet USDC has no contract code. No transaction sent.');

  const balance = castInteger(await castOutput(['call', token, 'balanceOf(address)(uint256)', sender]));
  if (balance < paymentAmount) throw new Error('Sender USDC balance is below the 10,000 base-unit payment. No transaction sent.');

  if (evidence) {
    if (evidence.chainId !== Number(expectedChainId)) throw new Error('Evidence chain ID does not match Arc testnet. No transaction sent.');
    if ((evidence.sender ?? '').toLowerCase() !== sender.toLowerCase()) throw new Error('Evidence sender does not match LIFECYCLE_SENDER. No transaction sent.');
    if ((evidence.token ?? '').toLowerCase() !== token.toLowerCase()) throw new Error('Evidence token does not match Arc testnet USDC. No transaction sent.');
  }

  return { chainId, balance };
}

async function prepareFreshEvidence(chainId) {
  const recipient = process.env.LIFECYCLE_RECIPIENT ?? sender;
  if (!/^0x[\da-fA-F]{40}$/.test(recipient)) throw new Error('LIFECYCLE_RECIPIENT must be a valid address.');

  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  return ensureEvidenceShape({
    version: 2,
    network: 'Arc Testnet',
    chainId: Number(chainId),
    rpcUrl,
    token,
    sender,
    recipient,
    contractAddress: null,
    taskId: randomHex(),
    taskHash: randomHex(),
    rootMandateId: 1,
    childMandateId: 2,
    deadline: (BigInt(block.timestamp) + 86_400n).toString(),
    scope: rootScope.toString(),
    resourceHash: randomHex(),
    paymentNonce: paymentNonce.toString(),
    paymentId: null,
    outcomeHash: randomHex(),
    paymentAmountBaseUnits: paymentAmount.toString(),
    taskBudgetBaseUnits: taskBudget.toString(),
    delegatedBudgetBaseUnits: delegatedBudget.toString(),
    retryBlocked: false,
    steps: {},
    transactions: [],
  });
}

async function loadResumeEvidence() {
  let evidence;
  try {
    evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  } catch (error) {
    throw new Error(`Resume mode requires ${evidencePath}: ${error.message}`);
  }
  ensureEvidenceShape(evidence);
  if (!/^0x[\da-fA-F]{40}$/.test(evidence.contractAddress ?? '')) {
    throw new Error('Resume evidence does not contain a valid contractAddress.');
  }
  if (!/^0x[\da-fA-F]{64}$/.test(evidence.taskId ?? '')) {
    throw new Error('Resume evidence does not contain a valid taskId.');
  }
  return evidence;
}

async function deployFresh(evidence) {
  const deploymentOutput = await run(forge, [
    'create', 'contracts/MandateGraph.sol:MandateGraph',
    '--rpc-url', rpcUrl, '--account', account, '--broadcast', '--json', '--constructor-args', token,
  ]);
  const deployment = JSON.parse(deploymentOutput);
  const contract = deployment.deployedTo;
  const deploymentHash = deployment.transactionHash;
  if (!/^0x[\da-fA-F]{40}$/.test(contract ?? '') || !/^0x[\da-fA-F]{64}$/.test(deploymentHash ?? '')) {
    throw new Error('forge create did not return a deployed address and transaction hash.');
  }

  evidence.contractAddress = contract;
  evidence.steps.deploy = { status: 'pending', hash: deploymentHash, explorerUrl: `${explorer}/tx/${deploymentHash}` };
  await saveEvidence(evidence);

  const result = await confirmTransaction(deploymentHash);
  evidence.steps.deploy.status = result.state;
  await saveEvidence(evidence);
  if (result.state !== 'success') throw new Error(`Deployment ${deploymentHash} ended as ${result.state}. Evidence was preserved.`);

  upsertSuccessfulTransaction(evidence, 'deploy', deploymentHash);
  await saveEvidence(evidence);
  return contract;
}

async function validateExistingContract(evidence) {
  const contract = evidence.contractAddress;
  const code = await rpc('eth_getCode', [contract, 'latest']);
  if (code === '0x' || code.length <= 2) throw new Error('Resume contract has no runtime code on Arc testnet. No transaction sent.');

  const configuredUsdc = await castOutput(['call', contract, 'usdc()(address)']);
  const match = configuredUsdc.match(/0x[\da-fA-F]{40}/)?.[0];
  if (!match || match.toLowerCase() !== token.toLowerCase()) {
    throw new Error('Resume contract is not configured with the expected Arc testnet USDC. No transaction sent.');
  }
  return contract;
}

async function ensureTask(evidence, contract) {
  let task = await readTask(contract, evidence.taskId);
  if (task.owner.toLowerCase() !== zeroAddress) {
    if (task.owner.toLowerCase() !== sender.toLowerCase()) throw new Error('Existing task owner does not match LIFECYCLE_SENDER.');
    evidence.taskHash = task.taskHash;
    evidence.deadline = task.deadline.toString();
    evidence.steps.createTask = { ...(evidence.steps.createTask ?? {}), status: 'success', inferredOnchain: true };
    await saveEvidence(evidence);
    return task;
  }

  if (!evidence.taskHash) evidence.taskHash = randomHex();
  if (!evidence.deadline || BigInt(evidence.deadline) <= BigInt((await rpc('eth_getBlockByNumber', ['latest', false])).timestamp)) {
    const block = await rpc('eth_getBlockByNumber', ['latest', false]);
    evidence.deadline = (BigInt(block.timestamp) + 86_400n).toString();
  }
  evidence.scope ??= rootScope.toString();
  await saveEvidence(evidence);

  await sendStep(
    evidence,
    'createTask',
    contract,
    'createTask(bytes32,bytes32,uint128,uint64,uint256,address,address,uint8)',
    [evidence.taskId, evidence.taskHash, taskBudget, BigInt(evidence.deadline), BigInt(evidence.scope), sender, evidence.recipient ?? sender, 3],
  );

  task = await readTask(contract, evidence.taskId);
  if (task.owner.toLowerCase() !== sender.toLowerCase()) throw new Error('Task creation receipt succeeded but task owner was not recorded as expected.');
  return task;
}

async function ensureDelegation(evidence, contract) {
  const nextMandateId = castInteger(await castOutput(['call', contract, 'nextMandateId()(uint256)']));
  if (nextMandateId >= 3n) {
    const child = await readMandate(contract, 2);
    if (child.agent.toLowerCase() === zeroAddress || child.taskId.toLowerCase() !== evidence.taskId.toLowerCase()) {
      throw new Error('Mandate ID 2 already exists but does not match the resume task; refusing to create a duplicate delegation.');
    }
    evidence.steps.delegate = { ...(evidence.steps.delegate ?? {}), status: 'success', inferredOnchain: true };
    await saveEvidence(evidence);
    return child;
  }

  await sendStep(
    evidence,
    'delegate',
    contract,
    'delegate(uint256,address,uint128,uint64,uint256,address)',
    [1, sender, delegatedBudget, BigInt(evidence.deadline), BigInt(evidence.scope ?? rootScope), evidence.recipient ?? sender],
  );

  const child = await readMandate(contract, 2);
  if (child.taskId.toLowerCase() !== evidence.taskId.toLowerCase()) throw new Error('Delegation receipt succeeded but mandate 2 does not match the task.');
  return child;
}

async function ensureApproval(evidence, contract) {
  const allowance = castInteger(await castOutput(['call', token, 'allowance(address,address)(uint256)', sender, contract]));
  if (allowance >= paymentAmount) {
    evidence.steps.approve = { ...(evidence.steps.approve ?? {}), status: 'success', inferredOnchain: true };
    await saveEvidence(evidence);
    return;
  }

  await sendStep(evidence, 'approve', token, 'approve(address,uint256)', [contract, paymentAmount]);
}

async function ensurePayment(evidence, contract) {
  evidence.resourceHash ??= randomHex();
  evidence.outcomeHash ??= randomHex();
  evidence.paymentNonce ??= paymentNonce.toString();
  await saveEvidence(evidence);

  const encoded = await castOutput([
    'abi-encode', 'f(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)',
    evidence.taskId, 2, evidence.recipient ?? sender, paymentAmount, paymentServiceClass,
    evidence.resourceHash, BigInt(evidence.deadline), BigInt(evidence.paymentNonce),
  ]);
  const paymentId = await castOutput(['keccak', encoded]);
  evidence.paymentId = paymentId;
  await saveEvidence(evidence);

  const alreadyUsed = (await castOutput(['call', contract, 'usedPaymentIds(bytes32)(bool)', paymentId])).toLowerCase() === 'true';
  if (alreadyUsed) {
    evidence.steps.executePayment = { ...(evidence.steps.executePayment ?? {}), status: 'success', inferredOnchain: true };
    await saveEvidence(evidence);
    return;
  }

  await sendStep(
    evidence,
    'executePayment',
    contract,
    'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    [2, paymentId, evidence.recipient ?? sender, paymentAmount, paymentServiceClass, evidence.resourceHash, BigInt(evidence.deadline), BigInt(evidence.paymentNonce), evidence.outcomeHash],
  );
}

async function ensureRevocation(evidence, contract) {
  const task = await readTask(contract, evidence.taskId);
  if (task.revoked) {
    evidence.steps.revokeTask = { ...(evidence.steps.revokeTask ?? {}), status: 'success', inferredOnchain: true };
    await saveEvidence(evidence);
    return;
  }

  await sendStep(evidence, 'revokeTask', contract, 'revokeTask(bytes32)', [evidence.taskId]);
}

async function verifyRetryBlocked(evidence, contract) {
  const authorized = await castOutput(['call', contract, 'isAuthorized(uint256)(bool)', 2]);
  if (authorized.toLowerCase() !== 'false') throw new Error('Child mandate remained authorized after task revocation.');

  const retryOutcome = randomHex();
  const retryEncoded = await castOutput([
    'abi-encode', 'f(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)',
    evidence.taskId, 2, evidence.recipient ?? sender, 1, paymentServiceClass, evidence.resourceHash,
    BigInt(evidence.deadline), BigInt(evidence.paymentNonce) + 1n,
  ]);
  const retryPaymentId = await castOutput(['keccak', retryEncoded]);
  const retryData = await castOutput([
    'calldata', 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    2, retryPaymentId, evidence.recipient ?? sender, 1, paymentServiceClass, evidence.resourceHash,
    BigInt(evidence.deadline), BigInt(evidence.paymentNonce) + 1n, retryOutcome,
  ]);
  const retryResult = await rpc('eth_call', [{ from: sender, to: contract, data: retryData }, 'latest']).then(
    () => ({ blocked: false }),
    (error) => ({ blocked: /revert/i.test(error.message) }),
  );
  if (!retryResult.blocked) throw new Error('Read-only retry was not rejected by the revoked task.');

  evidence.retryBlocked = true;
  evidence.steps.retryCheck = { status: 'success', readOnly: true };
  await saveEvidence(evidence);
}

async function runLifecycle(evidence, contract) {
  await reconcileRecordedPending(evidence);
  await ensureTask(evidence, contract);
  await ensureDelegation(evidence, contract);
  await ensureApproval(evidence, contract);
  await ensurePayment(evidence, contract);
  await ensureRevocation(evidence, contract);
  await verifyRetryBlocked(evidence, contract);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

async function main() {
  if (resumeMode) {
    const evidence = await loadResumeEvidence();
    await validateEnvironment(evidence);
    const contract = await validateExistingContract(evidence);
    await runLifecycle(evidence, contract);
    return;
  }

  const { chainId } = await validateEnvironment();
  const evidence = await prepareFreshEvidence(chainId);
  await saveEvidence(evidence);
  const contract = await deployFresh(evidence);
  if ((await rpc('eth_getCode', [contract, 'latest'])) === '0x') throw new Error('Deployment receipt succeeded but contract code is absent; stopping.');
  await runLifecycle(evidence, contract);
}

main().catch((error) => {
  process.stderr.write(`Arc testnet lifecycle stopped: ${error.message}\n`);
  process.exitCode = 1;
});
