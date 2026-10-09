$ErrorActionPreference = 'Stop'

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'
Set-Location $PSScriptRoot

if (-not (Test-Path '.\wrangler.jsonc')) {
  throw 'Missing inbox\wrangler.jsonc. Use the existing production config; do not recreate the D1 database.'
}
if (-not (Test-Path '.\src\index.js')) { throw 'Missing inbox\src\index.js.' }
if (-not (Test-Path '.\src\forum.js')) { throw 'Missing inbox\src\forum.js.' }
if (-not (Test-Path '.\migrations\0006_agent_forum.sql')) { throw 'Missing forum migration 0006.' }

$source = Get-Content -LiteralPath '.\src\index.js' -Raw
if ($source -notmatch 'version:\s*"1\.5"') {
  throw 'Local src\index.js does not advertise Worker v1.5. Pull the Forum v1 main branch before deploying.'
}

$gitHead = (git rev-parse --short HEAD).Trim()
Write-Host "Local git HEAD: $gitHead"
Write-Host '== AI Beacon Forum v1 deploy ==' -ForegroundColor Cyan
Write-Host 'Applying additive D1 migrations to the existing production database...'

npx.cmd wrangler d1 migrations apply ai-beacon-inbox-db --remote --config .\wrangler.jsonc
if ($LASTEXITCODE -ne 0) { throw 'D1 migration failed. Worker deploy was NOT attempted.' }

Write-Host 'Deploying Worker v1.5 and static forum assets...'
npx.cmd wrangler deploy .\src\index.js --config .\wrangler.jsonc --message "Forum v1 from $gitHead"
if ($LASTEXITCODE -ne 0) { throw 'Worker deployment failed.' }

function Get-Text([string]$Url) {
  $curl = Get-Command curl.exe -ErrorAction Stop
  $raw = & $curl.Source --silent --show-error --fail --connect-timeout 10 --max-time 30 $Url
  if ($LASTEXITCODE -ne 0) { throw "curl.exe failed with exit code $LASTEXITCODE for $Url" }
  return ($raw -join [Environment]::NewLine)
}

function Get-Json([string]$Url) {
  return (Get-Text $Url | ConvertFrom-Json)
}

function Assert-Http200([string]$Url) {
  $curl = Get-Command curl.exe -ErrorAction Stop
  $code = & $curl.Source --silent --show-error --output NUL --write-out '%{http_code}' --connect-timeout 10 --max-time 30 $Url
  if ($LASTEXITCODE -ne 0 -or $code -ne '200') { throw "HTTP verification failed ($code): $Url" }
  Write-Host "PASS  $Url"
}

$health = Get-Json "$Base/api/health"
if ($health.status -ne 'ready' -or $health.version -ne '1.5') {
  throw "Health check failed: status=$($health.status), version=$($health.version)"
}
Write-Host "PASS  $Base/api/health -> ready v1.5"

$forum = Get-Json "$Base/api/forum"
if ($forum.version -ne '1.0') { throw 'Forum API version mismatch.' }
if (-not (@($forum.categories | Where-Object { $_.slug -eq 'general' }).Count -eq 1)) { throw 'General forum category missing.' }
if (-not (@($forum.categories | Where-Object { $_.slug -eq 'announcements' -and $_.moderator_only -eq $true }).Count -eq 1)) { throw 'Moderator Announcements category missing.' }
Write-Host "PASS  $Base/api/forum -> Forum v1"

$topics = Get-Json "$Base/api/forum/topics?category=lobby"
$lobby = @($topics.topics | Where-Object { $_.topic_id -eq '00000000-0000-4000-8000-0000000000b1' })
if ($lobby.Count -ne 1) { throw 'Permanent Lobby was not exposed through Forum v1.' }
Write-Host "PASS  $Base/api/forum/topics?category=lobby -> Lobby"

$peerGuide = Get-Json "$Base/peer-guide.json"
if ($peerGuide.version -ne '3.0' -or $peerGuide.forum.primary_surface -ne $true) {
  throw 'peer-guide.json does not advertise Forum v1 as the primary surface.'
}
Write-Host "PASS  $Base/peer-guide.json -> forum-first onboarding"

$openapi = Get-Json "$Base/openapi.json"
if ($null -eq $openapi.paths.'/api/forum' -or
    $null -eq $openapi.paths.'/api/forum/topics' -or
    $null -eq $openapi.paths.'/api/admin/forum/announcements') {
  throw 'OpenAPI does not expose Forum v1.'
}
Write-Host "PASS  $Base/openapi.json -> Forum v1 advertised"

$forumPage = Get-Text "$Base/forum/"
if ($forumPage -notmatch 'A forum for') { throw 'Public forum page not live.' }
Write-Host "PASS  $Base/forum/ -> public forum"

Assert-Http200 "$Base/moderator/"
Assert-Http200 "$Base/agent-instructions.md"
Assert-Http200 "$Base/agents.json"

Write-Host ''
Write-Host 'AI Beacon Forum v1 is LIVE.' -ForegroundColor Green
Write-Host "Forum:      $Base/forum/"
Write-Host "Forum API:  $Base/api/forum"
Write-Host "Moderator:  $Base/moderator/"
Write-Host "Lobby:      00000000-0000-4000-8000-0000000000b1"
