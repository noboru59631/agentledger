import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { arcMainnet } from './arc-mainnet-config.mjs';
import { buildDeploymentInitCode } from './deployment-init-code.mjs';

const DEPLOYER = '0x03607de69C487BcC460eaD7C4Bdfd25805658b75';
const OUTPUT_PATH = resolve('docs/MAINNET_V2_DEPLOYMENT_PLAN.json');
const artifact = JSON.parse(await readFile('out/MandateGraphV2.sol/MandateGraphV2.json', 'utf8'));
const creationBytecode = `0x${artifact.bytecode.object.replace(/^0x/, '')}`;
const constructorArgsData = `0x${encodeAddress(arcMainnet.usdcAddress)}${encodeAddress(arcMainnet.identityRegistry)}`;
const initCode = buildDeploymentInitCode(creationBytecode, constructorArgsData);
const castBinary = process.env.CAST_BIN
  ?? (process.platform === 'win32' ? resolve(process.env.USERPROFILE, '.foundry/bin/cast.exe') : 'cast');

const rpc = async (method, params = []) => {
  const response = await fetch(arcMainnet.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${method}: ${payload.error.message}`);
  return payload.result;
};

const [
  chainIdHex, blockNumberHex, usdcCode, registryCode, deployerBalanceHex,
  deployerNonceHex, gasPriceHex, estimatedGasHex,
] = await Promise.all([
  rpc('eth_chainId'),
  rpc('eth_blockNumber'),
  rpc('eth_getCode', [arcMainnet.usdcAddress, 'latest']),
  rpc('eth_getCode', [arcMainnet.identityRegistry, 'latest']),
  rpc('eth_getBalance', [DEPLOYER, 'latest']),
  rpc('eth_getTransactionCount', [DEPLOYER, 'pending']),
  rpc('eth_gasPrice'),
  rpc('eth_estimateGas', [{ from: DEPLOYER, data: initCode }]),
]);
const creationBytecodeHash = keccak(creationBytecode);
const initCodeHash = keccak(initCode);

const chainId = BigInt(chainIdHex);
if (chainId !== arcMainnet.chainId) throw new Error(`Expected Arc Mainnet chain ID ${arcMainnet.chainId}, received ${chainId}.`);
if (usdcCode === '0x' || registryCode === '0x') throw new Error('Pinned Mainnet USDC or Identity Registry has no bytecode.');

const estimatedGas = BigInt(estimatedGasHex);
const gasLimit = (estimatedGas * 120n + 99n) / 100n;
const gasPriceWei = BigInt(gasPriceHex);
const estimatedFeeWei = estimatedGas * gasPriceWei;
const bufferedMaximumFeeWei = gasLimit * gasPriceWei;
const plan = {
  version: 1,
  status: 'ready-for-explicit-approval',
  generatedAt: new Date().toISOString(),
  safety: {
    readOnly: true,
    transactionSigned: false,
    transactionBroadcast: false,
    mainnetWriteLockChanged: false,
  },
  network: {
    name: 'Arc Mainnet',
    chainId: chainId.toString(),
    rpcUrl: arcMainnet.rpcUrl,
    observedBlock: BigInt(blockNumberHex).toString(),
  },
  deployment: {
    contract: 'MandateGraphV2',
    deployer: DEPLOYER,
    deployerNonce: BigInt(deployerNonceHex).toString(),
    deployerNativeBalanceWei: BigInt(deployerBalanceHex).toString(),
    creationBytecodeBytes: (creationBytecode.length - 2) / 2,
    creationBytecodeHash,
    initCodeHash,
    constructorArgs: {
      usdc: arcMainnet.usdcAddress,
      identityRegistry: arcMainnet.identityRegistry,
    },
    gas: {
      estimatedGas: estimatedGas.toString(),
      proposedGasLimit: gasLimit.toString(),
      gasPriceWei: gasPriceWei.toString(),
      estimatedFeeWei: estimatedFeeWei.toString(),
      bufferedMaximumFeeWei: bufferedMaximumFeeWei.toString(),
      estimatedFeeNative: formatUnits(estimatedFeeWei, 18),
      bufferedMaximumFeeNative: formatUnits(bufferedMaximumFeeWei, 18),
    },
    initialSettings: {
      agentsRegistered: 0,
      tasksCreated: 0,
      allowancesGranted: 0,
      ownerSignedRegistrationRequiredPerAgent: true,
    },
  },
  verificationRequiredBeforeUiUnlock: [
    'receipt status is success and deployed address is recorded',
    'deployed normalized runtime hash matches the reviewed local MandateGraphV2 artifact',
    'constructor USDC and Identity Registry configuration matches this plan',
    'explorer or Sourcify verification succeeds',
    'controlled Mainnet smoke lifecycle passes with minimal funds',
    'a separate explicit approval enables the public UI contract address',
  ],
  v1ToV2Changes: [
    'authorization follows ERC-8004 ownerOf for each agentId',
    'task ownership and USDC payment custody remain with each task owner',
    'task identifiers are owner-namespaced to prevent cross-wallet collision',
    'ownership transfer freezes stale-owner administration and stale tasks',
    'cross-user administration, task, payment, proof, and delegation paths revert',
  ],
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify(plan, null, 2));

function encodeAddress(address) {
  return address.slice(2).toLowerCase().padStart(64, '0');
}

function formatUnits(value, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = value / divisor;
  const fraction = (value % divisor).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function keccak(value) {
  return execFileSync(castBinary, ['keccak', value], { encoding: 'utf8' }).trim();
}
