param(
  [ValidateSet("testnet", "mainnet")][string]$Network = "testnet"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command forge -ErrorAction SilentlyContinue) -or -not (Get-Command cast -ErrorAction SilentlyContinue)) { throw "Foundry forge and cast are required. Install them from https://getfoundry.sh/" }
if (-not $env:USDC_ADDRESS) { throw "Set USDC_ADDRESS to the verified token contract for the selected network." }
if ($env:USDC_ADDRESS -notmatch '^0x[0-9a-fA-F]{40}$') { throw "USDC_ADDRESS must be a 20-byte hexadecimal address." }

if ($Network -eq "testnet") {
  $expectedChainId = "5042002"
  if (-not $env:ARC_RPC_URL) { $env:ARC_RPC_URL = "https://rpc.testnet.arc.network" }
} else {
  $expectedChainId = "5042"
  if (-not $env:ARC_RPC_URL) { $env:ARC_RPC_URL = "https://rpc.mainnet.arc.io" }
  if ($env:USDC_ADDRESS -ine "0x3600000000000000000000000000000000000000") { throw "Mainnet USDC_ADDRESS must be Arc native USDC at 0x3600000000000000000000000000000000000000." }
}

& "$PSScriptRoot/preflight.ps1" -Network $Network
if ($Network -eq "mainnet") {
  Write-Warning "This broadcasts an irreversible mainnet deployment and spends real USDC."
  $confirmation = Read-Host "Type DEPLOY MAINNET to broadcast a deployment"
  if ($confirmation -cne "DEPLOY MAINNET") { throw "Cancelled." }
}

forge build
if ($LASTEXITCODE -ne 0) { throw "Foundry compilation failed; deployment stopped." }
$forgeArgs = @("create", "contracts/MandateGraph.sol:MandateGraph", "--rpc-url", $env:ARC_RPC_URL, "--constructor-args", $env:USDC_ADDRESS, "--broadcast", "--json")
if ($env:KEYSTORE_ACCOUNT) { $forgeArgs += @("--account", $env:KEYSTORE_ACCOUNT) }
else { $forgeArgs += "--interactive" }
$output = & forge @forgeArgs
if ($LASTEXITCODE -ne 0) { throw "Contract deployment failed." }
$output
$deployment = ($output -join "`n") | ConvertFrom-Json
if (-not $deployment.deployedTo -or -not $deployment.transactionHash) { throw "Could not parse deployment address and transaction hash from Forge JSON output." }
$env:CONTRACT_ADDRESS = $deployment.deployedTo
$env:DEPLOYMENT_TX_HASH = $deployment.transactionHash
& "$PSScriptRoot/verify-deploy.ps1"
