import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const rpcUrl = process.env.LIFECYCLE_RPC_URL ?? 'https://rpc.testnet.arc.io';
const account = process.env.LIFECYCLE_ACCOUNT;
const sender = process.env.LIFECYCLE_SENDER;
const recipient = process.env.LIFECYCLE_RECIPIENT ?? sender;
const token = '0x3600000000000000000000000000000000000000';
const expectedChainId = 5042002n;
const paymentAmount = 10_000n;
const taskBudget = 1_000_000n;
const delegatedBudget = 500_000n;
const explorer = 'https://testnet.arcscan.app';
const evidencePath = resolve('docs/TESTNET_EVIDENCE.json');
const receiptPollAttempts = 60;
const receiptPollDelayMs = 1_000;

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

async function send(contract, signature, values = []) {
  const output = await run(cast, [
    'send', contract, signature, ...values,
    '--account', account, '--rpc-url', rpcUrl, '--json',
  ]);
  const hash = output.match(/0x[\da-fA-F]{64}/)?.[0];
  if (!hash) throw new Error(`Could not read transaction hash from cast send ${signature} output`);
  const receipt = await waitForSuccessfulReceipt(hash);
  if (BigInt(receipt.status) !== 1n) throw new Error(`Transaction ${hash} reverted; stopping before the next action`);
  return hash;
}

async function waitForSuccessfulReceipt(hash) {
  for (let attempt = 0; attempt < receiptPollAttempts; attempt += 1) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt !== null) {
      if (BigInt(receipt.status) !== 1n) throw new Error(`Transaction ${hash} reverted; stopping before the next action`);
      return receipt;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, receiptPollDelayMs));
  }
  throw new Error(`Transaction ${hash} was not mined within ${receiptPollAttempts * receiptPollDelayMs / 1_000} seconds`);
}

