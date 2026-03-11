param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$TargetPath
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $TargetPath)) {
  exit 1
}

$resolved = (Resolve-Path -LiteralPath $TargetPath).Path
$lower = $resolved.ToLowerInvariant()
$route = 'analyze-folder'

if (Test-Path -LiteralPath $resolved -PathType Leaf) {
  if ($lower.EndsWith('.log') -or $lower.EndsWith('.jsonl') -or $lower.EndsWith('.txt') -or $lower.EndsWith('.zip')) {
    $route = 'analyze-file'
  } else {
    exit 1
  }
}

$bytes = [System.Text.Encoding]::UTF8.GetBytes($resolved)
$base64 = [Convert]::ToBase64String($bytes)
$uri = "vscode://windsland52.maa-log-analyzer/open/$route/$base64"

Start-Process -FilePath $uri | Out-Null
