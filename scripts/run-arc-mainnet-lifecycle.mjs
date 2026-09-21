import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { arcMainnet, estimateFunding, formatUsdc18, validateDistinctRecipient, validateMainnetRpc } from './arc-mainnet-config.mjs';
import { buildDeploymentInitCode } from './deployment-init-code.mjs';

const rpcUrl = validateMainnetRpc(process.env.ARC_MAINNET_RPC_URL ?? arcMainnet.rpcUrl);
const account = process.env.ARC_MAINNET_ACCOUNT;
const sender = process.env.ARC_MAINNET_SENDER;
const recipient = process.env.ARC_MAINNET_RECIPIENT;
const confirmation = process.env.CONFIRM_ARC_MAINNET;
const preflightOnly = process.argv.includes('--preflight');
const token = arcMainnet.usdcAddress;
const evidencePath = resolve('docs/MAINNET_EVIDENCE.json');
const forge = process.platform === 'win32' ? 'forge.exe' : 'forge';
const cast = process.platform === 'win32' ? 'cast.exe' : 'cast';

function run(command, args, { capture = true } = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args.map(String), { stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit' });
    let stdout = '';
    if (capture) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
    }
    child.once('error', reject);
    child.once('exit', (code) => code === 0
      ? resolveResult(stdout.trim())
      : reject(new Error(`${command} failed with exit code ${code ?? 1}`)));
  });
}

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) {
    const error = new Error(`${method} failed: ${payload.error.message ?? 'RPC error'}`);
    error.rpcCode = payload.error.code;
    error.rpcData = payload.error.data;
    throw error;
  }
  if (payload.result === undefined) throw new Error(`${method} failed: missing result`);
  return payload.result;
}

