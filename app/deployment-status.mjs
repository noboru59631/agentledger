export const V2_DEPLOYMENT_STATUS = Object.freeze({
  testnet: Object.freeze({
    network: 'Arc Testnet',
    chainId: 5_042_002,
    verification: 'pass',
    contractAddress: '0x3757ac538e8416388be609c0ca5543abe6072101',
    evidencePath: 'docs/TESTNET_V2_SELF_CUSTODY_EVIDENCE.json',
    requiredChecks: Object.freeze([
      'two-wallet isolation',
      'ERC-8004 ownership transfer tracking',
      'exact allowance and task-owner payment',
      'owner-signed promotion',
      'STOP, demotion, reinstatement, and over-cap rejection',
    ]),
  }),
  mainnet: Object.freeze({
    network: 'Arc Mainnet',
    chainId: 5_042,
    deployment: 'deployed-verification-pass-smoke-pending',
    contractAddress: '0x015099f831c247460b467154c73028804Ea38a10',
    evidencePath: 'docs/MAINNET_V2_DEPLOYMENT_EVIDENCE.json',
    writesEnabled: false,
  }),
});
