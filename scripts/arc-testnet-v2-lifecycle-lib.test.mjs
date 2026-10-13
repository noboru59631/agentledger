import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ARC_TESTNET, BROADCAST_CONFIRMATION, byteLength, decodeKnownError, decodeTransferAgentId,
  normalizeRuntimeBytecode, assertConfiguration, sumReceiptFees,
} from './arc-testnet-v2-lifecycle-lib.mjs';

const config = {
  rpcUrl: ARC_TESTNET.rpcUrl,
  broadcastConfirmation: BROADCAST_CONFIRMATION,
  agentAId: '1',
  walletA: { account: 'a', address: '0x0000000000000000000000000000000000000001' },
  walletB: { account: 'b', address: '0x0000000000000000000000000000000000000002' },
};

test('configuration pins Arc Testnet and requires two distinct public wallets', () => {
  assert.equal(assertConfiguration(config, { broadcast: true }), true);
  assert.throws(() => assertConfiguration({ ...config, rpcUrl: 'https://rpc.mainnet.arc.io' }), /pinned/);
  assert.throws(() => assertConfiguration({ ...config, walletB: { ...config.walletB, address: config.walletA.address } }), /distinct/);
  assert.throws(() => assertConfiguration({ ...config, broadcastConfirmation: '' }, { broadcast: true }), /V2_TESTNET_BROADCAST/);
});

test('runtime normalization blanks only compiler-reported immutable slots', () => {
  const bytecode = '0x600102030405';
  assert.equal(normalizeRuntimeBytecode(bytecode, { a: [{ start: 2, length: 2 }] }), '0x600100000405');
  assert.equal(byteLength(bytecode), 6);
  assert.throws(() => normalizeRuntimeBytecode(bytecode, { a: [{ start: 9, length: 1 }] }), /outside/);
});

test('minted ERC-8004 agent id is decoded from the standard Transfer event', () => {
  const registry = ARC_TESTNET.identityRegistry;
  const recipient = config.walletB.address;
  const receipt = { logs: [{
    address: registry,
    topics: [
      '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      `0x${'0'.repeat(64)}`,
      `0x${recipient.slice(2).padStart(64, '0')}`,
      `0x${123n.toString(16).padStart(64, '0')}`,
    ],
  }] };
  assert.equal(decodeTransferAgentId(receipt, registry, recipient), '123');
});

test('known reverts and receipt fees are summarized without secrets', () => {
  assert.deepEqual(decodeKnownError('execution reverted: 0xe5bbd38c'), { selector: '0xe5bbd38c', error: 'AuthorityCapExceeded()' });
  assert.equal(sumReceiptFees({ a: { feeWei: '10' }, b: { feeWei: '25' }, pending: {} }), 35n);
});
