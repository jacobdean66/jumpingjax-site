param([switch]$Once)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-credential.ps1')
$target = 'JumpingJax.QwenPilot.Worker'
try {
  $env:QWEN_PILOT_WORKER_SECRET = [QwenPilotCredential]::Read($target)
  $workerArgs = @((Join-Path $PSScriptRoot 'dashboard-pilot.mjs'))
  if ($Once) { $workerArgs += '--once' }
  & node @workerArgs
  exit $LASTEXITCODE
} finally {
  Remove-Item Env:QWEN_PILOT_WORKER_SECRET -ErrorAction SilentlyContinue
}
