$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$rpcUrl = 'https://rpc.mainnet.arc.io'
$deployer = '0x03607de69C487BcC460eaD7C4Bdfd25805658b75'
$confirmation = 'ARC_MAINNET_V2_DEPLOY_ONLY'
$account = if ($env:V2_MAINNET_ACCOUNT) { $env:V2_MAINNET_ACCOUNT } else { 'agentledger-testnet' }
$foundryBin = if ($env:FOUNDRY_BIN) { $env:FOUNDRY_BIN } else { Join-Path $HOME '.foundry\bin' }
$cast = Join-Path $foundryBin 'cast.exe'

if ($env:V2_MAINNET_BROADCAST -ne $confirmation) {
  throw "Set V2_MAINNET_BROADCAST=$confirmation for this approved deploy-only transaction."
}
if (-not (Test-Path -LiteralPath $cast)) { throw "cast.exe was not found at $cast" }

& node scripts/prepare-v2-mainnet-deployment.mjs | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Read-only Mainnet deployment preflight failed.' }
$plan = Get-Content docs/MAINNET_V2_DEPLOYMENT_PLAN.json -Raw | ConvertFrom-Json

if ($plan.network.chainId -ne '5042') { throw 'Unexpected chain ID in deployment plan.' }
if ($plan.deployment.deployer.ToLowerInvariant() -ne $deployer.ToLowerInvariant()) { throw 'Unexpected deployer in deployment plan.' }
if ($plan.deployment.creationBytecodeHash -ne '0x5dec88089cacd7ab0e0f03eceb35c28e11c4895efc9ae12125fadb9c468df75f') { throw 'Reviewed V2 creation bytecode hash changed.' }
if ($plan.deployment.initCodeHash -ne '0x0cf680f4263bfd448532e0485a6579ca156bec0eb7e6ba19075912ef4e2cf55d') { throw 'Reviewed V2 Mainnet init code hash changed.' }

Write-Host 'Password prompt 1/2: verify the encrypted Foundry account address.'
$accountAddress = (& $cast wallet address --account $account).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Foundry account address verification failed.' }
if ($accountAddress.ToLowerInvariant() -ne $deployer.ToLowerInvariant()) { throw "Account $account resolves to unexpected address $accountAddress" }

$currentNonce = (& $cast nonce $deployer --rpc-url $rpcUrl --block pending).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Pending nonce read failed.' }
if ($currentNonce -ne $plan.deployment.deployerNonce) { throw "Pending nonce changed from plan value $($plan.deployment.deployerNonce) to $currentNonce. Re-run review." }

$expectedAddress = (& $cast compute-address --nonce $currentNonce $deployer).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Expected contract address calculation failed.' }
$existingCode = (& $cast code $expectedAddress --rpc-url $rpcUrl).Trim()
if ($LASTEXITCODE -ne 0 -or $existingCode -ne '0x') { throw "Expected contract address $expectedAddress is not unused." }

$initCode = (& node scripts/print-v2-mainnet-init-code.mjs).Trim()
if ($LASTEXITCODE -ne 0) { throw 'V2 Mainnet init code generation failed.' }
$initCodeHash = (& $cast keccak $initCode).Trim()
if ($LASTEXITCODE -ne 0 -or $initCodeHash -ne $plan.deployment.initCodeHash) { throw 'Generated init code does not match the reviewed hash.' }

Write-Host "Chain: 5042"
Write-Host "Deployer: $deployer"
Write-Host "Nonce: $currentNonce"
Write-Host "Expected contract: $expectedAddress"
Write-Host "Init code hash: $initCodeHash"
Write-Host "Gas limit: $($plan.deployment.gas.proposedGasLimit)"
Write-Host "Gas price: $($plan.deployment.gas.gasPriceWei) wei"
Write-Host "Buffered maximum fee: $($plan.deployment.gas.bufferedMaximumFeeNative) native"
Write-Host 'Password prompt 2/2: sign the approved V2 deploy-only transaction.'

& $cast send --from $deployer --account $account --rpc-url $rpcUrl `
  --gas-limit $plan.deployment.gas.proposedGasLimit --gas-price $plan.deployment.gas.gasPriceWei `
  --async --json --create $initCode
if ($LASTEXITCODE -ne 0) { throw 'V2 Mainnet deployment transaction was not broadcast.' }

Write-Host "Expected contract after confirmation: $expectedAddress"
Write-Host 'Paste only the public transaction hash back into Codex. Do not share the keystore password.'
