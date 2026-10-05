<#
.SYNOPSIS
  Sets up the Inventory Hub to run on this desktop, starting automatically at boot.

.DESCRIPTION
  Registers two scheduled tasks -- the server supervisor at startup, and a nightly
  database backup -- and opens the firewall port so other machines on the office
  network can reach it.

  Scheduled tasks rather than a Windows service because a service needs either a
  third-party wrapper (NSSM) or a native service binary, and neither is welcome
  on a managed corporate desktop. A task set to run whether the user is logged on
  or not starts at boot, survives sign-out, and needs nothing installed.

  Run this from an ELEVATED PowerShell prompt:
    Set-ExecutionPolicy -Scope Process Bypass -Force
    .\scripts\windows\install.ps1

.PARAMETER Port
  The port to open. Must match PORT in server.env.

.PARAMETER ServiceAccount
  Which account the tasks run as. SYSTEM needs no password and never expires,
  which is what you want for something that must survive a password change.
#>

[CmdletBinding()]
param(
    [int]    $Port = 3001,
    [string] $ServiceAccount = 'SYSTEM',
    [switch] $SkipFirewall,
    [switch] $SkipBackup
)

$ErrorActionPreference = 'Stop'

function Require-Admin {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'This must run from an elevated PowerShell prompt (right-click, Run as administrator).'
    }
}

Require-Admin

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appRoot   = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
$envFile   = Join-Path $scriptDir 'server.env'

Write-Host ''
Write-Host "Application folder : $appRoot"
Write-Host "Configuration      : $envFile"
Write-Host ''

# -- Preflight -----------------------------------------------------------------
if (-not (Test-Path $envFile)) {
    throw "No configuration found. Copy scripts\windows\env.example to scripts\windows\server.env, fill it in, then run this again."
}

foreach ($tool in @('node', 'npm', 'pg_dump')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "'$tool' is not on PATH. Install Node.js and PostgreSQL, then open a NEW PowerShell window so it picks up the updated PATH."
    }
}
Write-Host ("node {0}, npm {1}" -f (node --version), (npm --version))
Write-Host ("pg_dump {0}" -f ((pg_dump --version) -replace '[^0-9.]', ' ').Trim())

if (-not (Test-Path (Join-Path $appRoot 'dist\index.html'))) {
    Write-Warning 'dist\index.html is missing. Run "npm ci" then "npm run build" before starting, or the browser will show "Cannot GET /".'
}

# -- The server task -----------------------------------------------------------
$serverTask = 'MiltenyiInventoryHub'
$runner     = Join-Path $scriptDir 'run-server.ps1'

Write-Host ''
Write-Host "Registering scheduled task '$serverTask' (at startup, as $ServiceAccount)"

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $runner) `
    -WorkingDirectory $appRoot

$trigger = New-ScheduledTaskTrigger -AtStartup

# ExecutionTimeLimit 0 means "never kill it" -- the default of three days would
# stop the server mid-week with no explanation.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero)

$principal = New-ScheduledTaskPrincipal -UserId $ServiceAccount -LogonType ServiceAccount -RunLevel Highest

Unregister-ScheduledTask -TaskName $serverTask -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName $serverTask -Action $action -Trigger $trigger `
    -Settings $settings -Principal $principal `
    -Description 'Miltenyi Inventory Hub application server' | Out-Null
Write-Host '  registered'

# -- The backup task -----------------------------------------------------------
if (-not $SkipBackup) {
    $backupTask = 'MiltenyiInventoryHubBackup'
    $backupRunner = Join-Path $scriptDir 'run-backup.ps1'

    Write-Host "Registering scheduled task '$backupTask' (daily at 01:30)"
    $bAction = New-ScheduledTaskAction -Execute 'powershell.exe' `
        -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $backupRunner) `
        -WorkingDirectory $appRoot
    $bTrigger  = New-ScheduledTaskTrigger -Daily -At '01:30'
    $bSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
        -ExecutionTimeLimit (New-TimeSpan -Hours 2)

    Unregister-ScheduledTask -TaskName $backupTask -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $backupTask -Action $bAction -Trigger $bTrigger `
        -Settings $bSettings -Principal $principal `
        -Description 'Nightly backup of the Miltenyi Inventory Hub database' | Out-Null
    Write-Host '  registered'
}

# -- Firewall ------------------------------------------------------------------
if (-not $SkipFirewall) {
    $ruleName = "Miltenyi Inventory Hub (TCP $Port)"
    Write-Host ''
    Write-Host "Opening port $Port for the private network profile"
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    # Private profile only. Opening this on a Public profile would expose the
    # system on untrusted networks, which is never what is wanted here.
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -Profile Private | Out-Null
    Write-Host '  rule added (Private profile only)'
}

# -- Where to find it ----------------------------------------------------------
$addresses = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress

Write-Host ''
Write-Host 'Setup complete.'
Write-Host ''
Write-Host 'Start it now with:'
Write-Host "  Start-ScheduledTask -TaskName '$serverTask'"
Write-Host ''
Write-Host 'Then open it at:'
Write-Host "  http://localhost:$Port          (on this machine)"
foreach ($ip in $addresses) {
    Write-Host ("  http://{0}:{1}        (from other machines)" -f $ip, $Port)
}
Write-Host ("  http://{0}:{1}" -f $env:COMPUTERNAME, $Port)
Write-Host ''
Write-Host 'Give this desktop a fixed IP address, or a DHCP reservation, before sharing'
Write-Host 'that address with anyone -- otherwise it will change and every link will break.'
Write-Host ''
Write-Host "Logs: $(Join-Path $appRoot 'logs')"
