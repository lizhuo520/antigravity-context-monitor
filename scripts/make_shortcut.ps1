$sh = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Antigravity (Monitor).lnk'
$vbs = 'C:\Users\Lizhuo\.gemini\antigravity\scratch\antigravity-context-monitor\scripts\launch-antigravity-with-monitor.vbs'
$dir = 'C:\Users\Lizhuo\.gemini\antigravity\scratch\antigravity-context-monitor'
$icon = 'C:\Users\Lizhuo\AppData\Local\Programs\antigravity\Antigravity.exe,0'

$shortcut = $sh.CreateShortcut($lnkPath)
$shortcut.TargetPath = 'wscript.exe'
$shortcut.Arguments = '"' + $vbs + '"'
$shortcut.WorkingDirectory = $dir
$shortcut.IconLocation = $icon
$shortcut.Save()
Write-Host "Created shortcut: $lnkPath"
