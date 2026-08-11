$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  throw 'pnpm was not found. Install Node.js 20+, then run: corepack enable'
}

if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
  & $pnpm.Source install
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}

$apiCommand = "Set-Location -LiteralPath '$repoRoot'; pnpm --filter @media-lab/api dev"
$webCommand = "Set-Location -LiteralPath '$repoRoot'; pnpm --filter @media-lab/web dev"
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',$apiCommand
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',$webCommand

$deadline = (Get-Date).AddSeconds(35)
do {
  Start-Sleep -Milliseconds 500
  try {
    $web = Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing -TimeoutSec 2
    $apiReady = $false
    try { Invoke-WebRequest -Uri 'http://localhost:4000/v1/render-jobs/health-check' -UseBasicParsing -TimeoutSec 2 | Out-Null }
    catch { $apiReady = $_.Exception.Response.StatusCode -eq 404 }
    if ($web.StatusCode -eq 200 -and $apiReady) {
      Start-Process 'http://localhost:3000'
      Write-Host 'Media Runtime Lab is ready: http://localhost:3000' -ForegroundColor Cyan
      exit 0
    }
  } catch {}
} while ((Get-Date) -lt $deadline)

throw 'Startup timed out. Check whether ports 3000 and 4000 are already in use.'
