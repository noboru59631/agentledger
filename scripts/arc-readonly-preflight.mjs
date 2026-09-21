const rpcUrl = process.env.ARC_RPC_URL ?? 'https://rpc.mainnet.arc.io';
const token = '0x3600000000000000000000000000000000000000';

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error || payload.result === undefined) {
    throw new Error(`${method}: ${payload.error?.message ?? 'missing result'}`);
  }
  return payload.result;
}

function decodeString(value) {
  const bytes = Buffer.from(value.slice(2), 'hex');
  if (bytes.length === 32) return bytes.toString('utf8').replace(/\0+$/, '');
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`));
  const length = Number(BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`));
  return bytes.subarray(offset + 32, offset + 32 + length).toString('utf8');
}

const chainId = BigInt(await rpc('eth_chainId'));
if (chainId !== 5042n) throw new Error(`Expected Arc mainnet chain ID 5042; received ${chainId}.`);
const block = await rpc('eth_blockNumber');
if (BigInt(block) <= 0n) throw new Error(`Invalid latest block number: ${block}.`);
const code = await rpc('eth_getCode', [token, 'latest']);
if (typeof code !== 'string' || code === '0x' || code.length <= 2) throw new Error(`No contract bytecode at official USDC address ${token}.`);
const [symbolData, decimalsData] = await Promise.all([
  rpc('eth_call', [{ to: token, data: '0x95d89b41' }, 'latest']),
  rpc('eth_call', [{ to: token, data: '0x313ce567' }, 'latest']),
]);
const symbol = decodeString(symbolData);
const decimals = Number(BigInt(decimalsData));
if (symbol !== 'USDC' || decimals !== 6) throw new Error(`Unexpected token metadata: symbol=${symbol}, decimals=${decimals}.`);
console.log(`Read-only Arc preflight passed: chainId=${chainId} block=${BigInt(block)} USDC=${token} symbol=${symbol} decimals=${decimals}. No transaction sent.`);
