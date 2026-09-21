export const arcMainnet = Object.freeze({
  chainId: 5042n,
  rpcUrl: 'https://rpc.mainnet.arc.io',
  explorerUrl: 'https://explorer.arc.io',
  usdcAddress: '0x3600000000000000000000000000000000000000',
  erc20Decimals: 6,
  nativeDecimals: 18,
  paymentAmountBaseUnits: 10_000n,
  lifecycleGasReserve: 1_000_000n,
  gasSafetyNumerator: 3n,
  gasSafetyDenominator: 2n,
  fallbackGasPrice: 20_000_000_000n,
});

export function validateMainnetRpc(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('ARC_MAINNET_RPC_URL must be the official Arc Mainnet RPC URL.');
  }
  if (parsed.href !== `${arcMainnet.rpcUrl}/`) {
    throw new Error(`Arc Mainnet RPC is pinned to ${arcMainnet.rpcUrl}.`);
  }
  return parsed.href.slice(0, -1);
}

export function validateDistinctRecipient(sender, recipient) {
  if (!/^0x[\da-fA-F]{40}$/.test(sender ?? '')) throw new Error('ARC_MAINNET_SENDER must be a valid address.');
  if (!/^0x[\da-fA-F]{40}$/.test(recipient ?? '')) throw new Error('ARC_MAINNET_RECIPIENT must be a valid address.');
  if (sender.toLowerCase() === recipient.toLowerCase()) {
    throw new Error('Mainnet demo recipient must be a separate wallet address from the signer.');
  }
}

export function estimateFunding({ deploymentGas, gasPrice }) {
  const price = gasPrice > arcMainnet.fallbackGasPrice ? gasPrice : arcMainnet.fallbackGasPrice;
  const rawGas = deploymentGas + arcMainnet.lifecycleGasReserve;
  const bufferedGas = (rawGas * arcMainnet.gasSafetyNumerator + arcMainnet.gasSafetyDenominator - 1n)
    / arcMainnet.gasSafetyDenominator;
  const gasCostWei = bufferedGas * price;
  const paymentCostBaseUnits = arcMainnet.paymentAmountBaseUnits;
  const totalFundingWei = gasCostWei + paymentCostBaseUnits * 10n ** 12n;
  return { price, rawGas, bufferedGas, gasCostWei, paymentCostBaseUnits, totalFundingWei };
}

export function formatUsdc18(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
