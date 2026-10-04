import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ARC_CHAIN_ID, ARC_EXPLORER_URL, ARC_RPC_URL, IDENTITY_REGISTRY_ADDRESS,
  PUBLIC_CONTRACT_ADDRESS, PUBLIC_DEPLOYMENT_STATUS, REFERENCE_AGENT_ID, REFERENCE_CONTRACT_ADDRESS,
  USDC_ADDRESS, USDC_DECIMALS, assertArcChain, assertOwnedAgent,
  assertWriteReady, exactApprovalAmount,
} from './live-policy.mjs';

const liveDemoSource = readFileSync(new URL('./live-demo.mjs', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('chain guard accepts Arc Mainnet and rejects other chains', () => {
  assert.equal(assertArcChain(5042), true);
  assert.throws(() => assertArcChain(1), /Arc Mainnet/);
});

test('Mainnet parameters and reference demo are pinned separately', () => {
  assert.equal(ARC_CHAIN_ID, 5042n);
  assert.equal(ARC_RPC_URL, 'https://rpc.mainnet.arc.io');
  assert.equal(ARC_EXPLORER_URL, 'https://explorer.arc.io');
  assert.equal(IDENTITY_REGISTRY_ADDRESS, '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432');
  assert.equal(REFERENCE_CONTRACT_ADDRESS, '0xdc321eb50cff0239a2c43532ecc8b0c41d969a9e');
  assert.equal(REFERENCE_AGENT_ID, 1395n);
  assert.equal(PUBLIC_CONTRACT_ADDRESS, null);
  assert.equal(PUBLIC_DEPLOYMENT_STATUS.testnet.verification, 'pass');
  assert.equal(PUBLIC_DEPLOYMENT_STATUS.testnet.contractAddress, '0x3757ac538e8416388be609c0ca5543abe6072101');
  assert.equal(PUBLIC_DEPLOYMENT_STATUS.mainnet.writesEnabled, false);
  assert.equal(PUBLIC_DEPLOYMENT_STATUS.mainnet.contractAddress, '0x015099f831c247460b467154c73028804Ea38a10');
  assert.equal(PUBLIC_DEPLOYMENT_STATUS.mainnet.deployment, 'deployed-verification-pass-smoke-pending');
  assert.equal(USDC_ADDRESS, '0x3600000000000000000000000000000000000000');
  assert.equal(USDC_DECIMALS, 6);
});

test('write readiness requires chain, wallet, and upgraded deployment', () => {
  const wallet = '0x0000000000000000000000000000000000000001';
  assert.throws(() => assertWriteReady({ chainId: 1n, account: wallet, contractAddress: REFERENCE_CONTRACT_ADDRESS }), /Arc Mainnet/);
  assert.throws(() => assertWriteReady({ chainId: ARC_CHAIN_ID, account: null, contractAddress: REFERENCE_CONTRACT_ADDRESS }), /Connect a wallet/);
  assert.throws(() => assertWriteReady({ chainId: ARC_CHAIN_ID, account: wallet }), /not deployed/);
  assert.equal(assertWriteReady({ chainId: ARC_CHAIN_ID, account: wallet, contractAddress: '0x0000000000000000000000000000000000000002' }), true);
});

test('only connected owner can add an Agent and approvals are positive exact values', () => {
  const wallet = '0x0000000000000000000000000000000000000001';
  assert.equal(assertOwnedAgent(wallet, wallet.toUpperCase()), true);
  assert.throws(() => assertOwnedAgent(wallet, '0x0000000000000000000000000000000000000002'), /does not own/);
  assert.equal(exactApprovalAmount(25_000n), 25_000n);
  assert.throws(() => exactApprovalAmount(0n), /greater than zero/);
});

test('browser surface simulates every contract write and never embeds a signer', () => {
  assert.match(liveDemoSource, /simulateContract/);
  assert.match(liveDemoSource, /writeContract/);
  assert.match(liveDemoSource, /eth_requestAccounts/);
  assert.match(liveDemoSource, /ownerOf/);
  assert.match(liveDemoSource, /Approve exact amount/);
  assert.match(liveDemoSource, /0n/);
  assert.match(liveDemoSource, /AuthorityCapExceeded/);
  assert.doesNotMatch(liveDemoSource, /privateKey|mnemonic|seed phrase|backend signer/i);
  assert.match(pageSource, /Don’t give a new AI agent the keys to your wallet/);
  assert.match(pageSource, /AgentLedger is the authority layer for autonomous AI workers/);
});
