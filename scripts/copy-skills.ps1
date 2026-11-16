[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Manifest,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$OutputFolder
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js 18.17+ is required. Install it, then run npm ci in the skills repository.'
}

& node (Join-Path $PSScriptRoot 'copy-skills.mjs') $Manifest $OutputFolder
exit $LASTEXITCODE
