$ErrorActionPreference = 'Stop'

$menuKey = 'HKCU:\Software\Classes\Directory\shell\MaaLogAnalyzer'

if (Test-Path $menuKey) {
  Remove-Item -Path $menuKey -Recurse -Force
  Write-Host 'Removed Windows Explorer context menu: MaaLogAnalyzer'
} else {
  Write-Host 'Context menu not found. Nothing to remove.'
}
