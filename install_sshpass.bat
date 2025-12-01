@echo off
echo Installing sshpass alternative for Windows...
powershell -Command "Invoke-WebRequest -Uri https://github.com/PowerShell/Win32-OpenSSH/releases/download/v8.1.0.0p1-Beta/OpenSSH-Win64.zip -OutFile openssh.zip"
powershell -Command "Expand-Archive -Path openssh.zip -DestinationPath ."
echo Done!