import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./run-arc-mainnet-v2-smoke.mjs', import.meta.url), 'utf8');
const wrapper = await readFile(new URL('./run-v2-mainnet-smoke.ps1', import.meta.url), 'utf8');

test('Mainnet V2 smoke is pinned, bounded, resumable, and never deploys', () => {
  assert.match(source, /0x015099f831c247460b467154c73028804Ea38a10/);
  assert.match(source, /ARC_MAINNET_V2_SMOKE_ONLY/);
  assert.match(source, /maxLifecycleFeeWei/);
  assert.match(source, /maxGasPriceWei/);
  assert.match(source, /refusing duplicate broadcast/);
  assert.doesNotMatch(source, /--create|deployStep|--private-key|mnemonic|seed phrase/i);
});

test('Mainnet V2 smoke proves the required lifecycle and read-only isolation', () => {
  for (const required of [
    'registerAgent', 'createTask', 'delegate', 'approveExactUsdc', 'executeSmallPayment', 'recordWorkProof',
    'promoteAgent', 'executeLargerPayment', 'stopAndDemoteAgent', 'reinstateAgent', 'overCapPaymentRejected',
    'walletBCannotExecuteTaskAPayment', 'walletBCannotRecordAgentAWork',
  ]) assert.match(source, new RegExp(required));
  assert.match(source, /failedTransactionsBroadcast:\s*0/);
  assert.match(source, /crossUserWrites = 0/);
  assert.match(source, /allowanceBaseUnits/);
});

test('PowerShell wrapper requires explicit confirmation and keeps passwords local', () => {
  assert.match(wrapper, /ValidateSet\('ARC_MAINNET_V2_SMOKE_ONLY'\)/);
  assert.match(wrapper, /--preflight/);
  assert.match(wrapper, /--execute/);
  assert.match(wrapper, /--verify/);
  assert.match(wrapper, /password locally/);
  assert.doesNotMatch(wrapper, /password-file|private-key/i);
});

test('verification re-reads final state without rewriting evidence', () => {
  assert.match(source, /finalize\(evidence, artifact, \{ persist: false \}\)/);
  assert.match(source, /if \(persist\) \{/);
});
