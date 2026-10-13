param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('wallet-a', 'wallet-b', 'wallet-a-finalize')]
  [string]$Phase,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^0x[0-9a-fA-F]{40}$')]
  [string]$WalletBAddress,

  [string]$WalletAAccount = 'agentledger-testnet',
  [string]$WalletBAccount = 'agentledger-testnet-b',
  [string]$WalletAAddress = '0x03607de69C487BcC460eaD7C4Bdfd25805658b75',
  [string]$AgentAId = '897002'
)

try {
  $env:V2_TESTNET_PHASE = $Phase
  $env:V2_TESTNET_BROADCAST = 'ARC_TESTNET_V2_ONLY'
  $env:V2_WALLET_A_ACCOUNT = $WalletAAccount
  $env:V2_WALLET_A_ADDRESS = $WalletAAddress
  $env:V2_WALLET_B_ACCOUNT = $WalletBAccount
  $env:V2_WALLET_B_ADDRESS = $WalletBAddress
  $env:V2_AGENT_A_ID = $AgentAId

  node scripts/run-arc-testnet-v2-self-custody.mjs
  if ($LASTEXITCODE -ne 0) { throw "V2 Testnet phase failed with exit code $LASTEXITCODE." }
}
finally {
  Remove-Item Env:V2_TESTNET_PHASE -ErrorAction SilentlyContinue
  Remove-Item Env:V2_TESTNET_BROADCAST -ErrorAction SilentlyContinue
  Remove-Item Env:V2_WALLET_A_ACCOUNT -ErrorAction SilentlyContinue
  Remove-Item Env:V2_WALLET_A_ADDRESS -ErrorAction SilentlyContinue
  Remove-Item Env:V2_WALLET_B_ACCOUNT -ErrorAction SilentlyContinue
  Remove-Item Env:V2_WALLET_B_ADDRESS -ErrorAction SilentlyContinue
  Remove-Item Env:V2_AGENT_A_ID -ErrorAction SilentlyContinue
}
