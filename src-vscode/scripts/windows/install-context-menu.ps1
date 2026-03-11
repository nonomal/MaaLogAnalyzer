$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$openScript = Join-Path $scriptDir 'open-folder-in-maa-analyzer.ps1'

if (-not (Test-Path -LiteralPath $openScript)) {
  Write-Error "Missing helper script: $openScript"
  exit 1
}

$menuKey = 'HKCU:\Software\Classes\Directory\shell\MaaLogAnalyzer'
$commandKey = Join-Path $menuKey 'command'

New-Item -Path $menuKey -Force | Out-Null
New-Item -Path $commandKey -Force | Out-Null

Set-ItemProperty -Path $menuKey -Name '(default)' -Value '用 MAA Log Analyzer 分析'
Set-ItemProperty -Path $menuKey -Name 'Icon' -Value 'Code.exe'

$powershellExe = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
$command = "$powershellExe -NoProfile -ExecutionPolicy Bypass -File `"$openScript`" `"%1`""
Set-ItemProperty -Path $commandKey -Name '(default)' -Value $command

Write-Host 'Installed Windows Explorer context menu for folders.'
Write-Host 'Menu text: 用 MAA Log Analyzer 分析'
