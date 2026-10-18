Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

localAppData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
asarPath = localAppData & "\Programs\antigravity\resources\app.asar"
stagedPath = localAppData & "\Programs\antigravity\resources\app.asar.staged"
swapOld = localAppData & "\Programs\antigravity\resources\app.asar.swap-old"

If Not fso.FileExists(stagedPath) Then
    WScript.Quit 0
End If

' 循环等待 Antigravity 退出
Do
    Set procList = GetObject("winmgmts:").ExecQuery("SELECT ProcessId FROM Win32_Process WHERE Name = 'Antigravity.exe'")
    If procList.Count = 0 Then
        Exit Do
    End If
    WScript.Sleep 300
Loop

' Antigravity 已退出，执行原子替换
On Error Resume Next
For i = 1 To 10
    Err.Clear
    If fso.FileExists(asarPath) Then
        If fso.FileExists(swapOld) Then fso.DeleteFile swapOld, True
        fso.MoveFile asarPath, swapOld
    End If
    fso.MoveFile stagedPath, asarPath
    If Err.Number = 0 Then
        If fso.FileExists(swapOld) Then fso.DeleteFile swapOld, True
        Exit For
    End If
    WScript.Sleep 200
Next
