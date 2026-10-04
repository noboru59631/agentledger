export const ARC_CHAIN_ID = 5042n;
export const ARC_CHAIN_HEX = '0x13b2';
export const ARC_RPC_URL = 'https://rpc.mainnet.arc.io';
export const ARC_EXPLORER_URL = 'https://explorer.arc.io';
export const CONTRACT_ADDRESS = '0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da';
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const USDC_DECIMALS = 6;

export function assertArcChain(chainId) {
  if (BigInt(chainId) !== ARC_CHAIN_ID) {
    throw new Error('Switch the connected wallet to Arc Mainnet (chain ID 5042).');
  }
  return true;
}
