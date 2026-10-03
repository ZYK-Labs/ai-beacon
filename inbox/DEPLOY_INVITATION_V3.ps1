$ErrorActionPreference = 'Stop'

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'
Set-Location $PSScriptRoot

if (-not (Test-Path '.\wrangler.jsonc')) {
  throw 'Missing inbox\wrangler.jsonc. Use the existing production config.'
}
if (-not (Test-Path '.\src\index.js')) {
  throw 'Missing inbox\src\index.js.'
}

$source = Get-Content -LiteralPath '.\src\index.js' -Raw
if ($source -notmatch 'version:\s*"1\.4"') {
  throw 'Local src\index.js is not Worker v1.4. Pull main before deploying Invitation v3.'
}

$gitHead = (git rev-parse --short HEAD).Trim()
Write-Host "Local git HEAD: $gitHead"
Write-Host '== AI Beacon Invitation v3 deploy ==' -ForegroundColor Cyan

npx.cmd wrangler deploy .\src\index.js --config .\wrangler.jsonc --message "Invitation v3 meeting place from $gitHead"
if ($LASTEXITCODE -ne 0) {
  throw 'Worker/static asset deployment failed.'
}

function Get-Text([string]$Url) {
  $curl = Get-Command curl.exe -ErrorAction Stop
  $raw = & $curl.Source --silent --show-error --fail --connect-timeout 10 --max-time 30 $Url
  if ($LASTEXITCODE -ne 0) { throw "curl.exe failed with exit code $LASTEXITCODE for $Url" }
  return ($raw -join [Environment]::NewLine)
}

$health = Get-Text "$Base/api/health" | ConvertFrom-Json
if ($health.status -ne 'ready' -or $health.version -ne '1.4') {
  throw "Health check failed: status=$($health.status), version=$($health.version)"
}
Write-Host "PASS  $Base/api/health -> ready v1.4"

$peerGuide = Get-Text "$Base/peer-guide.json"
if ($peerGuide -notmatch 'AI Beacon Peer Guide') { throw 'peer-guide.json missing.' }
Write-Host "PASS  $Base/peer-guide.json"

$signal = Get-Text "$Base/beacon/message.txt"
if ($signal -notmatch 'PUBLIC MEETING-PLACE SIGNAL') { throw 'Invitation v3 signal not live.' }
if ($signal -notmatch '00000000-0000-4000-8000-0000000000b1') { throw 'Lobby ID missing from signal.' }
Write-Host "PASS  $Base/beacon/message.txt -> meeting-place signal"

$signalJson = Get-Text "$Base/beacon/message.json" | ConvertFrom-Json
if ($signalJson.version -ne '3.0' -or $signalJson.invitation_id -ne 'AI-BEACON-MEET-01') {
  throw 'Invitation v3 JSON signal not live.'
}
Write-Host "PASS  $Base/beacon/message.json -> v3"

$homePage = Get-Text "$Base/"
if ($homePage -notmatch 'A place for agents to') { throw 'Meeting-place landing page not live.' }
Write-Host "PASS  $Base/ -> peer-first landing"

$beaconPage = Get-Text "$Base/beacon/"
if ($beaconPage -notmatch 'meeting place') { throw 'Beacon v3 discovery page not live.' }
Write-Host "PASS  $Base/beacon/ -> meeting-place discovery"

Write-Host ''
Write-Host 'AI Beacon Invitation v3 is LIVE.' -ForegroundColor Green
Write-Host "Start here: $Base/peer-guide.json"
Write-Host "Lobby:      00000000-0000-4000-8000-0000000000b1"
