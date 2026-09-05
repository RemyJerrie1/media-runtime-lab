$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $repoRoot '.demo-logs'
Set-Location -LiteralPath $repoRoot

Write-Host '[Media Lab] Stopping the full-stack demo...' -ForegroundColor Cyan

foreach ($port in @(3000, 4000)) {
  $pattern = "^\s*TCP\s+\S+:$port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  $owners = netstat.exe -ano | ForEach-Object {
    if ($_ -match $pattern) { [int]$matches[1] }
  } | Sort-Object -Unique
  foreach ($ownerPid in $owners) {
    & taskkill.exe /PID $ownerPid /T /F | Out-Null
    Write-Host "[Media Lab] Stopped process $ownerPid on port $port." -ForegroundColor DarkGray
  }
}

foreach ($name in @('web', 'api')) {
  $pidFile = Join-Path $logRoot "$name.pid"
  if (-not (Test-Path -LiteralPath $pidFile)) { continue }

  $servicePid = [int](Get-Content -LiteralPath $pidFile -Raw)
  if (Get-Process -Id $servicePid -ErrorAction SilentlyContinue) {
    & taskkill.exe /PID $servicePid /T /F | Out-Null
    Write-Host "[Media Lab] Stopped $name." -ForegroundColor DarkGray
  }
  Remove-Item -LiteralPath $pidFile -Force
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if ($docker) {
  & $docker.Source compose stop postgres | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to stop.' }
  Write-Host '[Media Lab] Stopped PostgreSQL.' -ForegroundColor DarkGray
}

Write-Host 'Media Runtime Lab is fully stopped.' -ForegroundColor Green
