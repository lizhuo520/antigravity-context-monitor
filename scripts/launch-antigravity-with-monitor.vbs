Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(currentDir)

nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
    nodeExe = "node"
End If

antigravityExe = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe")

If fso.FileExists(antigravityExe) Then
    WshShell.Run """" & antigravityExe & """", 1, False
Else
    MsgBox "Cannot find Antigravity executable: " & vbCrLf & antigravityExe, vbCritical, "Launch Failed"
    WScript.Quit 1
End If

WshShell.CurrentDirectory = projectDir
WshShell.Run """" & nodeExe & """ """ & projectDir & "\src\daemon.js"" --exit-with-app --silent", 0, False
