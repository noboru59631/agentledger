import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./prepare-v2-mainnet-deployment.mjs', import.meta.url), 'utf8');

test('V2 Mainnet deployment preparation is read-only and preserves the write lock', () => {
  assert.match(source, /eth_chainId/);
  assert.match(source, /eth_getCode/);
  assert.match(source, /eth_estimateGas/);
  assert.match(source, /transactionBroadcast:\s*false/);
  assert.match(source, /mainnetWriteLockChanged:\s*false/);
  assert.doesNotMatch(source, /eth_sendRawTransaction|eth_sendTransaction|cast(?:\.exe)?['"\s,]+send|writeContract/);
});

test('V2 Mainnet deployment plan uses the V2 artifact and official constructor configuration', () => {
  assert.match(source, /out\/MandateGraphV2\.sol\/MandateGraphV2\.json/);
  assert.match(source, /arcMainnet\.usdcAddress/);
  assert.match(source, /arcMainnet\.identityRegistry/);
  assert.match(source, /ready-for-explicit-approval/);
});
