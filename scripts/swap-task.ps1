$ErrorActionPreference = 'SilentlyContinue'
$resourcesDir = "$env:LOCALAPPDATA\Programs\antigravity\resources"
$asarPath = "$resourcesDir\app.asar"
$stagedPath = "$resourcesDir\app.asar.staged"
$swapOldPath = "$resourcesDir\app.asar.swap-old"
$logPath = "$resourcesDir\swap-task.log"

"$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] AntigravityMonitorSwap task started. Waiting for Antigravity to close..." | Out-File -FilePath $logPath -Encoding utf8

$maxAttempts = 7200
$counter = 0

while ($counter -lt $maxAttempts) {
    Start-Sleep -Milliseconds 500
    $counter++

    if (-not (Test-Path $stagedPath)) {
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] Staged file no longer exists. Exiting." | Out-File -FilePath $logPath -Append -Encoding utf8
        break
    }

    $procs = Get-Process -Name Antigravity -ErrorAction SilentlyContinue
    if (-not $procs) {
        "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [INFO] Antigravity process exit detected. Initiating atomic swap..." | Out-File -FilePath $logPath -Append -Encoding utf8
        
        $success = $false
        for ($i = 1; $i -le 30; $i++) {
            Start-Sleep -Milliseconds 300
            try {
                if (Test-Path $swapOldPath) {
                    Remove-Item $swapOldPath -Force -ErrorAction SilentlyContinue
                }
                Rename-Item -Path $asarPath -NewName "app.asar.swap-old" -Force -ErrorAction Stop
                Rename-Item -Path $stagedPath -NewName "app.asar" -Force -ErrorAction Stop
                Remove-Item $swapOldPath -Force -ErrorAction SilentlyContinue
                $success = $true
                "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [SUCCESS] Successfully replaced app.asar with native-patched version!" | Out-File -FilePath $logPath -Append -Encoding utf8
                break
            } catch {
                "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [RETRY $i] Lock contention or error: $($_.Exception.Message)" | Out-File -FilePath $logPath -Append -Encoding utf8
                if ((-not (Test-Path $asarPath)) -and (Test-Path $swapOldPath)) {
                    Rename-Item -Path $swapOldPath -NewName "app.asar" -Force -ErrorAction SilentlyContinue
                }
            }
        }
        break
    }
}

schtasks /delete /tn "AntigravityMonitorSwap" /f 2>&1 | Out-Null
