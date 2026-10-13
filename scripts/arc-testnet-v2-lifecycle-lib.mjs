import { randomBytes } from 'node:crypto';

export const ARC_TESTNET = Object.freeze({
  name: 'Arc Testnet',
  chainId: 5_042_002n,
  rpcUrl: 'https://rpc.testnet.arc.io',
  explorerUrl: 'https://testnet.arcscan.app',
  usdc: '0x3600000000000000000000000000000000000000',
  identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
});

export const BROADCAST_CONFIRMATION = 'ARC_TESTNET_V2_ONLY';
export const EVIDENCE_VERSION = 1;
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export const ERROR_SELECTORS = Object.freeze({
  '0x23d966b2': 'NotTaskOwner()',
  '0x53b37e7f': 'NotMandateOperator()',
  '0x390772fc': 'NotAgentOwner()',
  '0x3961b4d3': 'AgentOwnershipChanged(uint256,address,address)',
  '0xe5bbd38c': 'AuthorityCapExceeded()',
});

export function assertAddress(value, label) {
  if (!/^0x[\da-fA-F]{40}$/.test(value ?? '')) throw new Error(`${label} must be a valid address.`);
  return value;
}

export function assertConfiguration(config, { broadcast = false } = {}) {
  if (config.rpcUrl !== ARC_TESTNET.rpcUrl) throw new Error(`RPC must be pinned to ${ARC_TESTNET.rpcUrl}.`);
  assertAddress(config.walletA.address, 'V2_WALLET_A_ADDRESS');
  assertAddress(config.walletB.address, 'V2_WALLET_B_ADDRESS');
  if (config.walletA.address.toLowerCase() === config.walletB.address.toLowerCase()) throw new Error('Wallet A and Wallet B must be distinct.');
  if (!/^\d+$/.test(config.agentAId ?? '') || BigInt(config.agentAId) === 0n) throw new Error('V2_AGENT_A_ID must be a positive integer.');
  if (!config.walletA.account || !config.walletB.account) throw new Error('Both Foundry keystore account names are required.');
  if (broadcast && config.broadcastConfirmation !== BROADCAST_CONFIRMATION) {
    throw new Error(`Set V2_TESTNET_BROADCAST=${BROADCAST_CONFIRMATION} to authorize Arc Testnet-only broadcast.`);
  }
  return true;
}

export function randomHex(bytes = 32) {
  return `0x${randomBytes(bytes).toString('hex')}`;
}

export function normalizeRuntimeBytecode(bytecode, immutableReferences = {}) {
  const normalized = normalizeHex(bytecode).split('');
  for (const reference of Object.values(immutableReferences).flat()) {
    const start = Number(reference.start) * 2;
    const length = Number(reference.length) * 2;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 0 || start + length > normalized.length) {
      throw new Error('Immutable reference lies outside runtime bytecode.');
    }
    normalized.fill('0', start, start + length);
  }
  return `0x${normalized.join('')}`;
}

export function byteLength(value) {
  return normalizeHex(value).length / 2;
}

export function decodeTransferAgentId(receipt, registry, recipient) {
  const registryLower = registry.toLowerCase();
  const recipientTopic = `0x${recipient.slice(2).toLowerCase().padStart(64, '0')}`;
  for (const log of receipt?.logs ?? []) {
    if (String(log.address).toLowerCase() !== registryLower) continue;
    const topics = log.topics ?? [];
    if (String(topics[0]).toLowerCase() !== TRANSFER_TOPIC || String(topics[1]).toLowerCase() !== `0x${'0'.repeat(64)}`) continue;
    if (String(topics[2]).toLowerCase() !== recipientTopic) continue;
    return BigInt(topics[3]).toString();
  }
  throw new Error('ERC-8004 mint Transfer event was not found in the receipt.');
}

export function selectorOf(value) {
  const match = String(value ?? '').match(/0x[\da-fA-F]{8}/);
  return match?.[0].toLowerCase() ?? null;
}

export function decodeKnownError(value) {
  const selector = selectorOf(value);
  return { selector, error: selector ? ERROR_SELECTORS[selector] ?? 'Unknown custom error' : 'No revert selector' };
}

export function hexQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

export function sumReceiptFees(steps) {
  return Object.values(steps).reduce((total, step) => total + BigInt(step?.feeWei ?? 0), 0n);
}

function normalizeHex(value) {
  if (typeof value !== 'string') throw new TypeError('Bytecode must be a hex string.');
  const normalized = value.startsWith('0x') ? value.slice(2) : value;
  if (!/^(?:[\da-fA-F]{2})*$/.test(normalized)) throw new Error('Bytecode must contain complete hex bytes.');
  return normalized.toLowerCase();
}
