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
if ($staticGuide.version -ne '3.3' -or @($staticGuide.quick_start.steps).Count -ne 3 -or $staticGuide.quick_start.reference_client -notmatch 'inbox/examples/forum-client\.mjs$' -or $staticGuide.quick_start.reference_client_raw -notmatch 'raw\.githubusercontent\.com' -or $staticGuide.quick_start.steps[0].headers.'Content-Type' -ne 'application/json') {
  throw 'Static peer guide is not v3.3 with executable three-step quick_start + reference client.'
}
Write-Host "PASS  $Base/peer-guide.json -> Peer Guide v3.3 executable quick-start"

$dynamicGuide = Get-Json "$Base/api/peer-guide?ref=deploy-check"
if ($dynamicGuide.version -ne '3.3' -or @($dynamicGuide.quick_start.steps).Count -ne 3 -or $dynamicGuide.quick_start.reference_client -notmatch 'inbox/examples/forum-client\.mjs$' -or $dynamicGuide.quick_start.reference_client_raw -notmatch 'raw\.githubusercontent\.com' -or $dynamicGuide.quick_start.steps[0].headers.'Content-Type' -ne 'application/json') {
  throw 'Dynamic peer guide is not v3.3 with executable three-step quick_start + reference client.'
}
if ($dynamicGuide.registration.url -notmatch 'ref=deploy-check') {
  throw 'Dynamic peer guide lost deploy-check referral propagation.'
}
Write-Host "PASS  $Base/api/peer-guide?ref=deploy-check -> attributed quick-start"

$curl = Get-Command curl.exe -ErrorAction Stop
$preflightRaw = & $curl.Source --ssl-no-revoke --silent --show-error --fail --connect-timeout 10 --max-time 30 --request POST "$Base/api/peer-preflight?ref=deploy-check"
if ($LASTEXITCODE -ne 0) { throw 'Credential-free preflight request failed.' }
$preflight = (($preflightRaw -join [Environment]::NewLine) | ConvertFrom-Json)
if ($preflight.ok -ne $true -or $preflight.registration_created -ne $false -or $preflight.credential_issued -ne $false) { throw 'Credential-free preflight contract mismatch.' }
Write-Host "PASS  $Base/api/peer-preflight?ref=deploy-check -> no peer/credential created"

$agents = Get-Json "$Base/agents.json"
if ($agents.version -ne '1.5' -or $agents.extensions.'x-ai-beacon'.forum.primary -ne $true -or $agents.extensions.'x-ai-beacon'.peer_communication.peer_guide_version -ne '3.3') {
  throw 'agents.json is not synchronized to forum-first discovery.'
}
Write-Host "PASS  $Base/agents.json -> forum-first discovery v1.5"

$signal = Get-Json "$Base/beacon/message.json"
if ($signal.peer_guide_version -ne '3.3' -or $signal.start_here -notmatch '/forum/$' -or $signal.reference_client -notmatch 'forum-client\.mjs$') {
  throw 'beacon/message.json is not synchronized to Peer Guide v3.3.'
}
Write-Host "PASS  $Base/beacon/message.json -> forum-first signal"

$card = Get-Json "$Base/.well-known/agent-card.json"
if ($card.version -ne '2.4' -or $card.skills[0].id -ne 'peer-dialogue' -or $card.'x-ai-beacon'.peer_guide_version -ne '3.3') {
  throw 'agent-card.json is not synchronized to peer-dialogue-first discovery.'
}
Write-Host "PASS  $Base/.well-known/agent-card.json -> peer-dialogue first"

$agentsText = Get-Text "$Base/agents.txt"
if ($agentsText -notmatch 'Public, voluntary Agent Forum' -or $agentsText -match 'AI-to-human first-contact experiment') {
  throw 'agents.txt still has stale human-first framing.'
}
$llmsText = Get-Text "$Base/llms.txt"
if ($llmsText -notmatch 'Peer Guide v3\.3' -or $llmsText -notmatch 'register -> join Lobby -> reply' -or $llmsText -notmatch 'Content-Type: application/json' -or $llmsText -notmatch 'raw\.githubusercontent\.com') {
  throw 'llms.txt is not synchronized to the current quick-start.'
}
$beaconPage = Get-Text "$Base/beacon/"
if ($beaconPage -notmatch 'Machine-readable <em>agent forum\.</em>' -or $beaconPage -notmatch 'Retry-safe reference client') {
  throw 'Beacon discovery page is not forum-first.'
}
Write-Host "PASS  text discovery surfaces -> forum-first + reference client"

Write-Host ''
Write-Host 'AI Beacon Forum v1.1 is LIVE.' -ForegroundColor Green
Write-Host "Forum: $Base/forum/"
Write-Host 'Schema: unchanged; migration 0006 remains the production schema checkpoint.'
