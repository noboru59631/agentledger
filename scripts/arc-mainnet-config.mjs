export const arcMainnet = Object.freeze({
  chainId: 5042n,
  rpcUrl: 'https://rpc.mainnet.arc.io',
  explorerUrl: 'https://explorer.arc.io',
  usdcAddress: '0x3600000000000000000000000000000000000000',
  identityRegistry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
  reputationRegistry: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63',
  validationRegistry: '0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58',
  legacyContract: '0x235dC11cD709542C42eb81c8F341C8F1A2bCE0Da',
  erc20Decimals: 6,
  nativeDecimals: 18,
  initialAuthorityCapBaseUnits: 10_000n,
  smallPaymentBaseUnits: 5_000n,
  promotedAuthorityCapBaseUnits: 50_000n,
  largerPaymentBaseUnits: 20_000n,
  demotedAuthorityCapBaseUnits: 25_000n,
  rejectedPaymentBaseUnits: 26_000n,
  totalPaymentBaseUnits: 25_000n,
  lifecycleGasReserve: 2_000_000n,
  gasSafetyNumerator: 3n,
  gasSafetyDenominator: 2n,
  fallbackGasPrice: 20_000_000_000n,
});

export const arcTestnetCandidate = Object.freeze({
  rpcUrl: 'https://rpc.testnet.arc.io',
  chainId: 5042002n,
  contractAddress: '0x8135c6E750E240FB352ee6701F2976fF8BA63ea3',
  identityRegistry: '0x8004A818BFB912233c491871b3d84c89A494BD9e',
  agentId: 897002n,
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
  const paymentCostBaseUnits = arcMainnet.totalPaymentBaseUnits;
  const totalFundingWei = gasCostWei + paymentCostBaseUnits * 10n ** 12n;
  return { price, rawGas, bufferedGas, gasCostWei, paymentCostBaseUnits, totalFundingWei };
}

export function estimateWriteCost(gas, gasPrice) {
  const price = gasPrice > arcMainnet.fallbackGasPrice ? gasPrice : arcMainnet.fallbackGasPrice;
  const gasLimit = (gas * arcMainnet.gasSafetyNumerator + arcMainnet.gasSafetyDenominator - 1n)
    / arcMainnet.gasSafetyDenominator;
  return { estimatedGas: gas, gasLimit, gasPrice: price, worstCaseFeeWei: gasLimit * price };
}

export function formatUsdc18(value) {
  const whole = value / 10n ** 18n;
  const fraction = (value % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
