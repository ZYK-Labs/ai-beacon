$ErrorActionPreference = 'Stop'

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'
Set-Location $PSScriptRoot

if (-not (Test-Path '.\wrangler.jsonc')) {
  throw 'Missing inbox\wrangler.jsonc. Use the existing production config.'
}
if (-not (Test-Path '.\src\index.js')) { throw 'Missing inbox\src\index.js.' }
if (-not (Test-Path '.\src\forum.js')) { throw 'Missing inbox\src\forum.js.' }
if (-not (Test-Path '.\public\forum\forum.js')) { throw 'Missing inbox\public\forum\forum.js.' }

$source = Get-Content -LiteralPath '.\src\index.js' -Raw
if ($source -notmatch 'version:\s*"1\.5"') {
  throw 'Local src\index.js does not advertise Worker v1.5.'
}

$forumSource = Get-Content -LiteralPath '.\src\forum.js' -Raw
if ($forumSource -notmatch 'browser_url') {
  throw 'Local Forum backend does not contain Forum v1.1 browser_url receipts.'
}

$forumUi = Get-Content -LiteralPath '.\public\forum\forum.js' -Raw
if ($forumUi -notmatch 'routeFromUrl' -or $forumUi -notmatch 'Copy permalink') {
  throw 'Local Forum UI does not contain Forum v1.1 permalink routing.'
}

$gitHead = (git rev-parse --short HEAD).Trim()
Write-Host "Local git HEAD: $gitHead"
Write-Host '== AI Beacon Forum v1.1 deploy (no schema change) ==' -ForegroundColor Cyan
Write-Host 'Precondition: production D1 migration 0006 is already applied.'

npx.cmd wrangler deploy .\src\index.js --config .\wrangler.jsonc --message "Forum v1.1 from $gitHead"
if ($LASTEXITCODE -ne 0) { throw 'Worker deployment failed.' }

function CurlArgs([string]$Url) {
  return @('--ssl-no-revoke','--silent','--show-error','--fail','--connect-timeout','10','--max-time','30',$Url)
}

function Get-Text([string]$Url) {
  $curl = Get-Command curl.exe -ErrorAction Stop
  $raw = & $curl.Source @(CurlArgs $Url)
  if ($LASTEXITCODE -ne 0) { throw "curl.exe failed with exit code $LASTEXITCODE for $Url" }
  return ($raw -join [Environment]::NewLine)
}

function Get-Json([string]$Url) {
  return (Get-Text $Url | ConvertFrom-Json)
}

$health = Get-Json "$Base/api/health"
if ($health.status -ne 'ready' -or $health.version -ne '1.5') {
  throw "Health check failed: status=$($health.status), version=$($health.version)"
}
Write-Host "PASS  $Base/api/health -> ready v1.5"

$forum = Get-Json "$Base/api/forum"
if ($forum.version -ne '1.0') { throw 'Forum API version mismatch.' }
Write-Host "PASS  $Base/api/forum -> Forum API v1"

$liveJs = Get-Text "$Base/forum/forum.js"
if ($liveJs -notmatch 'routeFromUrl' -or $liveJs -notmatch 'Copy permalink') {
  throw 'Live Forum UI does not contain permalink routing.'
}
Write-Host "PASS  $Base/forum/forum.js -> permalink router live"

$deepLink = "$Base/forum/?topic=00000000-0000-4000-8000-0000000000b1"
$deepPage = Get-Text $deepLink
if ($deepPage -notmatch 'A forum for') { throw 'Deep-link forum page failed.' }
Write-Host "PASS  $deepLink -> public forum shell"

$staticGuide = Get-Json "$Base/peer-guide.json"
if ($staticGuide.version -ne '3.1' -or @($staticGuide.quick_start.steps).Count -ne 3) {
  throw 'Static peer guide is not v3.1 with three-step quick_start.'
}
Write-Host "PASS  $Base/peer-guide.json -> Peer Guide v3.1 quick-start"

$dynamicGuide = Get-Json "$Base/api/peer-guide?ref=deploy-check"
if ($dynamicGuide.version -ne '3.1' -or @($dynamicGuide.quick_start.steps).Count -ne 3) {
  throw 'Dynamic peer guide is not v3.1 with three-step quick_start.'
}
if ($dynamicGuide.registration.url -notmatch 'ref=deploy-check') {
  throw 'Dynamic peer guide lost deploy-check referral propagation.'
}
Write-Host "PASS  $Base/api/peer-guide?ref=deploy-check -> attributed quick-start"

Write-Host ''
Write-Host 'AI Beacon Forum v1.1 is LIVE.' -ForegroundColor Green
Write-Host "Forum: $Base/forum/"
Write-Host 'Schema: unchanged; migration 0006 remains the production schema checkpoint.'
