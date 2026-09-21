import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runner = await readFile(new URL('./run-arc-testnet-lifecycle.mjs', import.meta.url), 'utf8');

test('Arc runner is pinned to testnet and validates chain, token code, and balance', () => {
  assert.match(runner, /https:\/\/rpc\.testnet\.arc\.io/);
  assert.match(runner, /expectedChainId = 5042002n/);
  assert.match(runner, /eth_getCode/);
  assert.match(runner, /balanceOf\(address\)\(uint256\)/);
  assert.match(runner, /new URL\(rpcUrl\)\.href !== 'https:\/\/rpc\.testnet\.arc\.io\/'/);
});

test('Arc runner uses encrypted account signing and never broadcasts the revoked retry', () => {
  assert.match(runner, /'--account', account/);
  assert.doesNotMatch(runner, /--private-key|PRIVATE_KEY/);
  assert.match(runner, /rpc\('eth_call', \[\{ from: sender, to: contract, data: retryData \}/);
  assert.match(runner, /const signerOutput = await run\(cast, \['wallet', 'address', '--account', account\]\)/);
  assert.match(runner, /'revokeTask'/);
});

test('Arc deployment places variadic constructor arguments after Forge options', () => {
  assert.match(runner, /'--broadcast', '--json', '--constructor-args', token/);
});

test('Arc resume mode reads evidence, validates the existing contract, and never deploys', () => {
  assert.match(runner, /const resumeMode = process\.argv\.includes\('--resume'\)/);
  assert.match(runner, /Resume mode requires/);
  assert.match(runner, /validateExistingContract/);
  assert.match(runner, /evidence\.contractAddress/);
  const resumeBranch = runner.slice(runner.indexOf('if (resumeMode)'));
  assert.doesNotMatch(resumeBranch.split('const { chainId }')[0], /deployFresh\(/);
});

test('Arc runner polls receipt and transaction presence and records dropped transactions', () => {
  assert.match(runner, /receiptPollAttempts = 180/);
  assert.match(runner, /eth_getTransactionReceipt/);
  assert.match(runner, /eth_getTransactionByHash/);
  assert.match(runner, /droppedAfterConsecutiveMisses = 45/);
  assert.match(runner, /state: 'dropped'/);
});

test('Arc runner reconciles on-chain state before sending lifecycle steps', () => {
  assert.match(runner, /readTask\(contract, evidence\.taskId\)/);
  assert.match(runner, /nextMandateId\(\)\(uint256\)/);
  assert.match(runner, /allowance\(address,address\)\(uint256\)/);
  assert.match(runner, /usedPaymentIds\(bytes32\)\(bool\)/);
  assert.match(runner, /if \(task\.revoked\)/);
});

test('Arc evidence is persisted before and after transaction confirmation', () => {
  assert.match(runner, /status: 'pending'/);
  assert.match(runner, /await saveEvidence\(evidence\);/);
  assert.match(runner, /upsertSuccessfulTransaction/);
  assert.match(runner, /TESTNET_EVIDENCE\.json/);
  assert.match(runner, /const paymentAmount = 10_000n/);
});