function formatUsdc6(value) {
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, '0')}`;
}

async function preflight() {
  if (!account) throw new Error('Set ARC_MAINNET_ACCOUNT to an encrypted Foundry keystore account name.');
  validateDistinctRecipient(sender, recipient);
  const signerOutput = await run(cast, ['wallet', 'address', '--account', account]);
  const signer = signerOutput.match(/0x[\da-fA-F]{40}/)?.[0];
  if (!signer || signer.toLowerCase() !== sender.toLowerCase()) throw new Error('ARC_MAINNET_SENDER does not match the selected encrypted Foundry keystore.');

  const chainId = BigInt(await rpc('eth_chainId'));
  if (chainId !== arcMainnet.chainId) throw new Error(`Expected Arc Mainnet chain ID ${arcMainnet.chainId}; received ${chainId}.`);
  const [blockNumber, tokenCode, symbolData, decimalsData, nativeBalance, tokenBalance, gasPrice] = await Promise.all([
    rpc('eth_blockNumber'),
    rpc('eth_getCode', [token, 'latest']),
    rpc('eth_call', [{ to: token, data: '0x95d89b41' }, 'latest']),
    rpc('eth_call', [{ to: token, data: '0x313ce567' }, 'latest']),
    rpc('eth_getBalance', [sender, 'latest']),
    rpc('eth_call', [{ to: token, data: `0x70a08231${sender.slice(2).toLowerCase().padStart(64, '0')}` }, 'latest']),
    rpc('eth_gasPrice'),
  ]);
  if (BigInt(blockNumber) <= 0n) throw new Error('Arc Mainnet RPC returned an invalid latest block.');
  if (typeof tokenCode !== 'string' || tokenCode === '0x' || tokenCode.length <= 2) throw new Error('The official Arc USDC address has no contract bytecode.');
  const symbolBytes = Buffer.from(symbolData.slice(2), 'hex');
  const symbolOffset = Number(BigInt(`0x${symbolBytes.subarray(0, 32).toString('hex')}`));
  const symbolLength = Number(BigInt(`0x${symbolBytes.subarray(symbolOffset, symbolOffset + 32).toString('hex')}`));
  const symbol = symbolBytes.subarray(symbolOffset + 32, symbolOffset + 32 + symbolLength).toString('utf8');
  const decimals = Number(BigInt(decimalsData));
  if (symbol !== 'USDC' || decimals !== arcMainnet.erc20Decimals) throw new Error(`Unexpected Arc USDC metadata: ${symbol}, ${decimals} decimals.`);

  await run(forge, ['build'], { capture: false });
  const artifact = JSON.parse(await readFile('out/MandateGraph.sol/MandateGraph.json', 'utf8'));
  const constructorArgs = `0x${token.slice(2).toLowerCase().padStart(64, '0')}`;
  const initCode = buildDeploymentInitCode(artifact.bytecode.object, constructorArgs);
  const deploymentGas = BigInt(await rpc('eth_estimateGas', [{ from: sender, data: initCode }]));
  const fees = estimateFunding({ deploymentGas, gasPrice: BigInt(gasPrice) });
  const existingNative = BigInt(nativeBalance);
  const existingUsdc = BigInt(tokenBalance);
  const enough = existingNative >= fees.totalFundingWei && existingUsdc >= fees.paymentCostBaseUnits;
  const output = {
    mode: 'read-only-preflight',
    chainId: chainId.toString(),
    rpcUrl,
    latestBlock: BigInt(blockNumber).toString(),
    usdc: { address: token, codeBytes: (tokenCode.length - 2) / 2, symbol, erc20Decimals: decimals },
    signer: { address: signer, encryptedFoundryKeystore: account },
    recipient: { address: recipient, independentWallet: true, vendorOrServiceProof: false },
    balances: { nativeUsdc18: formatUsdc18(existingNative), erc20Usdc6: formatUsdc6(existingUsdc) },
    estimates: {
      deploymentGas: deploymentGas.toString(),
      lifecycleGasReserve: arcMainnet.lifecycleGasReserve.toString(),
      feePriceWeiPerGas: fees.price.toString(),
      bufferedTotalGas: fees.bufferedGas.toString(),
      bufferedGasCostUsdc: formatUsdc18(fees.gasCostWei),
      paymentAmountUsdc: formatUsdc6(fees.paymentCostBaseUnits),
      minimumFundingUsdc: formatUsdc18(fees.totalFundingWei),
    },
    adequateBalance: { nativeGasAndTotalFunding: existingNative >= fees.totalFundingWei, erc20Payment: existingUsdc >= fees.paymentCostBaseUnits },
    transactionsSent: false,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!enough) throw new Error('Signer native USDC balance is below the buffered deployment and lifecycle funding estimate. No transaction sent.');
  return output;
}

async function saveEvidence(evidence) {
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
}

async function send(target, signature, values, evidence, label) {
  const result = await run(cast, [
    'send', target, signature, ...values,
    '--account', account, '--rpc-url', rpcUrl, '--json',
  ]);
  const receipt = JSON.parse(result);
  if (BigInt(receipt.status) !== 1n) throw new Error(`${label} transaction reverted: ${receipt.transactionHash}`);
  evidence.transactions.push({ action: label, hash: receipt.transactionHash, explorerUrl: `${arcMainnet.explorerUrl}/tx/${receipt.transactionHash}` });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  return receipt;
}

async function execute() {
  if (confirmation !== 'YES') throw new Error('Broadcast mode requires CONFIRM_ARC_MAINNET=YES.');
  if (Object.keys(process.env).some((name) => /PRIVATE_KEY/i.test(name) && process.env[name])) {
    throw new Error('Raw private-key environment variables are not supported. Use an encrypted Foundry keystore.');
  }
  try {
    await readFile(evidencePath, 'utf8');
    throw new Error(`${evidencePath} already exists; refusing to deploy or overwrite mainnet evidence.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await preflight();
  const deploymentOutput = await run(forge, [
    'create', 'contracts/MandateGraph.sol:MandateGraph', '--rpc-url', rpcUrl,
    '--account', account, '--broadcast', '--json', '--constructor-args', token,
  ]);
  const deployment = JSON.parse(deploymentOutput);
  if (!/^0x[\da-fA-F]{40}$/.test(deployment.deployedTo ?? '') || !/^0x[\da-fA-F]{64}$/.test(deployment.transactionHash ?? '')) {
    throw new Error('Forge did not return a valid deployment address and transaction hash.');
  }
  const evidence = {
    version: 1,
    network: 'Arc Mainnet',
    chainId: Number(arcMainnet.chainId),
    rpcUrl,
    token,
    sender,
    recipient,
    contractAddress: deployment.deployedTo,
    transactions: [{ action: 'deploy', hash: deployment.transactionHash, explorerUrl: `${arcMainnet.explorerUrl}/tx/${deployment.transactionHash}` }],
    caveat: 'The recipient is a separately controlled demo wallet. No vendor identity or service delivery is claimed.',
  };
  await saveEvidence(evidence);

  const taskId = `0x${randomBytes(32).toString('hex')}`;
  const taskHash = `0x${randomBytes(32).toString('hex')}`;
  const resourceHash = `0x${randomBytes(32).toString('hex')}`;
  const outcomeHash = `0x${randomBytes(32).toString('hex')}`;
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const contract = deployment.deployedTo;
  await send(contract, 'createTask(bytes32,bytes32,uint128,uint64,uint256,address,address,uint8)', [taskId, taskHash, 1_000_000, deadline, 1, sender, recipient, 2], evidence, 'createTask');
  await send(contract, 'delegate(uint256,address,uint128,uint64,uint256,address)', [1, sender, 500_000, deadline, 1, recipient], evidence, 'delegate');
  await send(token, 'approve(address,uint256)', [contract, arcMainnet.paymentAmountBaseUnits], evidence, 'approve');
  const encoded = await run(cast, ['abi-encode', 'f(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)', taskId, 2, recipient, arcMainnet.paymentAmountBaseUnits, 1, resourceHash, deadline, 1]);
  const paymentId = await run(cast, ['keccak', encoded]);
  await send(contract, 'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)', [2, paymentId, recipient, arcMainnet.paymentAmountBaseUnits, 1, resourceHash, deadline, 1, outcomeHash], evidence, 'executePayment');
  await send(contract, 'revokeTask(bytes32)', [taskId], evidence, 'revokeTask');
  const retryPaymentEncoding = await run(cast, ['abi-encode', 'f(bytes32,uint256,address,uint128,uint256,bytes32,uint64,uint256)', taskId, 2, recipient, 1, 1, resourceHash, deadline, 2]);
  const retryPaymentId = await run(cast, ['keccak', retryPaymentEncoding]);
  const retryData = await run(cast, [
    'calldata',
    'executePayment(uint256,bytes32,address,uint128,uint256,bytes32,uint64,uint256,bytes32)',
    2, retryPaymentId, recipient, 1, 1, resourceHash, deadline, 2, outcomeHash,
  ]);
  try {
    await rpc('eth_call', [{ from: sender, to: contract, data: retryData }, 'latest']);
    throw new Error('Read-only revoked retry unexpectedly succeeded.');
  } catch (error) {
    if (error.message.includes('unexpectedly succeeded') || !/revert/i.test(error.message)) throw error;
  }
  evidence.retryBlocked = true;
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (preflightOnly) await preflight();
    else await execute();
  } catch (error) {
    process.stderr.write(`Arc Mainnet ${preflightOnly ? 'preflight' : 'execution'} stopped: ${error.message}\n`);
    process.exitCode = 1;
  }
}

