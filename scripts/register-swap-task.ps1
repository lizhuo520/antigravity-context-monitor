$taskName = "AntigravityMonitorSwap"
$scriptPath = "C:\Users\Lizhuo\.gemini\antigravity\scratch\antigravity-context-monitor\scripts\swap-task.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $taskName -Action $action -Settings $settings -Force
Start-ScheduledTask -TaskName $taskName

Write-Host "Task $taskName registered and started successfully."
