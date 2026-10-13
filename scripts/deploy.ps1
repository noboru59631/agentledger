param(
  [ValidateSet("testnet", "mainnet")][string]$Network = "testnet"
)

$ErrorActionPreference = "Stop"

if ($Network -eq "mainnet") { throw "Mainnet broadcast is disabled. Run scripts/arc-readonly-preflight.mjs with ARC_NETWORK=mainnet for read-only checks." }
if (-not (Get-Command arc-forge -ErrorAction SilentlyContinue) -or -not (Get-Command cast -ErrorAction SilentlyContinue)) { throw "Arc Foundry arc-forge and Foundry cast are required." }
if (-not $env:USDC_ADDRESS) { throw "Set USDC_ADDRESS to the verified token contract for the selected network." }
if ($env:USDC_ADDRESS -notmatch '^0x[0-9a-fA-F]{40}$') { throw "USDC_ADDRESS must be a 20-byte hexadecimal address." }
if (-not $env:IDENTITY_REGISTRY_ADDRESS) { $env:IDENTITY_REGISTRY_ADDRESS = "0x8004A818BFB912233c491871b3d84c89A494BD9e" }
if ($env:IDENTITY_REGISTRY_ADDRESS -ine "0x8004A818BFB912233c491871b3d84c89A494BD9e") { throw "Testnet IDENTITY_REGISTRY_ADDRESS must be the official Arc ERC-8004 Identity Registry." }

$expectedChainId = "5042002"
if (-not $env:ARC_RPC_URL) { $env:ARC_RPC_URL = "https://rpc.testnet.arc.io" }

& "$PSScriptRoot/preflight.ps1" -Network $Network

arc-forge build --network arc
if ($LASTEXITCODE -ne 0) { throw "Foundry compilation failed; deployment stopped." }
$forgeArgs = @("create", "contracts/MandateGraph.sol:MandateGraph", "--network", "arc", "--rpc-url", $env:ARC_RPC_URL, "--constructor-args", $env:USDC_ADDRESS, $env:IDENTITY_REGISTRY_ADDRESS, "--broadcast", "--json")
if ($env:KEYSTORE_ACCOUNT) { $forgeArgs += @("--account", $env:KEYSTORE_ACCOUNT) }
else { $forgeArgs += "--interactive" }
$output = & arc-forge @forgeArgs
if ($LASTEXITCODE -ne 0) { throw "Contract deployment failed." }
$output
$deployment = ($output -join "`n") | ConvertFrom-Json
if (-not $deployment.deployedTo -or -not $deployment.transactionHash) { throw "Could not parse deployment address and transaction hash from Forge JSON output." }
$env:CONTRACT_ADDRESS = $deployment.deployedTo
$env:DEPLOYMENT_TX_HASH = $deployment.transactionHash
& "$PSScriptRoot/verify-deploy.ps1"
