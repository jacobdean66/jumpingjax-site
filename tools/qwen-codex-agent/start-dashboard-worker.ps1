param([switch]$Once)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'windows-credential.ps1')
$target = 'JumpingJax.QwenPilot.Worker'
try {
  $env:QWEN_PILOT_WORKER_SECRET = [QwenPilotCredential]::Read($target)
  $workerArgs = @((Join-Path $PSScriptRoot 'dashboard-pilot.mjs'))
  if ($Once) { $workerArgs += '--once' }
  $logDirectory = Join-Path $env:LOCALAPPDATA 'JumpingJax/QwenWorker'
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
  $logFile = Join-Path $logDirectory 'worker.log'
  # The worker prints bounded status messages only, never prompts or credentials.
  & node @workerArgs 2>&1 | Tee-Object -FilePath $logFile -Append
  $workerExit = $LASTEXITCODE
  exit $workerExit
} finally {
  Remove-Item Env:QWEN_PILOT_WORKER_SECRET -ErrorAction SilentlyContinue
}
