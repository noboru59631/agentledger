import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runner = await readFile(new URL('./run-arc-testnet-lifecycle.mjs', import.meta.url), 'utf8');

test('Arc runner is pinned to testnet and validates chain, token code, and balance before deployment', () => {
  assert.match(runner, /https:\/\/rpc\.testnet\.arc\.io/);
  assert.match(runner, /expectedChainId = 5042002n/);
  assert.match(runner, /eth_getCode/);
  assert.match(runner, /balanceOf\(address\)\(uint256\)/);
  assert.match(runner, /new URL\(rpcUrl\)\.href !== 'https:\/\/rpc\.testnet\.arc\.io\/'/);
  assert.ok(runner.indexOf('const chainId =') < runner.indexOf("'create', 'contracts/MandateGraph.sol:MandateGraph'"));
  assert.ok(runner.indexOf('const balance =') < runner.indexOf("'create', 'contracts/MandateGraph.sol:MandateGraph'"));
});

test('Arc runner uses encrypted account signing and never broadcasts the revoked retry', () => {
  assert.match(runner, /'--account', account/);
  assert.doesNotMatch(runner, /--private-key|PRIVATE_KEY/);
  assert.match(runner, /rpc\('eth_call', \[\{ from: sender, to: contract, data: retryData \}/);
  assert.match(runner, /const signerOutput = await run\(cast, \['wallet', 'address', '--account', account\]\)/);
  assert.match(runner, /'revokeTask'/);
  assert.match(runner, /BigInt\(receipt\.status\) !== 1n/);
  assert.match(runner, /eth_getTransactionReceipt/);
  assert.match(runner, /waitForSuccessfulReceipt\(deploymentHash\)/);
});

test('Arc runner records the required lifecycle evidence and payment amount', () => {
  assert.match(runner, /const paymentAmount = 10_000n/);
  assert.match(runner, /paymentId/);
  assert.match(runner, /outcomeHash/);
  assert.match(runner, /explorerUrl/);
  assert.match(runner, /TESTNET_EVIDENCE\.json/);
});
