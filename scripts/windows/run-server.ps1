<#
.SYNOPSIS
  Runs the Inventory Hub server and keeps it running.

.DESCRIPTION
  Loads server.env, starts the Node server, and restarts it if it ever exits.
  Task Scheduler starts this at boot; this script is what makes "always on"
  actually mean always on.

  Why a supervisor rather than just launching node: a bare Task Scheduler entry
  starts the process once. If Node exits at 3am -- an unhandled error, a database
  blip, a Windows update restarting a dependency -- nothing brings it back, and
  the first anyone knows is that the system is down when they arrive. This loop
  restarts it, backs off so a crash loop does not spin the CPU, and writes
  everything to a log that can be read afterwards.

  It deliberately does NOT give up. A server that stays down until somebody
  notices is the failure this is here to prevent.
#>

[CmdletBinding()]
param(
    [string] $EnvFile,
    [string] $LogDir
)

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot   = Resolve-Path (Join-Path $scriptDir '..\..')
if (-not $EnvFile) { $EnvFile = Join-Path $scriptDir 'server.env' }
if (-not $LogDir)  { $LogDir  = Join-Path $appRoot 'logs' }

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$supervisorLog = Join-Path $LogDir 'supervisor.log'

function Write-Log {
    param([string] $Message)
    $line = "{0}  {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
    Write-Output $line
    Add-Content -Path $supervisorLog -Value $line -Encoding utf8
}

# -- Load configuration --------------------------------------------------------
if (-not (Test-Path $EnvFile)) {
    Write-Log "FATAL: no configuration at $EnvFile. Copy env.example to server.env and fill it in."
    exit 1
}

$loaded = 0
foreach ($line in Get-Content -Path $EnvFile -Encoding utf8) {
    $trimmed = $line.Trim()
    if ($trimmed -eq '' -or $trimmed.StartsWith('#')) { continue }
    $split = $trimmed.IndexOf('=')
    if ($split -lt 1) { continue }
    $name  = $trimmed.Substring(0, $split).Trim()
    $value = $trimmed.Substring($split + 1).Trim()
    # Strip one layer of surrounding quotes if present.
    if ($value.Length -ge 2 -and
        (($value.StartsWith('"') -and $value.EndsWith('"')) -or
         ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
    }
    Set-Item -Path "Env:$name" -Value $value
    $loaded++
}
Write-Log "Loaded $loaded setting(s) from $EnvFile"

foreach ($required in @('DATABASE_URL', 'JWT_SECRET')) {
    if (-not (Get-Item -Path "Env:$required" -ErrorAction SilentlyContinue).Value) {
        Write-Log "FATAL: $required is not set in $EnvFile."
        exit 1
    }
}

Set-Location $appRoot

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) {
    Write-Log 'FATAL: node was not found on PATH. Install Node.js and reboot so the service picks up the new PATH.'
    exit 1
}
Write-Log "Using $node in $appRoot"

if (-not (Test-Path (Join-Path $appRoot 'dist\index.html'))) {
    Write-Log 'WARNING: dist\index.html is missing -- the browser will get "Cannot GET /". Run: npm run build'
}

# -- Supervise -----------------------------------------------------------------
$failures = 0

while ($true) {
    Write-Log 'Starting the server'
    $started = Get-Date

    $outLog = Join-Path $LogDir 'server.log'
    $errLog = Join-Path $LogDir 'server.error.log'

    # Start-Process truncates its redirect targets, so a restart would erase the
    # output explaining why the previous run died -- exactly the evidence needed.
    # Keep one generation back before each start.
    foreach ($logPath in @($outLog, $errLog)) {
        if (Test-Path $logPath) {
            $previous = [IO.Path]::ChangeExtension($logPath, $null).TrimEnd('.') + '.prev.log'
            Move-Item -Path $logPath -Destination $previous -Force -ErrorAction SilentlyContinue
        }
    }

    $proc = Start-Process -FilePath $node `
                          -ArgumentList 'server/index.js' `
                          -WorkingDirectory $appRoot `
                          -NoNewWindow -PassThru `
                          -RedirectStandardOutput $outLog `
                          -RedirectStandardError $errLog
    $proc.WaitForExit()

    $ranFor = (Get-Date) - $started
    Write-Log ("Server exited with code {0} after {1:n0} second(s)" -f $proc.ExitCode, $ranFor.TotalSeconds)

    # A process that ran for a good while and then stopped is a one-off; restart
    # it promptly. One that dies immediately is misconfigured, and hammering it
    # would fill the disk with logs and the event viewer with noise.
    if ($ranFor.TotalSeconds -gt 60) { $failures = 0 } else { $failures++ }

    $delay = [Math]::Min(300, [Math]::Pow(2, [Math]::Min($failures, 8)))
    if ($failures -ge 3) {
        Write-Log "WARNING: $failures quick failures in a row -- check $errLog. Retrying in $delay second(s)."
    }
    Start-Sleep -Seconds $delay
}
