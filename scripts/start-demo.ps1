$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  throw '找不到 pnpm。請先安裝 Node.js 20+，再執行：corepack enable'
}

if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
  & $pnpm.Source install
  if ($LASTEXITCODE -ne 0) { throw '依賴安裝失敗。' }
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
      Write-Host 'Media Runtime Lab 已啟動：http://localhost:3000' -ForegroundColor Cyan
      exit 0
    }
  } catch {}
} while ((Get-Date) -lt $deadline)

throw '啟動逾時。請確認 3000 與 4000 ports 未被其他程式占用。'
