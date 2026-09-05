param([switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$logRoot = Join-Path $repoRoot '.demo-logs'
$envFile = Join-Path $repoRoot '.env'
Set-Location -LiteralPath $repoRoot

function Write-Step([string]$Message) {
  Write-Host "[Media Lab] $Message" -ForegroundColor Cyan
}

function Test-Http([string]$Uri, [hashtable]$Headers = @{}) {
  try {
    $response = Invoke-WebRequest -Uri $Uri -Headers $Headers -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-Port([int]$Port) {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    return $result.AsyncWaitHandle.WaitOne(300) -and $client.Connected
  } finally {
    $client.Dispose()
  }
}

function Stop-PortOwner([int]$Port) {
  $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
  $owners = netstat.exe -ano | ForEach-Object {
    if ($_ -match $pattern) { [int]$matches[1] }
  } | Sort-Object -Unique
  foreach ($ownerPid in $owners) {
    & taskkill.exe /PID $ownerPid /T /F | Out-Null
    Write-Step "Stopped stale process $ownerPid on port $Port."
  }
}

function Wait-Docker {
  & cmd.exe /d /c 'docker info >nul 2>&1'
  if ($LASTEXITCODE -eq 0) { return }

  $desktop = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
  if (-not (Test-Path -LiteralPath $desktop)) {
    throw 'Docker Desktop is installed in an unexpected location.'
  }
  Write-Step 'Starting Docker Desktop...'
  Start-Process -FilePath $desktop -WindowStyle Hidden
  $dockerDeadline = (Get-Date).AddSeconds(120)
  do {
    Start-Sleep -Seconds 2
    & cmd.exe /d /c 'docker info >nul 2>&1'
    if ($LASTEXITCODE -eq 0) { return }
  } while ((Get-Date) -lt $dockerDeadline)
  throw 'Docker Desktop did not become ready within 120 seconds.'
}

function Start-DemoService([string]$Name) {
  $stdout = Join-Path $logRoot "$Name.stdout.log"
  $stderr = Join-Path $logRoot "$Name.stderr.log"
  if ($Name -eq 'api') {
    $serviceRoot = Join-Path $repoRoot 'apps\api'
    $command = "Set-Location -LiteralPath '$serviceRoot'; & '.\node_modules\.bin\tsx.cmd' watch src\main.ts"
  } else {
    $serviceRoot = Join-Path $repoRoot 'apps\web'
    $command = "Set-Location -LiteralPath '$serviceRoot'; & '.\node_modules\.bin\next.cmd' dev --port 3000"
  }
  Write-Step "Starting $Name..."
  $process = Start-Process powershell.exe -WindowStyle Hidden -PassThru `
    -ArgumentList '-NoProfile', '-Command', $command `
    -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  Set-Content -LiteralPath (Join-Path $logRoot "$Name.pid") -Value $process.Id
  return $process
}

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
  throw 'pnpm was not found. Install Node.js 22, then run: corepack enable'
}

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
  throw 'Docker was not found. Start Docker Desktop before running the full demo.'
}

if (-not (Test-Path $envFile)) {
  Copy-Item -LiteralPath (Join-Path $repoRoot '.env.example') -Destination $envFile
  Write-Step 'Created the local .env file.'
}

Get-Content -LiteralPath $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
    [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
  }
}

if (-not (Test-Path (Join-Path $repoRoot 'node_modules'))) {
  Write-Step 'First launch: installing dependencies...'
  & $pnpm.Source install --frozen-lockfile
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}

New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
Stop-PortOwner 3000
Stop-PortOwner 4000
Wait-Docker
Write-Step 'Starting PostgreSQL and waiting for its health check...'
& $docker.Source compose up -d --wait postgres
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL failed to start. Confirm that Docker Desktop is ready.' }

$headers = @{ 'x-tenant-id' = 'demo-tenant'; 'x-api-key' = $env:MEDIA_RUNTIME_API_KEY }
$webReady = $false
$apiReady = $false

$started = @()
if (-not $apiReady) { $started += Start-DemoService 'api' }
if (-not $webReady) { $started += Start-DemoService 'web' }

$deadline = (Get-Date).AddSeconds(75)
do {
  Start-Sleep -Milliseconds 700
  $webReady = Test-Http 'http://localhost:3000/'
  $apiReady = Test-Http 'http://localhost:4000/v1/operations' $headers
  if ($webReady -and $apiReady) {
    Write-Host ''
    Write-Host 'Media Runtime Lab is ready' -ForegroundColor Green
    Write-Host 'Web       http://localhost:3000' -ForegroundColor White
    Write-Host 'API       http://localhost:4000' -ForegroundColor White
    Write-Host 'API docs  http://localhost:3000/api-reference' -ForegroundColor White
    Write-Host "Log       $logRoot" -ForegroundColor DarkGray
    if (-not $NoBrowser) { Start-Process 'http://localhost:3000' }
    exit 0
  }

  $failed = $started | Where-Object { $_.HasExited -and $_.ExitCode -ne 0 }
  if ($failed) { break }
} while ((Get-Date) -lt $deadline)

$details = @()
foreach ($name in @('api', 'web')) {
  $errorLog = Join-Path $logRoot "$name.stderr.log"
  if (Test-Path $errorLog) {
    $tail = Get-Content -LiteralPath $errorLog -Tail 12 -ErrorAction SilentlyContinue
    if ($tail) { $details += "`n[$name]`n$($tail -join "`n")" }
  }
}
throw "Startup timed out. Logs: $logRoot$($details -join '')"
