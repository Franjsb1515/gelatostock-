' Abre GelatoStock con los datos y los archivos temporales dentro de esta carpeta.
' Busca sola la última versión que haya en dist: así no se rompe cada vez que sube de versión
' (hasta la 0.40.0 la ruta estaba escrita a mano y dejó de existir al empaquetar la siguiente).
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = root
shell.Environment("PROCESS")("GELATO_DATA_DIR") = root & "\data"
shell.Environment("PROCESS")("TEMP") = root & "\work"
shell.Environment("PROCESS")("TMP") = root & "\work"
dist = root & "\dist"
exe = ""
If fso.FolderExists(dist) Then
  For Each carpeta In fso.GetFolder(dist).SubFolders
    candidato = carpeta.Path & "\GelatoStock.exe"
    If fso.FileExists(candidato) Then
      If exe = "" Then
        exe = candidato
        reciente = carpeta.DateLastModified
      ElseIf carpeta.DateLastModified > reciente Then
        exe = candidato
        reciente = carpeta.DateLastModified
      End If
    End If
  Next
End If
If exe = "" Then
  MsgBox "No encuentro GelatoStock.exe dentro de " & dist & "." & vbCrLf & vbCrLf & _
    "Vuelve a crear el programa desde la carpeta del proyecto con:" & vbCrLf & _
    "npm run package:win", 48, "GelatoStock"
Else
  shell.Run Chr(34) & exe & Chr(34), 1, False
End If
