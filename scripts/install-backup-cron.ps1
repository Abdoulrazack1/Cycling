# Installs a Windows Scheduled Task for daily MySQL backup.
#
# Usage:
#   .\scripts\install-backup-cron.ps1
#   .\scripts\install-backup-cron.ps1 -Uninstall
#
# Daily at 03:00 by default. Log : backups\logs\backup.log

param(
  [switch]$Uninstall,
  [string]$TaskName = "CCS-Cycling-Backup",
  [string]$Time     = "03:00"
)

$ProjectPath = "C:\laragon\www\Cycling"
$LogDir      = "$ProjectPath\backups\logs"
$ScriptToRun = "$ProjectPath\scripts\backup-db.js"

if ($Uninstall) {
  try {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
    Write-Host "[OK] Task '$TaskName' removed."
  } catch {
    Write-Host "[INFO] Task not found (already removed)."
  }
  exit 0
}

if (-not (Test-Path $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

$nodeExe = $null
foreach ($p in @("C:\Program Files\nodejs\node.exe", "C:\nvm4w\nodejs\node.exe")) {
  if (Test-Path $p) { $nodeExe = $p; break }
}
if (-not $nodeExe) {
  $cmd = Get-Command node -ErrorAction SilentlyContinue
  if ($cmd) { $nodeExe = $cmd.Source }
}
if (-not $nodeExe) {
  Write-Error "node.exe not found in standard paths nor in PATH"
  exit 1
}
Write-Host "[OK] node.exe : $nodeExe"

try {
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
} catch {
  # ignore if not present
}

$logFile = "$LogDir\backup.log"
$argList = "/c `"$nodeExe`" `"$ScriptToRun`" >> `"$logFile`" 2>&1"

$action    = New-ScheduledTaskAction -Execute "cmd.exe" -Argument $argList -WorkingDirectory $ProjectPath
$trigger   = New-ScheduledTaskTrigger -Daily -At $Time
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily MySQL backup for CCS Cycling" -ErrorAction Stop | Out-Null
  Write-Host "[OK] Task '$TaskName' installed (daily at $Time)."
  Write-Host "Logs        : $logFile"
  Write-Host "Run now     : Start-ScheduledTask -TaskName $TaskName"
  Write-Host "Uninstall   : .\scripts\install-backup-cron.ps1 -Uninstall"
  $info = Get-ScheduledTaskInfo -TaskName $TaskName
  Write-Host "Next run    : $($info.NextRunTime)"
} catch {
  Write-Error "Register-ScheduledTask error: $($_.Exception.Message)"
  Write-Host "Tip: run PowerShell as Administrator if you got Access Denied."
  exit 1
}
