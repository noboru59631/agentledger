import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_RPC_URL, CONTRACT_ADDRESS, USDC_ADDRESS, USDC_DECIMALS, assertArcChain,
} from './live-policy.mjs';

const liveDemoSource = readFileSync(new URL('./live-demo.mjs', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('chain guard accepts Arc Mainnet and rejects other chains', () => {
  assert.equal(assertArcChain(5042), true);
  assert.throws(() => assertArcChain(1), /Arc Mainnet/);
});

test('read-only Mainnet parameters are pinned', () => {
  assert.equal(ARC_CHAIN_ID, 5042n);
  assert.equal(ARC_RPC_URL, 'https://rpc.mainnet.arc.io');
  assert.equal(ARC_EXPLORER_URL, 'https://explorer.arc.io');
  assert.equal(CONTRACT_ADDRESS, '0xdC321eB50cFf0239a2c43532ecC8B0c41d969A9e');
  assert.equal(USDC_ADDRESS, '0x3600000000000000000000000000000000000000');
  assert.equal(USDC_DECIMALS, 6);
});

test('Mainnet browser surface is read-only with no contract write client', () => {
  assert.doesNotMatch(liveDemoSource, /writeContract|createWalletClient|eth_sendTransaction/);
  assert.match(liveDemoSource, /functionName: 'balanceOf'/);
  for (const id of ['liveCreate', 'liveDelegate', 'liveApprove', 'liveExecute', 'liveRevoke']) {
    assert.match(pageSource, new RegExp(`id="${id}" disabled`));
  }
  assert.match(pageSource, /READ ONLY · NO BROADCAST/);
});
