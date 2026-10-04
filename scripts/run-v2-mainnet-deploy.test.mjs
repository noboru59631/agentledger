import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const wrapper = await readFile(new URL('./run-v2-mainnet-deploy.ps1', import.meta.url), 'utf8');
const printer = await readFile(new URL('./print-v2-mainnet-init-code.mjs', import.meta.url), 'utf8');

test('V2 Mainnet deploy wrapper pins the approved deploy-only transaction', () => {
  assert.match(wrapper, /ARC_MAINNET_V2_DEPLOY_ONLY/);
  assert.match(wrapper, /rpc\.mainnet\.arc\.io/);
  assert.match(wrapper, /5042/);
  assert.match(wrapper, /0x5dec88089cacd7ab0e0f03eceb35c28e11c4895efc9ae12125fadb9c468df75f/);
  assert.match(wrapper, /0x0cf680f4263bfd448532e0485a6579ca156bec0eb7e6ba19075912ef4e2cf55d/);
  assert.match(wrapper, /wallet address --account/);
  assert.match(wrapper, /compute-address --nonce/);
  assert.match(wrapper, /code \$expectedAddress/);
  assert.match(wrapper, /--from \$deployer --account \$account --rpc-url \$rpcUrl/);
  assert.match(wrapper, /--gas-limit .*--gas-price/);
  assert.match(wrapper, /--async --json --create \$initCode/);
});

test('V2 Mainnet deploy wrapper never accepts raw signer secrets or unlocks the UI', () => {
  assert.doesNotMatch(wrapper, /private-key|mnemonic|seed phrase|ETH_PASSWORD|CAST_PASSWORD|SecureStringToBSTR/i);
  assert.doesNotMatch(wrapper, /PUBLIC_CONTRACT_ADDRESS|writesEnabled/);
  assert.match(printer, /MandateGraphV2\.sol\/MandateGraphV2\.json/);
  assert.doesNotMatch(printer, /MandateGraph\.sol\/MandateGraph\.json/);
});