async function saveEvidence(evidence) {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function main() {
  if (!account || !sender) throw new Error('Set LIFECYCLE_ACCOUNT and LIFECYCLE_SENDER; the encrypted Foundry keystore is used for signing.');
  if (!/^0x[\da-fA-F]{40}$/.test(sender) || !/^0x[\da-fA-F]{40}$/.test(recipient)) throw new Error('LIFECYCLE_SENDER and LIFECYCLE_RECIPIENT must be valid addresses.');
  if (new URL(rpcUrl).href !== 'https://rpc.testnet.arc.io/') {
    throw new Error('Arc lifecycle is restricted to https://rpc.testnet.arc.io.');
  }
  const signerOutput = await run(cast, ['wallet', 'address', '--account', account]);
  const signer = signerOutput.match(/0x[\da-fA-F]{40}/)?.[0];
  if (!signer || signer.toLowerCase() !== sender.toLowerCase()) throw new Error('LIFECYCLE_SENDER does not match the selected Foundry keystore account.');

  const chainId = BigInt(await rpc('eth_chainId'));
  if (chainId !== expectedChainId) throw new Error(`Expected Arc testnet chain ID ${expectedChainId}; received ${chainId}. No transaction sent.`);
  const tokenCode = await rpc('eth_getCode', [token, 'latest']);
  if (tokenCode === '0x' || tokenCode.length <= 2) throw new Error('Arc testnet USDC has no contract code. No transaction sent.');
  const balance = castInteger(await castOutput(['call', token, 'balanceOf(address)(uint256)', sender]));
  if (balance < paymentAmount) throw new Error(`Sender USDC balance is below the 10,000 base-unit payment. No transaction sent.`);

  const taskId = randomHex();
  const taskHash = randomHex();
  const resourceHash = randomHex();
  const outcomeHash = randomHex();
  const nonce = 1n;
  const block = await rpc('eth_getBlockByNumber', ['latest', false]);
  const deadline = BigInt(block.timestamp) + 86_400n;
  const scope = 3n;
  const evidence = {
    network: 'Arc Testnet', chainId: Number(chainId), rpcUrl, token,
    sender, recipient, contractAddress: null,
    taskId, rootMandateId: 1, childMandateId: 2,
    paymentId: null, outcomeHash, paymentAmountBaseUnits: paymentAmount.toString(),
    taskBudgetBaseUnits: taskBudget.toString(), delegatedBudgetBaseUnits: delegatedBudget.toString(),
    retryBlocked: false, transactions: [],
  };
  const deploymentOutput = await run(forge, [
    'create', 'contracts/MandateGraph.sol:MandateGraph',
    '--rpc-url', rpcUrl, '--account', account, '--constructor-args', token, '--broadcast', '--json',
  ]);
  const deployment = JSON.parse(deploymentOutput);
  const contract = deployment.deployedTo;
  const deploymentHash = deployment.transactionHash;
  if (!/^0x[\da-fA-F]{40}$/.test(contract ?? '') || !/^0x[\da-fA-F]{64}$/.test(deploymentHash ?? '')) {
    throw new Error('forge create did not return a deployed address and transaction hash.');
  }
  evidence.contractAddress = contract;
  await waitForSuccessfulReceipt(deploymentHash);
  evidence.transactions.push({ action: 'deploy', hash: deploymentHash, explorerUrl: `${explorer}/tx/${deploymentHash}` });
  await saveEvidence(evidence);
  if ((await rpc('eth_getCode', [contract, 'latest'])) === '0x') throw new Error('Deployment receipt succeeded but contract code is absent; stopping.');

  async function confirmed(action, signature, values) {
    const hash = await send(contract, signature, values);
    evidence.transactions.push({ action, hash, explorerUrl: `${explorer}/tx/${hash}` });
    await saveEvidence(evidence);
    return hash;
  }

  await confirmed('createTask', 'createTask(bytes32,bytes32,uint128,uint64,uint256,address,address,uint8)', [taskId, taskHash, taskBudget, deadline, scope, sender, recipient, 3]);
  if (castInteger(await castOutput(['call', contract, 'nextMandateId()(uint256)'])) !== 2n) throw new Error('Task creation did not produce the expected root mandate; stopping.');
  await confirmed('delegate', 'delegate(uint256,address,uint128,uint64,uint256,address)', [1, sender, delegatedBudget, deadline, scope, recipient]);
  if (castInteger(await castOutput(['call', contract, 'nextMandateId()(uint256)'])) !== 3n) throw new Error('Delegation did not produce the expected child mandate; stopping.');
  await confirmed('approve', 'approve(address,uint256)', [contract, paymentAmount]);

  const encoded = await castOutput([
    'abi-encode', 'f(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)',
    taskId, 2, recipient, paymentAmount, 1, resourceHash, deadline, nonce,
  ]);
  const paymentId = await castOutput(['keccak', encoded]);
  evidence.paymentId = paymentId;
  await saveEvidence(evidence);
  await confirmed('executePayment', 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)', [2, paymentId, recipient, paymentAmount, 1, resourceHash, deadline, nonce, outcomeHash]);
  await confirmed('revokeTask', 'revokeTask(bytes32)', [taskId]);

  const authorized = await castOutput(['call', contract, 'isAuthorized(uint256)(bool)', 2]);
  if (authorized.toLowerCase() !== 'false') throw new Error('Child mandate remained authorized after revocation.');
  const retryOutcome = randomHex();
  const retryEncoded = await castOutput([
    'abi-encode', 'f(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)',
    taskId, 2, recipient, 1, 1, resourceHash, deadline, 2,
  ]);
  const retryPaymentId = await castOutput(['keccak', retryEncoded]);
  const retryData = await castOutput([
    'calldata', 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    2, retryPaymentId, recipient, 1, 1, resourceHash, deadline, 2, retryOutcome,
  ]);
  const retryResult = await rpc('eth_call', [{ from: sender, to: contract, data: retryData }, 'latest']).then(
    () => ({ blocked: false }),
    (error) => ({ blocked: /revert/i.test(error.message) }),
  );
  if (!retryResult.blocked) throw new Error('Read-only retry was not rejected by the revoked task.');
  evidence.retryBlocked = true;
  await saveEvidence(evidence);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`Arc testnet lifecycle stopped: ${error.message}\n`);
  process.exitCode = 1;
});
