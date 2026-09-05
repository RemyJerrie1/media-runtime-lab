param(
  [Parameter(Position = 0)]
  [ValidateSet('start', 'stop', 'restart', 'status')]
  [string]$Command = 'status'
)

$root = $PSScriptRoot
$startScript = Join-Path $root 'scripts\start-demo.ps1'
$stopScript = Join-Path $root 'scripts\stop-demo.ps1'

switch ($Command) {
  'start' { & $startScript }
  'stop' { & $stopScript }
  'restart' {
    & $stopScript
    if ($LASTEXITCODE -eq 0) { & $startScript }
  }
  'status' {
    foreach ($port in @(3000, 4000, 5432)) {
      $listening = netstat.exe -ano | Select-String -Pattern "^\s*TCP\s+\S+:$port\s+\S+\s+LISTENING"
      $state = if ($listening) { 'running' } else { 'stopped' }
      Write-Host ("{0,-5} {1}" -f $port, $state)
    }
  }
}

exit $LASTEXITCODE
