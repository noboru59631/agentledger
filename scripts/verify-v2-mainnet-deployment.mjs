import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { arcMainnet } from './arc-mainnet-config.mjs';
import { buildDeploymentInitCode } from './deployment-init-code.mjs';
import { byteLength, normalizeRuntimeBytecode } from './arc-testnet-v2-lifecycle-lib.mjs';

const transactionHash = process.env.V2_MAINNET_DEPLOY_TX;
if (!/^0x[\da-fA-F]{64}$/.test(transactionHash ?? '')) throw new Error('V2_MAINNET_DEPLOY_TX must be a public transaction hash.');

const deployer = '0x03607de69C487BcC460eaD7C4Bdfd25805658b75';
const expectedContract = '0x015099f831c247460b467154c73028804Ea38a10';
const expectedNonce = 39n;
const outputPath = resolve('docs/MAINNET_V2_DEPLOYMENT_EVIDENCE.json');
const sourcifyApiUrl = `https://sourcify.dev/server/v2/contract/${arcMainnet.chainId}/${expectedContract.toLowerCase()}`;
const sourcifyJobId = '897518d7-6bf7-4cbf-92c2-0d59fbb848ae';
const castBinary = process.env.CAST_BIN
  ?? (process.platform === 'win32' ? resolve(process.env.USERPROFILE, '.foundry/bin/cast.exe') : 'cast');
const artifact = JSON.parse(await readFile('out/MandateGraphV2.sol/MandateGraphV2.json', 'utf8'));
const constructorArgsData = `0x${encodeAddress(arcMainnet.usdcAddress)}${encodeAddress(arcMainnet.identityRegistry)}`;
const initCode = buildDeploymentInitCode(artifact.bytecode.object, constructorArgsData);

const rpc = async (method, params = []) => {
  const response = await fetch(arcMainnet.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error || payload.result === undefined) throw new Error(`${method}: ${payload.error?.message ?? 'missing result'}`);
  return payload.result;
};

const [chainIdHex, transaction, receipt] = await Promise.all([
  rpc('eth_chainId'),
  rpc('eth_getTransactionByHash', [transactionHash]),
  rpc('eth_getTransactionReceipt', [transactionHash]),
]);
if (!transaction || !receipt) throw new Error('Deployment transaction is not confirmed.');
if (BigInt(chainIdHex) !== arcMainnet.chainId) throw new Error('Deployment receipt is not on Arc Mainnet.');
if (receipt.status !== '0x1') throw new Error('Deployment transaction reverted.');
if (transaction.from.toLowerCase() !== deployer.toLowerCase() || receipt.from.toLowerCase() !== deployer.toLowerCase()) throw new Error('Unexpected deployment sender.');
if (transaction.to !== null || receipt.to !== null) throw new Error('Transaction is not contract creation.');
if (BigInt(transaction.nonce) !== expectedNonce) throw new Error('Unexpected deployment nonce.');
if (receipt.contractAddress.toLowerCase() !== expectedContract.toLowerCase()) throw new Error('Unexpected deployed contract address.');
if (transaction.input.toLowerCase() !== initCode.toLowerCase()) throw new Error('Broadcast init code differs from the reviewed local artifact and constructor arguments.');

const [runtimeCode, usdcResult, registryResult, nextMandateResult, deployerBalanceHex] = await Promise.all([
  rpc('eth_getCode', [expectedContract, 'latest']),
  rpc('eth_call', [{ to: expectedContract, data: '0x3e413bee' }, 'latest']),
  rpc('eth_call', [{ to: expectedContract, data: '0x134e18f4' }, 'latest']),
  rpc('eth_call', [{ to: expectedContract, data: '0x17cd54f2' }, 'latest']),
  rpc('eth_getBalance', [deployer, 'latest']),
]);
if (runtimeCode === '0x') throw new Error('Deployed V2 contract has no runtime bytecode.');

const immutableReferences = artifact.deployedBytecode.immutableReferences ?? {};
const localNormalizedRuntime = normalizeRuntimeBytecode(artifact.deployedBytecode.object, immutableReferences);
const deployedNormalizedRuntime = normalizeRuntimeBytecode(runtimeCode, immutableReferences);
const localNormalizedRuntimeHash = keccak(localNormalizedRuntime);
const deployedNormalizedRuntimeHash = keccak(deployedNormalizedRuntime);
if (localNormalizedRuntimeHash !== deployedNormalizedRuntimeHash) throw new Error('Deployed V2 runtime does not match the reviewed local artifact.');

