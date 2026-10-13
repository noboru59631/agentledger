import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./verify-v2-mainnet-deployment.mjs', import.meta.url), 'utf8');
const foundryConfig = await readFile(new URL('../foundry.toml', import.meta.url), 'utf8');

test('V2 Mainnet deployment verifier checks receipt, init code, runtime, and constructor configuration', () => {
  assert.match(source, /eth_getTransactionByHash/);
  assert.match(source, /eth_getTransactionReceipt/);
  assert.match(source, /transaction\.input\.toLowerCase\(\) !== initCode\.toLowerCase\(\)/);
  assert.match(source, /normalizeRuntimeBytecode/);
  assert.match(source, /matchesLocalArtifact: true/);
  assert.match(source, /0x3e413bee/);
  assert.match(source, /0x134e18f4/);
  assert.match(source, /nextMandateId/);
  assert.match(source, /Sourcify/);
  assert.match(source, /status === 404/);
  assert.match(source, /sourceVerification\.status === 'exact_match'/);
  assert.match(foundryConfig, /solc_version = "0\.8\.28"/);
  assert.match(foundryConfig, /optimizer = true/);
  assert.match(foundryConfig, /optimizer_runs = 200/);
  assert.match(foundryConfig, /evm_version = "prague"/);
  assert.match(foundryConfig, /via_ir = false/);
  assert.match(foundryConfig, /bytecode_hash = "ipfs"/);
  assert.match(foundryConfig, /cbor_metadata = true/);
  assert.match(foundryConfig, /use_literal_content = false/);
  assert.match(foundryConfig, /@nomicfoundation\/=node_modules\/@nomicfoundation\//);
  assert.match(foundryConfig, /hardhat\/=node_modules\/hardhat\//);
});

test('V2 Mainnet deployment evidence keeps smoke and UI writes disabled', () => {
  assert.match(source, /smokeLifecycleExecuted: false/);
  assert.match(source, /uiWritesEnabled: false/);
  assert.doesNotMatch(source, /eth_sendRawTransaction|eth_sendTransaction|writeContract|cast(?:\.exe)?['"\s,]+send/);
});
