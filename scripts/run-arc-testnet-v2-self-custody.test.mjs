import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./run-arc-testnet-v2-self-custody.mjs', import.meta.url), 'utf8');
const phaseWrapper = readFileSync(new URL('./run-arc-testnet-v2-phase.ps1', import.meta.url), 'utf8');

test('V2 runner is hard-pinned to testnet and requires an explicit broadcast phrase', () => {
  assert.match(source, /ARC_TESTNET\.rpcUrl/);
  assert.match(source, /assertConfiguration\(config, \{ broadcast:/);
  assert.match(source, /V2_TESTNET_BROADCAST/);
  assert.doesNotMatch(source, /rpc\.mainnet\.arc\.io|chainId:\s*5042n/);
});

test('V2 runner uses encrypted accounts without private-key or mnemonic inputs', () => {
  assert.match(source, /'--account', account/);
  assert.match(source, /wallet', 'address', '--account'/);
  assert.doesNotMatch(source, /--private-key|PRIVATE_KEY|mnemonic|seed phrase/i);
});

test('V2 runner records two-wallet isolation, transfer tracking, exact allowance, and no failed broadcasts', () => {
  assert.match(source, /walletBCannotDemoteAgentA/);
  assert.match(source, /walletBCannotExecuteTaskAPayment/);
  assert.match(source, /oldTaskFrozenAfterAgentOwnershipTransfer/);
  assert.match(source, /newOwnerAdministrationFollowsOwnerOf/);
  assert.match(source, /exactAllowance/);
  assert.match(source, /failedTransactionsBroadcast:\s*0/);
  assert.match(source, /TESTNET_V2_SELF_CUSTODY_EVIDENCE\.json/);
});

test('V2 runner reads git head with a process-scoped safe-directory override', () => {
  assert.match(source, /safe\.directory=\$\{process\.cwd\(\)/);
  assert.doesNotMatch(source, /git', \['config', '--global'/);
});

test('phase wrapper leaves password handling to Foundry hidden prompts', () => {
  assert.doesNotMatch(phaseWrapper, /ETH_PASSWORD|CAST_PASSWORD|SecureStringToBSTR|PtrToStringBSTR|unsafe-password/i);
  assert.match(phaseWrapper, /node scripts\/run-arc-testnet-v2-self-custody\.mjs/);
});

test('contract creation lets the selected keystore derive the deployment sender', () => {
  assert.match(source, /'send', '--account', config\.walletA\.account, '--rpc-url', config\.rpcUrl, '--async', '--json',[\s\S]*'--create', artifact\.initCode/);
  assert.doesNotMatch(source, /'send', '--create', artifact\.initCode, '--account'/);
});
