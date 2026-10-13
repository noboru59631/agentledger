import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { resolve } from 'node:path';
import {
  arcMainnet, arcTestnetCandidate, estimateFunding, estimateWriteCost, validateDistinctRecipient, validateMainnetRpc,
} from './arc-mainnet-config.mjs';

test('mainnet parameters are pinned to official Arc values', () => {
  assert.equal(arcMainnet.chainId, 5042n);
  assert.equal(arcMainnet.usdcAddress, '0x3600000000000000000000000000000000000000');
  assert.equal(arcMainnet.identityRegistry, '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
  assert.equal(arcTestnetCandidate.contractAddress, '0x8135c6E750E240FB352ee6701F2976fF8BA63ea3');
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
  assert.equal(estimate.rawGas, 4_000_000n);
  assert.equal(estimate.bufferedGas, 6_000_000n);
  assert.equal(estimate.gasCostWei, 120_000_000_000_000_000n);
  assert.equal(estimate.totalFundingWei, 145_000_000_000_000_000n);
});

test('per-write estimates use the Arc fee floor and a 50 percent gas buffer', () => {
  const estimate = estimateWriteCost(200_000n, 1n);
  assert.equal(estimate.gasLimit, 300_000n);
  assert.equal(estimate.gasPrice, 20_000_000_000n);
  assert.equal(estimate.worstCaseFeeWei, 6_000_000_000_000_000n);
});

test('mainnet runner exposes read-only preflight only', async () => {
  const runner = await (await import('node:fs/promises')).readFile(new URL('./run-arc-mainnet-lifecycle.mjs', import.meta.url), 'utf8');
  assert.match(runner, /Mainnet broadcast is disabled/);
  assert.doesNotMatch(runner, /runCast\(\['send'|spawn\([^\n]+\['send'|--private-key|PRIVATE_KEY/);
  const preflightBody = runner.slice(runner.indexOf('async function preflight()'));
  assert.doesNotMatch(preflightBody, /runCast\(\['send'|spawn\([^\n]+\['send'/);
  assert.match(preflightBody, /eth_estimateGas/);
  assert.match(preflightBody, /eth_getCode/);
  assert.match(runner, /identityRegistry/);
  assert.match(runner, /STOP_BEFORE_SIGNATURE/);
  assert.match(runner, /normalizedBytecodeMatch/);
  assert.match(runner, /'send', '--from',[\s\S]*'--json', '--create', '\$initCode'/);
  assert.match(runner, /MAINNET_AUTHORITY_PREFLIGHT\.json/);
  assert.doesNotMatch(runner, /writeFile\(resolve\('docs\/MAINNET_AUTHORITY_EVIDENCE\.json'/);
});

test('mainnet execution mode stops before Foundry or RPC work', () => {
  const result = spawnSync(process.execPath, [resolve('scripts/run-arc-mainnet-lifecycle.mjs')], { encoding: 'utf8', env: { ...process.env } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Mainnet broadcast is disabled/);
  assert.doesNotMatch(result.stderr, /(?:forge|cast|fetch) failed|HTTP \d/);
});
