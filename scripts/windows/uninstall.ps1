<#
.SYNOPSIS
  Removes the scheduled tasks and the firewall rule. Leaves the database and
  the backups alone -- those are the data, and this script does not touch data.
#>

[CmdletBinding()]
param([int] $Port = 3001)

$ErrorActionPreference = 'Continue'

foreach ($task in @('MiltenyiInventoryHub', 'MiltenyiInventoryHubBackup')) {
    if (Get-ScheduledTask -TaskName $task -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask   -TaskName $task -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $task -Confirm:$false
        Write-Host "Removed scheduled task $task"
    }
}

$ruleName = "Miltenyi Inventory Hub (TCP $Port)"
if (Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue) {
    Remove-NetFirewallRule -DisplayName $ruleName
    Write-Host "Removed firewall rule: $ruleName"
}

Write-Host ''
Write-Host 'The PostgreSQL database and the backup files were left untouched.'
