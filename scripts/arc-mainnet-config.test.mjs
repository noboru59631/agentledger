import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { resolve } from 'node:path';
import { arcMainnet, estimateFunding, validateDistinctRecipient, validateMainnetRpc } from './arc-mainnet-config.mjs';

test('mainnet parameters are pinned to official Arc values', () => {
  assert.equal(arcMainnet.chainId, 5042n);
  assert.equal(arcMainnet.usdcAddress, '0x3600000000000000000000000000000000000000');
  assert.equal(validateMainnetRpc(arcMainnet.rpcUrl), arcMainnet.rpcUrl);
});

test('mainnet preflight rejects unapproved RPC endpoints', () => {
  assert.throws(() => validateMainnetRpc('https://rpc.testnet.arc.io'), /pinned/);
  assert.throws(() => validateMainnetRpc('https://attacker.example'), /pinned/);
});

test('mainnet recipient must be a distinct valid wallet address', () => {
  const sender = '0x1111111111111111111111111111111111111111';
  const recipient = '0x2222222222222222222222222222222222222222';
  assert.doesNotThrow(() => validateDistinctRecipient(sender, recipient));
  assert.throws(() => validateDistinctRecipient(sender, sender), /separate wallet/);
  assert.throws(() => validateDistinctRecipient(sender, 'bad'), /valid address/);
});

test('funding estimate applies fee floor, lifecycle reserve, and 50 percent margin', () => {
  const estimate = estimateFunding({ deploymentGas: 2_000_000n, gasPrice: 1n });
  assert.equal(estimate.price, 20_000_000_000n);
  assert.equal(estimate.rawGas, 3_000_000n);
  assert.equal(estimate.bufferedGas, 4_500_000n);
  assert.equal(estimate.gasCostWei, 90_000_000_000_000_000n);
  assert.equal(estimate.totalFundingWei, 100_000_000_000_000_000n);
});

test('broadcast requires the explicit confirmation and raw private key env is rejected', async () => {
  const runner = await (await import('node:fs/promises')).readFile(new URL('./run-arc-mainnet-lifecycle.mjs', import.meta.url), 'utf8');
  assert.match(runner, /confirmation !== 'YES'/);
  assert.match(runner, /\/PRIVATE_KEY\/i\.test\(name\)/);
  assert.match(runner, /if \(preflightOnly\) await preflight\(\)/);
  assert.match(runner, /--account', account, '--rpc-url', rpcUrl, '--json'/);
  const preflightBody = runner.slice(runner.indexOf('async function preflight()'), runner.indexOf('async function saveEvidence'));
  assert.doesNotMatch(preflightBody, /cast, \['send'|forge, \['create'/);
  assert.match(preflightBody, /eth_estimateGas/);
  assert.match(preflightBody, /eth_getCode/);
  assert.match(runner, /retryPaymentEncoding = await run\(cast, \['abi-encode'/);
  assert.match(runner, /eth_call', \[\{ from: sender, to: contract, data: retryData \}/);
  assert.match(runner, /!\/revert\/i\.test\(error\.message\)/);
});

test('execution without explicit mainnet confirmation stops before Foundry or RPC work', () => {
  const env = { ...process.env };
  delete env.CONFIRM_ARC_MAINNET;
  const result = spawnSync(process.execPath, [resolve('scripts/run-arc-mainnet-lifecycle.mjs')], { encoding: 'utf8', env });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Broadcast mode requires CONFIRM_ARC_MAINNET=YES/);
  assert.doesNotMatch(result.stderr, /(?:forge|cast|fetch) failed|HTTP \d/);
});
