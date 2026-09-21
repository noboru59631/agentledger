param([Parameter(Mandatory=$true)][ValidateSet("testnet", "mainnet")][string]$Network)

$ErrorActionPreference = "Stop"
if (-not $env:ARC_RPC_URL) {
  if ($Network -eq "mainnet") { $env:ARC_RPC_URL = "https://rpc.mainnet.arc.io" }
  else { $env:ARC_RPC_URL = "https://rpc.testnet.arc.io" }
}
if (-not $env:USDC_ADDRESS) { $env:USDC_ADDRESS = "0x3600000000000000000000000000000000000000" }
if ($env:USDC_ADDRESS -notmatch '^0x[0-9a-fA-F]{40}$') { throw "USDC_ADDRESS must be a valid 20-byte USDC contract address." }
if ($env:USDC_ADDRESS -ine "0x3600000000000000000000000000000000000000") { throw "Arc $Network requires USDC at 0x3600000000000000000000000000000000000000." }
if (-not (Get-Command cast -ErrorAction SilentlyContinue)) { throw "Foundry cast is required for preflight." }

$expected = if ($Network -eq "mainnet") { "5042" } else { "5042002" }
$actualOutput = cast chain-id --rpc-url $env:ARC_RPC_URL
if ($LASTEXITCODE -ne 0) { throw "Could not query chain ID from RPC." }
$actual = ($actualOutput | Out-String).Trim()
if ($actual -ne $expected) { throw "RPC chain ID mismatch: expected $expected, received '$actual'." }
$blockOutput = cast block-number --rpc-url $env:ARC_RPC_URL
if ($LASTEXITCODE -ne 0) { throw "RPC block-number check failed." }
$block = ($blockOutput | Out-String).Trim()
if (-not $block) { throw "RPC returned an empty block number." }
$codeOutput = cast code $env:USDC_ADDRESS --rpc-url $env:ARC_RPC_URL
if ($LASTEXITCODE -ne 0) { throw "USDC contract code read failed." }
$code = ($codeOutput | Out-String).Trim()
if (-not $code -or $code -eq "0x") { throw "No contract bytecode found at configured USDC address." }
$decimalsOutput = cast call $env:USDC_ADDRESS "decimals()(uint8)" --rpc-url $env:ARC_RPC_URL
if ($LASTEXITCODE -ne 0) { throw "USDC decimals read failed." }
$decimals = ($decimalsOutput | Out-String).Trim()
if ($decimals -ne "6") { throw "Unexpected USDC decimals: expected 6, received '$decimals'." }
$symbolOutput = cast call $env:USDC_ADDRESS "symbol()(string)" --rpc-url $env:ARC_RPC_URL
if ($LASTEXITCODE -ne 0) { throw "USDC symbol read failed." }
$symbol = ($symbolOutput | Out-String).Trim()
if ($symbol -notmatch 'USDC') { throw "Unexpected token symbol: expected USDC, received '$symbol'." }
$threshold = [decimal]0
if ($env:MIN_USDC_BALANCE) {
  $parsed = [decimal]0
  if (-not [decimal]::TryParse($env:MIN_USDC_BALANCE, [ref]$parsed) -or $parsed -lt 0) { throw "MIN_USDC_BALANCE must be a non-negative USDC amount." }
  $threshold = $parsed
}
$deployer = $env:DEPLOYER_ADDRESS
if ($threshold -gt 0) {
  if (-not $deployer -or $deployer -notmatch '^0x[0-9a-fA-F]{40}$') { throw "Set DEPLOYER_ADDRESS when MIN_USDC_BALANCE is configured." }
  $balanceOutput = cast call $env:USDC_ADDRESS "balanceOf(address)(uint256)" $deployer --rpc-url $env:ARC_RPC_URL
  if ($LASTEXITCODE -ne 0) { throw "USDC balanceOf read failed." }
  $rawBalance = [decimal](($balanceOutput | Out-String).Trim())
  if ($rawBalance -lt ($threshold * 1000000)) { throw "USDC balance below configurable MIN_USDC_BALANCE=$threshold (balance=$([decimal]$rawBalance / 1000000)); deployment stopped." }
}
Write-Output "Read-only preflight passed: network=$Network chainId=$actual block=$block USDC=$env:USDC_ADDRESS symbol=$symbol decimals=$decimals minBalanceGate=$threshold USDC; no transaction sent."
