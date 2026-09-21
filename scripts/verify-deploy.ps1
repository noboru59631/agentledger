$ErrorActionPreference = "Stop"
if (-not $env:ARC_RPC_URL -or -not $env:CONTRACT_ADDRESS -or -not $env:DEPLOYMENT_TX_HASH) { throw "Set ARC_RPC_URL, CONTRACT_ADDRESS, and DEPLOYMENT_TX_HASH." }
if ($env:CONTRACT_ADDRESS -notmatch '^0x[0-9a-fA-F]{40}$' -or $env:DEPLOYMENT_TX_HASH -notmatch '^0x[0-9a-fA-F]{64}$') { throw "Contract address or transaction hash has invalid format." }
$code = (cast code $env:CONTRACT_ADDRESS --rpc-url $env:ARC_RPC_URL).Trim()
if ($LASTEXITCODE -ne 0 -or $code -eq "0x" -or -not $code) { throw "No deployed bytecode found at $env:CONTRACT_ADDRESS." }
$chainId = (cast chain-id --rpc-url $env:ARC_RPC_URL).Trim()
$explorer = if ($chainId -eq "5042") { "https://explorer.arc.io" } elseif ($chainId -eq "5042002") { "https://explorer.testnet.arc.io" } else { "Explorer unverified for chain $chainId" }
Write-Output "Contract: $env:CONTRACT_ADDRESS"
Write-Output "Deployment transaction: $env:DEPLOYMENT_TX_HASH"
Write-Output "Runtime bytecode: present ($($code.Length / 2 - 1) bytes)"
Write-Output "Explorer: $explorer"
