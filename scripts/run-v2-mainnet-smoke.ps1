param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('ARC_MAINNET_V2_SMOKE_ONLY')]
  [string]$Confirmation,

  [string]$Account = 'agentledger-testnet',
  [switch]$Resume
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

try {
  if (-not $Resume) {
    node scripts/run-arc-mainnet-v2-smoke.mjs --preflight
    if ($LASTEXITCODE -ne 0) { throw 'Read-only V2 Mainnet smoke preflight failed.' }
  }

  Write-Host 'The runner will simulate every action before broadcast and stop above the fee ceiling.'
  Write-Host 'Foundry will request the encrypted keystore password locally; it is never stored or logged.'
  $env:V2_MAINNET_SMOKE_BROADCAST = $Confirmation
  $env:V2_MAINNET_ACCOUNT = $Account
  node scripts/run-arc-mainnet-v2-smoke.mjs --execute
  if ($LASTEXITCODE -ne 0) { throw 'V2 Mainnet smoke stopped. Review the resumable evidence before retrying with -Resume.' }

  node scripts/run-arc-mainnet-v2-smoke.mjs --verify
  if ($LASTEXITCODE -ne 0) { throw 'V2 Mainnet smoke verification failed.' }
}
finally {
  Remove-Item Env:V2_MAINNET_SMOKE_BROADCAST -ErrorAction SilentlyContinue
  Remove-Item Env:V2_MAINNET_ACCOUNT -ErrorAction SilentlyContinue
}
