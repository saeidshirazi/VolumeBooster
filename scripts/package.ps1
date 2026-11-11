$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$extensionRoot = Join-Path $projectRoot 'extension'
$outputRoot = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
Compress-Archive -Path (Join-Path $extensionRoot '*') -DestinationPath (Join-Path $outputRoot 'VolumeBooster-Chrome.zip') -Force
Write-Output (Join-Path $outputRoot 'VolumeBooster-Chrome.zip')