const configuredUsdc = decodeAddress(usdcResult);
const configuredRegistry = decodeAddress(registryResult);
if (configuredUsdc.toLowerCase() !== arcMainnet.usdcAddress.toLowerCase()) throw new Error('Deployed V2 USDC configuration mismatch.');
if (configuredRegistry.toLowerCase() !== arcMainnet.identityRegistry.toLowerCase()) throw new Error('Deployed V2 Identity Registry configuration mismatch.');
if (BigInt(nextMandateResult) !== 1n) throw new Error('Deployed V2 initial mandate state is not empty.');

const gasUsed = BigInt(receipt.gasUsed);
const effectiveGasPrice = BigInt(receipt.effectiveGasPrice);
const receiptFeeWei = gasUsed * effectiveGasPrice;
const sourceVerification = await readSourcifyStatus();
const evidence = {
  version: 1,
  status: 'pass',
  verifiedAt: new Date().toISOString(),
  safety: {
    explicitDeployApprovalReceived: true,
    transactionSignedLocallyWithEncryptedKeystore: true,
    privateSignerMaterialStoredOrDisplayed: false,
    deploymentOnly: true,
    smokeLifecycleExecuted: false,
    uiWritesEnabled: false,
  },
  network: {
    name: 'Arc Mainnet',
    chainId: arcMainnet.chainId.toString(),
    rpcUrl: arcMainnet.rpcUrl,
    explorerUrl: arcMainnet.explorerUrl,
  },
  transaction: {
    hash: transactionHash,
    explorer: `${arcMainnet.explorerUrl}/tx/${transactionHash}`,
    blockNumber: BigInt(receipt.blockNumber).toString(),
    blockHash: receipt.blockHash,
    transactionIndex: BigInt(receipt.transactionIndex).toString(),
    from: receipt.from,
    to: receipt.to,
    nonce: BigInt(transaction.nonce).toString(),
    type: BigInt(receipt.type).toString(),
    status: 'success',
    gasLimit: BigInt(transaction.gas).toString(),
    gasUsed: gasUsed.toString(),
    effectiveGasPriceWei: effectiveGasPrice.toString(),
    receiptFeeWei: receiptFeeWei.toString(),
    receiptFeeNative: formatUnits(receiptFeeWei, 18),
    valueWei: BigInt(transaction.value).toString(),
    initCodeHash: keccak(transaction.input),
  },
  contract: {
    address: receipt.contractAddress,
    explorer: `${arcMainnet.explorerUrl}/address/${receipt.contractAddress}`,
    runtimeBytes: byteLength(runtimeCode),
    normalizedRuntimeHash: deployedNormalizedRuntimeHash,
    matchesLocalArtifact: true,
    creationBytecodeHash: keccak(artifact.bytecode.object),
    constructorArgs: {
      usdc: configuredUsdc,
      identityRegistry: configuredRegistry,
    },
    initialState: {
      nextMandateId: BigInt(nextMandateResult).toString(),
      registeredAgents: 0,
      tasks: 0,
      allowances: 0,
    },
  },
  deployer: {
    address: deployer,
    balanceAfterWei: BigInt(deployerBalanceHex).toString(),
  },
  sourceVerification,
  remainingGates: [
    ...(sourceVerification.status === 'exact_match' ? [] : ['publish explorer or Sourcify source verification']),
    'run an explicitly approved controlled Mainnet smoke lifecycle with minimal funds',
    'verify smoke evidence and zero residual allowance',
    'obtain separate approval before enabling the public UI contract address',
  ],
};

await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));

function encodeAddress(address) {
  return address.slice(2).toLowerCase().padStart(64, '0');
}

function decodeAddress(value) {
  return `0x${value.slice(-40)}`;
}

function keccak(value) {
  return execFileSync(castBinary, ['keccak', value], { encoding: 'utf8' }).trim();
}

function formatUnits(value, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function readSourcifyStatus() {
  const response = await fetch(sourcifyApiUrl);
  if (response.status === 404) {
    return { provider: 'Sourcify', status: 'not_found', checkedAt: new Date().toISOString(), apiUrl: sourcifyApiUrl };
  }
  if (!response.ok) throw new Error(`Sourcify status HTTP ${response.status}`);
  const result = await response.json();
  return {
    provider: 'Sourcify',
    status: result.match,
    creationMatch: result.creationMatch,
    runtimeMatch: result.runtimeMatch,
    matchId: result.matchId,
    verifiedAt: result.verifiedAt,
    apiUrl: sourcifyApiUrl,
    jobId: sourcifyJobId,
    jobUrl: `https://sourcify.dev/server/verify-ui/jobs/${sourcifyJobId}`,
  };
}
