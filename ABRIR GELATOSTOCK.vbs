Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
shell.Environment("PROCESS")("GELATO_DATA_DIR") = root & "\data"
shell.Environment("PROCESS")("TEMP") = root & "\work"
shell.Environment("PROCESS")("TMP") = root & "\work"
shell.Run Chr(34) & root & "\dist\GelatoStock-0.33.0-win32-x64\GelatoStock.exe" & Chr(34), 1, False
