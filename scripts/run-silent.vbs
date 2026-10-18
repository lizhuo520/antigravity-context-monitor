Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(currentDir)

nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
    nodeExe = "node"
End If

WshShell.CurrentDirectory = projectDir
WshShell.Run """" & nodeExe & """ """ & projectDir & "\src\daemon.js"" --silent", 0, False
