import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const rpcUrl = process.env.LIFECYCLE_RPC_URL ?? 'http://127.0.0.1:8545';
const mode = process.env.LIFECYCLE_MODE ?? 'local';
const localMode = mode === 'local';
const arcTestnetMode = mode === 'arc-testnet';
if (!localMode && !arcTestnetMode) throw new Error('Set LIFECYCLE_MODE to local or arc-testnet');
if (localMode && rpcUrl !== 'http://127.0.0.1:8545') {
  throw new Error('Local mode is restricted to Anvil at http://127.0.0.1:8545');
}
if (arcTestnetMode && (!process.env.LIFECYCLE_RPC_URL || !process.env.LIFECYCLE_ACCOUNT || !process.env.LIFECYCLE_SENDER)) {
  throw new Error('Arc testnet mode requires LIFECYCLE_RPC_URL, LIFECYCLE_ACCOUNT, and LIFECYCLE_SENDER');
}

const forgeArgs = ['script', 'script/Lifecycle.s.sol:LifecycleScript', '--rpc-url', rpcUrl, '--broadcast'];
if (process.env.LIFECYCLE_ACCOUNT) forgeArgs.push('--account', process.env.LIFECYCLE_ACCOUNT);
else forgeArgs.push('--sender', process.env.LIFECYCLE_SENDER ?? '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
process.env.LIFECYCLE_SENDER ??= '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

const result = await new Promise((resolveResult, reject) => {
  const command = process.platform === 'win32' ? 'forge.exe' : 'forge';
  const child = spawn(command, forgeArgs, { stdio: 'inherit' });
  child.once('error', reject);
  child.once('exit', (code) => resolveResult(code ?? 1));
});
if (result !== 0) process.exit(result);

const chainId = (process.env.LIFECYCLE_CHAIN_ID ?? (localMode ? '31337' : '5042002')).replace(/^0x/, '');
const runFile = resolve('broadcast', 'Lifecycle.s.sol', chainId, 'run-latest.json');
const run = JSON.parse(await readFile(runFile, 'utf8'));
const transactions = run.transactions.filter(({ transactionType }) => transactionType !== 'CALL').map(({ hash, transactionType, contractAddress }) => ({ hash, transactionType, contractAddress }));
if (transactions.length === 0 || transactions.some(({ hash }) => !hash)) throw new Error(`No broadcast transaction hashes were recorded in ${runFile}`);

const evidence = JSON.parse(await readFile('lifecycle-evidence.json', 'utf8'));
evidence.transactions = transactions;
evidence.transactionHashes = transactions.map(({ hash }) => hash);
if (localMode) {
  const { stdout, exitCode } = await new Promise((resolveResult, reject) => {
    const child = spawn(process.platform === 'win32' ? 'cast.exe' : 'cast', ['receipt', '--json', transactions.at(-1).hash, '--rpc-url', rpcUrl], { stdio: ['ignore', 'pipe', 'inherit'] });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => resolveResult({ stdout: output, exitCode: code ?? 1 }));
  });
  if (exitCode !== 0 || !JSON.parse(stdout).status || JSON.parse(stdout).status === '0x0') throw new Error('Final local lifecycle transaction has no successful receipt');
}
await writeFile('lifecycle-evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
