import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  arcMainnet,
  arcTestnetCandidate,
  estimateFunding,
  estimateWriteCost,
  formatUsdc18,
  validateDistinctRecipient,
  validateMainnetRpc,
} from './arc-mainnet-config.mjs';
import { buildDeploymentInitCode } from './deployment-init-code.mjs';
import { byteLength, normalizeImmutableReferences } from './runtime-bytecode.mjs';

const preflightOnly = process.argv.includes('--preflight');
if (!preflightOnly) {
  process.stderr.write('Arc Mainnet preflight stopped: Mainnet broadcast is disabled; run with --preflight for read-only checks.\n');
  process.exitCode = 1;
} else {
  await preflight().catch((error) => {
    process.stderr.write(`Arc Mainnet preflight stopped: ${error.message}\n`);
    process.exitCode = 1;
  });
}

async function preflight() {
  const rpcUrl = validateMainnetRpc(process.env.ARC_MAINNET_RPC_URL ?? arcMainnet.rpcUrl);
  const sender = process.env.ARC_MAINNET_SENDER;
  const recipient = process.env.ARC_MAINNET_RECIPIENT;
  const agentUri = process.env.ARC_MAINNET_AGENT_URI ?? 'https://agentledger-livid.vercel.app/agent-registration.json';
  validateDistinctRecipient(sender, recipient);
  if (new URL(agentUri).protocol !== 'https:') throw new Error('ARC_MAINNET_AGENT_URI must use HTTPS.');

  const foundryBin = process.env.FOUNDRY_BIN ?? join(homedir(), '.foundry', 'bin');
  const cast = process.platform === 'win32' ? join(foundryBin, 'cast.exe') : 'cast';
  const artifactPath = resolve('out/MandateGraph.sol/MandateGraph.json');
  const sourcePath = resolve('contracts/MandateGraph.sol');
  const artifact = JSON.parse(await readFile(artifactPath, 'utf8'));
  const source = await readFile(sourcePath, 'utf8');

  const runCast = (args) => run(cast, args);
  const mainnetRpc = (method, params = []) => rpc(rpcUrl, method, params);
  const testnetRpc = (method, params = []) => rpc(arcTestnetCandidate.rpcUrl, method, params);

  const sourceHash = await runCast(['keccak', source.replaceAll('\r\n', '\n')]);
  const artifactSourceHash = artifact.metadata?.sources?.['contracts/MandateGraph.sol']?.keccak256;
  if (!artifactSourceHash || sourceHash.toLowerCase() !== artifactSourceHash.toLowerCase()) {
    throw new Error('Foundry artifact does not match contracts/MandateGraph.sol. Rebuild and rerun tests before Mainnet.');
  }
  if (artifact.metadata?.compiler?.version !== '0.8.28+commit.7893614a') {
    throw new Error(`Unexpected Solidity compiler in artifact: ${artifact.metadata?.compiler?.version ?? 'unknown'}.`);
  }
  if (artifact.metadata?.settings?.optimizer?.enabled !== true || artifact.metadata?.settings?.optimizer?.runs !== 200) {
    throw new Error('Artifact optimizer settings do not match the audited candidate.');
  }

  const [
    chainIdHex,
    blockHex,
    tokenCode,
    identityCode,
    reputationCode,
    validationCode,
    symbolData,
    decimalsData,
    nativeBalanceHex,
    tokenBalanceData,
    legacyAllowanceData,
    nonceHex,
    gasPriceHex,
    identityBalanceData,
    testnetChainIdHex,
    testnetCandidateCode,
    legacyCode,
  ] = await Promise.all([
    mainnetRpc('eth_chainId'),
    mainnetRpc('eth_blockNumber'),
    mainnetRpc('eth_getCode', [arcMainnet.usdcAddress, 'latest']),
    mainnetRpc('eth_getCode', [arcMainnet.identityRegistry, 'latest']),
    mainnetRpc('eth_getCode', [arcMainnet.reputationRegistry, 'latest']),
    mainnetRpc('eth_getCode', [arcMainnet.validationRegistry, 'latest']),
    mainnetRpc('eth_call', [{ to: arcMainnet.usdcAddress, data: '0x95d89b41' }, 'latest']),
    mainnetRpc('eth_call', [{ to: arcMainnet.usdcAddress, data: '0x313ce567' }, 'latest']),
    mainnetRpc('eth_getBalance', [sender, 'latest']),
    mainnetRpc('eth_call', [{ to: arcMainnet.usdcAddress, data: encodeAddressCall('0x70a08231', sender) }, 'latest']),
    mainnetRpc('eth_call', [{ to: arcMainnet.usdcAddress, data: encodeTwoAddressCall('0xdd62ed3e', sender, arcMainnet.legacyContract) }, 'latest']),
    mainnetRpc('eth_getTransactionCount', [sender, 'latest']),
    mainnetRpc('eth_gasPrice'),
    mainnetRpc('eth_call', [{ to: arcMainnet.identityRegistry, data: encodeAddressCall('0x70a08231', sender) }, 'latest']),
    testnetRpc('eth_chainId'),
    testnetRpc('eth_getCode', [arcTestnetCandidate.contractAddress, 'latest']),
    mainnetRpc('eth_getCode', [arcMainnet.legacyContract, 'latest']),
  ]);

  const chainId = BigInt(chainIdHex);
  const testnetChainId = BigInt(testnetChainIdHex);
  if (chainId !== arcMainnet.chainId) throw new Error(`Expected Arc Mainnet chain ID ${arcMainnet.chainId}; received ${chainId}.`);
  if (testnetChainId !== arcTestnetCandidate.chainId) throw new Error(`Expected Arc Testnet chain ID ${arcTestnetCandidate.chainId}; received ${testnetChainId}.`);
  for (const [name, code] of [
    ['USDC', tokenCode],
    ['IdentityRegistry', identityCode],
    ['ReputationRegistry', reputationCode],
    ['ValidationRegistry', validationCode],
    ['Testnet candidate', testnetCandidateCode],
    ['Legacy Mainnet contract', legacyCode],
  ]) {
    if (code === '0x' || byteLength(code) === 0) throw new Error(`${name} has no runtime bytecode.`);
  }

  const symbol = decodeString(symbolData);
  const decimals = Number(BigInt(decimalsData));
  if (symbol !== 'USDC' || decimals !== arcMainnet.erc20Decimals) {
    throw new Error(`Unexpected Arc USDC metadata: ${symbol}, ${decimals} decimals.`);
  }

  const getIdentityRegistryData = await runCast(['calldata', 'getIdentityRegistry()']);
  const [reputationIdentityData, validationIdentityData] = await Promise.all([
    mainnetRpc('eth_call', [{ to: arcMainnet.reputationRegistry, data: getIdentityRegistryData }, 'latest']),
    mainnetRpc('eth_call', [{ to: arcMainnet.validationRegistry, data: getIdentityRegistryData }, 'latest']),
  ]);
  const reputationIdentity = decodeAddress(reputationIdentityData);
  const validationIdentity = decodeAddress(validationIdentityData);
  if (reputationIdentity.toLowerCase() !== arcMainnet.identityRegistry.toLowerCase()) {
    throw new Error('Mainnet Reputation Registry is not linked to the official Identity Registry.');
  }
  if (validationIdentity.toLowerCase() !== arcMainnet.identityRegistry.toLowerCase()) {
    throw new Error('Mainnet Validation Registry is not linked to the official Identity Registry.');
  }

  const localRuntime = normalizeImmutableReferences(
    artifact.deployedBytecode.object,
    artifact.deployedBytecode.immutableReferences,
  );
  const candidateRuntime = normalizeImmutableReferences(
    testnetCandidateCode,
    artifact.deployedBytecode.immutableReferences,
  );
  const candidateMatchesArtifact = localRuntime === candidateRuntime;
  if (!candidateMatchesArtifact) {
    throw new Error('Local runtime bytecode does not match the audited Arc Testnet candidate after immutable normalization.');
  }
  const [localRuntimeHash, candidateRuntimeHash, legacyRuntimeHash] = await Promise.all([
    runCast(['keccak', localRuntime]),
    runCast(['keccak', candidateRuntime]),
    runCast(['keccak', legacyCode]),
  ]);

  const constructorArgs = `0x${encodeAddress(arcMainnet.usdcAddress)}${encodeAddress(arcMainnet.identityRegistry)}`;
  const initCode = buildDeploymentInitCode(artifact.bytecode.object, constructorArgs);
  const registrationData = await runCast(['calldata', 'register(string)', agentUri]);
  const legacyAllowanceCleanupData = await runCast(['calldata', 'approve(address,uint256)', arcMainnet.legacyContract, '0']);
  const [deploymentGasHex, registrationGasHex, legacyAllowanceCleanupGasHex] = await Promise.all([
    mainnetRpc('eth_estimateGas', [{ from: sender, data: initCode }]),
    mainnetRpc('eth_estimateGas', [{ from: sender, to: arcMainnet.identityRegistry, data: registrationData }]),
    mainnetRpc('eth_estimateGas', [{ from: sender, to: arcMainnet.usdcAddress, data: legacyAllowanceCleanupData }]),
  ]);
  const gasPrice = BigInt(gasPriceHex);
  const deploymentCost = estimateWriteCost(BigInt(deploymentGasHex), gasPrice);
  const registrationCost = estimateWriteCost(BigInt(registrationGasHex), gasPrice);
  const legacyAllowanceCleanupCost = estimateWriteCost(BigInt(legacyAllowanceCleanupGasHex), gasPrice);
  const funding = estimateFunding({
    deploymentGas: BigInt(deploymentGasHex) + BigInt(registrationGasHex) + BigInt(legacyAllowanceCleanupGasHex),
    gasPrice,
  });

  const nativeBalance = BigInt(nativeBalanceHex);
  const tokenBalance = BigInt(tokenBalanceData);
  const identityBalance = BigInt(identityBalanceData);
  const legacyAllowance = BigInt(legacyAllowanceData);
  const testnetAgentOwner = await optionalOwnerOf(mainnetRpc, arcMainnet.identityRegistry, arcTestnetCandidate.agentId);

  const output = {
    version: 1,
    mode: 'read-only-preflight',
    generatedAt: new Date().toISOString(),
    network: 'Arc Mainnet',
    chainId: Number(chainId),
    rpcUrl,
    latestBlock: BigInt(blockHex).toString(),
    officialContracts: {
      usdc: { address: arcMainnet.usdcAddress, symbol, erc20Decimals: decimals, codeBytes: byteLength(tokenCode) },
      identityRegistry: { address: arcMainnet.identityRegistry, codeBytes: byteLength(identityCode) },
      reputationRegistry: { address: arcMainnet.reputationRegistry, codeBytes: byteLength(reputationCode), identityRegistry: reputationIdentity },
      validationRegistry: { address: arcMainnet.validationRegistry, codeBytes: byteLength(validationCode), identityRegistry: validationIdentity },
    },
    sender: {
      address: sender,
      nonce: BigInt(nonceHex).toString(),
      nativeUsdc18: formatUsdc18(nativeBalance),
      erc20Usdc6: formatUsdc6(tokenBalance),
      erc8004IdentityBalance: identityBalance.toString(),
      testnetAgentIdOnMainnet: {
        agentId: arcTestnetCandidate.agentId.toString(),
        exists: testnetAgentOwner.exists,
        owner: testnetAgentOwner.owner,
      },
      legacyAllowanceBaseUnits: legacyAllowance.toString(),
    },
    recipient: { address: recipient, independentControlledDemoWallet: true },
    legacyAllowanceCleanup: {
      required: legacyAllowance !== 0n,
      destination: arcMainnet.usdcAddress,
      currentAllowanceBaseUnits: legacyAllowance.toString(),
      nextAllowanceBaseUnits: '0',
      valueUsdc: '0',
      expectedStateChange: 'Set the legacy Mainnet contract USDC allowance to zero before the new controlled PoC.',
      calldata: legacyAllowanceCleanupData,
      estimate: serializeCost(legacyAllowanceCleanupCost),
      exactLocalCommand: powershellCastCommand([
        'send', arcMainnet.usdcAddress, quote('approve(address,uint256)'), arcMainnet.legacyContract, '0',
        '--account', '$env:ARC_MAINNET_ACCOUNT', '--rpc-url', rpcUrl,
        '--gas-limit', legacyAllowanceCleanupCost.gasLimit, '--gas-price', legacyAllowanceCleanupCost.gasPrice, '--json',
      ]),
    },
    agentRegistration: {
      required: identityBalance === 0n,
      agentUri,
      destination: arcMainnet.identityRegistry,
      valueUsdc: '0',
      expectedStateChange: 'Mint one ERC-8004 Identity NFT to the sender and emit Registered(agentId, agentURI, owner).',
      calldata: registrationData,
      estimate: serializeCost(registrationCost),
      exactLocalCommand: powershellCastCommand([
        'send', arcMainnet.identityRegistry, quote('register(string)(uint256)'), quote(agentUri),
        '--account', '$env:ARC_MAINNET_ACCOUNT', '--rpc-url', rpcUrl,
        '--gas-limit', registrationCost.gasLimit, '--gas-price', registrationCost.gasPrice, '--json',
      ]),
    },
    candidateDeployment: {
      required: true,
      destination: null,
      valueUsdc: '0',
      constructor: { usdc: arcMainnet.usdcAddress, identityRegistry: arcMainnet.identityRegistry },
      expectedStateChange: 'Deploy a new MandateGraph candidate configured for Arc Mainnet USDC and the official Mainnet Identity Registry.',
      artifact: {
        path: 'out/MandateGraph.sol/MandateGraph.json',
        sourceHash,
        compiler: artifact.metadata.compiler.version,
        optimizer: artifact.metadata.settings.optimizer,
        initCodeBytes: byteLength(initCode),
        initCodeHash: await runCast(['keccak', initCode]),
        normalizedRuntimeHash: localRuntimeHash,
      },
      testnetCandidate: {
        address: arcTestnetCandidate.contractAddress,
        agentId: arcTestnetCandidate.agentId.toString(),
        codeBytes: byteLength(testnetCandidateCode),
        normalizedRuntimeHash: candidateRuntimeHash,
        normalizedBytecodeMatch: candidateMatchesArtifact,
      },
      legacyMainnet: {
        address: arcMainnet.legacyContract,
        codeBytes: byteLength(legacyCode),
        runtimeHash: legacyRuntimeHash,
        selectedForLifecycle: false,
      },
      estimate: serializeCost(deploymentCost),
      exactLocalCommands: [
        '$initCode = node scripts/print-mainnet-init-code.mjs',
        powershellCastCommand([
          'send', '--create', '$initCode', '--account', '$env:ARC_MAINNET_ACCOUNT', '--rpc-url', rpcUrl,
          '--gas-limit', deploymentCost.gasLimit, '--gas-price', deploymentCost.gasPrice, '--json',
        ]),
      ],
    },
    lifecyclePlan: {
      initialAuthorityCapBaseUnits: arcMainnet.initialAuthorityCapBaseUnits.toString(),
      smallPaymentBaseUnits: arcMainnet.smallPaymentBaseUnits.toString(),
      promotedAuthorityCapBaseUnits: arcMainnet.promotedAuthorityCapBaseUnits.toString(),
      largerPaymentBaseUnits: arcMainnet.largerPaymentBaseUnits.toString(),
      demotedAuthorityCapBaseUnits: arcMainnet.demotedAuthorityCapBaseUnits.toString(),
      rejectedPaymentBaseUnits: arcMainnet.rejectedPaymentBaseUnits.toString(),
      exactApprovalBaseUnits: arcMainnet.totalPaymentBaseUnits.toString(),
      totalExecutedPaymentBaseUnits: arcMainnet.totalPaymentBaseUnits.toString(),
      rejectedPaymentMode: 'eth_call only',
      reinstatementRequiredForCapSpecificReject: true,
    },
    funding: {
      feePriceWeiPerGas: funding.price.toString(),
      bufferedGasCostUsdc: formatUsdc18(funding.gasCostWei),
      paymentAmountUsdc: formatUsdc6(funding.paymentCostBaseUnits),
      minimumFundingUsdc: formatUsdc18(funding.totalFundingWei),
      adequateNativeGasAndPayments: nativeBalance >= funding.totalFundingWei,
      adequateErc20Payments: tokenBalance >= funding.paymentCostBaseUnits,
    },
    safety: {
      privateKeyRead: false,
      keystoreRead: false,
      passwordRequested: false,
      transactionsSent: false,
      productionApproved: false,
      status: 'STOP_BEFORE_SIGNATURE',
    },
    transactions: [],
  };

  if (!output.funding.adequateNativeGasAndPayments || !output.funding.adequateErc20Payments) {
    throw new Error('Sender balance is below the buffered deployment, registration, lifecycle, and payment estimate. No transaction sent.');
  }

  await writeFile(resolve('docs/MAINNET_AUTHORITY_EVIDENCE.json'), `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

async function optionalOwnerOf(mainnetRpc, registry, agentId) {
  const data = `0x6352211e${agentId.toString(16).padStart(64, '0')}`;
  try {
    const result = await mainnetRpc('eth_call', [{ to: registry, data }, 'latest']);
    return { exists: true, owner: decodeAddress(result) };
  } catch {
    return { exists: false, owner: null };
  }
}

function run(command, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args.map(String), { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => code === 0
      ? resolveResult(stdout.trim())
      : reject(new Error(`${command} failed with exit code ${code ?? 1}: ${stderr.trim()}`)));
  });
}

async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error || payload.result === undefined) {
    throw new Error(`${method} failed: ${payload.error?.message ?? 'missing result'}`);
  }
  return payload.result;
}

function encodeAddress(address) {
  return address.slice(2).toLowerCase().padStart(64, '0');
}

function encodeAddressCall(selector, address) {
  return `${selector}${encodeAddress(address)}`;
}

function encodeTwoAddressCall(selector, first, second) {
  return `${selector}${encodeAddress(first)}${encodeAddress(second)}`;
}

function decodeAddress(value) {
  if (!/^0x[\da-fA-F]{64}$/.test(value)) throw new Error(`Could not decode address from ${value}.`);
  return `0x${value.slice(-40)}`;
}

function decodeString(value) {
  const bytes = Buffer.from(value.slice(2), 'hex');
  if (bytes.length === 32) return bytes.toString('utf8').replace(/\0+$/, '');
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`));
  const length = Number(BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`));
  return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8');
}

function formatUsdc6(value) {
  return `${value / 1_000_000n}.${(value % 1_000_000n).toString().padStart(6, '0')}`;
}

function serializeCost(cost) {
  return {
    estimatedGas: cost.estimatedGas.toString(),
    gasLimit: cost.gasLimit.toString(),
    gasPriceWei: cost.gasPrice.toString(),
    worstCaseFeeUsdc: formatUsdc18(cost.worstCaseFeeWei),
  };
}

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function powershellCastCommand(args) {
  return `& \"$env:USERPROFILE\\.foundry\\bin\\cast.exe\" ${args.map(String).join(' ')}`;
}
