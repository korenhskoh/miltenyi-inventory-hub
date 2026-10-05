<#
.SYNOPSIS
  Runs the nightly database backup. Started by the scheduled task.

.DESCRIPTION
  Loads server.env the same way the server does, then runs the backup script.
  Kept separate from run-server.ps1 so a backup failure can never take the
  server down with it, and so it can be run by hand to test.
#>

[CmdletBinding()]
param([string] $EnvFile)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot   = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
if (-not $EnvFile) { $EnvFile = Join-Path $scriptDir 'server.env' }

$logDir = Join-Path $appRoot 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'backup.log'

function Write-Log {
    param([string] $Message)
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Output $line
    Add-Content -Path $log -Value $line -Encoding utf8
}

if (-not (Test-Path $EnvFile)) {
    Write-Log "FATAL: no configuration at $EnvFile"
    exit 1
}

foreach ($line in Get-Content -Path $EnvFile -Encoding utf8) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $split = $trimmed.IndexOf('=')
    if ($split -lt 1) { continue }
    $name  = $trimmed.Substring(0, $split).Trim()
    $value = $trimmed.Substring($split + 1).Trim()
    if ($value.Length -ge 2 -and
        (($value.StartsWith('"') -and $value.EndsWith('"')) -or
         ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
}

Set-Location $appRoot
Write-Log 'Starting backup'

& node 'scripts/backup-db.mjs' 2>&1 | ForEach-Object { Write-Log $_ }
$code = $LASTEXITCODE

if ($code -ne 0) {
    # Non-zero so Task Scheduler's "Last Run Result" shows a failure. A backup
    # that silently stops working is indistinguishable from one that works,
    # right up until a restore is needed.
    Write-Log "BACKUP FAILED with exit code $code"
    exit $code
}

Write-Log 'Backup finished'
