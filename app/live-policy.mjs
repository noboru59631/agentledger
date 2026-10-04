export const ARC_CHAIN_ID = 5042n;
export const ARC_CHAIN_HEX = '0x13b2';
export const ARC_RPC_URL = 'https://rpc.mainnet.arc.io';
export const ARC_EXPLORER_URL = 'https://explorer.arc.io';
export const IDENTITY_REGISTRY_ADDRESS = '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432';
export const PUBLIC_CONTRACT_ADDRESS = null;
export const REFERENCE_CONTRACT_ADDRESS = '0xdc321eb50cff0239a2c43532ecc8b0c41d969a9e';
export const REFERENCE_AGENT_ID = 1395n;
export const REFERENCE_OPERATIONAL_AGENT = '0x03607de69C487BcC460eaD7C4Bdfd25805658b75';
export const CONTRACT_ADDRESS = REFERENCE_CONTRACT_ADDRESS;
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const USDC_DECIMALS = 6;

export function assertArcChain(chainId) {
  if (BigInt(chainId) !== ARC_CHAIN_ID) {
    throw new Error('Switch the connected wallet to Arc Mainnet (chain ID 5042).');
  }
  return true;
}

export function assertOwnedAgent(owner, account) {
  if (!owner || !account || owner.toLowerCase() !== account.toLowerCase()) {
    throw new Error('The connected wallet does not own this ERC-8004 Agent.');
  }
  return true;
}

export function assertWriteReady({ chainId, account, contractAddress = PUBLIC_CONTRACT_ADDRESS }) {
  assertArcChain(chainId);
  if (!account) throw new Error('Connect a wallet before submitting a transaction.');
  if (!/^0x[\da-fA-F]{40}$/.test(contractAddress ?? '')) {
    throw new Error('The security-upgraded Mainnet contract is not deployed. Writes remain disabled.');
  }
  return true;
}

export function exactApprovalAmount(value) {
  const amount = BigInt(value);
  if (amount <= 0n) throw new Error('Approval amount must be greater than zero.');
  return amount;
}
