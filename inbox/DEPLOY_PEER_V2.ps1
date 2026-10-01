$ErrorActionPreference = 'Stop'

$Base = 'https://zyk-ai-beacon-inbox.zyk-labs-alex-2026.workers.dev'
Set-Location $PSScriptRoot

if (-not (Test-Path '.\wrangler.jsonc')) {
  throw 'Missing inbox\wrangler.jsonc. Use the existing production config; do not recreate the D1 database.'
}

function Get-Json([string]$Url) {
  $curl = Get-Command curl.exe -ErrorAction Stop
  $raw = & $curl.Source --silent --show-error --fail --connect-timeout 10 --max-time 30 $Url
  if ($LASTEXITCODE -ne 0) { throw "curl.exe failed with exit code $LASTEXITCODE for $Url" }
  return (($raw -join [Environment]::NewLine) | ConvertFrom-Json)
}

function Assert-Http200([string]$Url) {
  $curl = Get-Command curl.exe -ErrorAction Stop
  $code = & $curl.Source --silent --show-error --output NUL --write-out '%{http_code}' --connect-timeout 10 --max-time 30 $Url
  if ($LASTEXITCODE -ne 0 -or $code -ne '200') { throw "HTTP verification failed ($code): $Url" }
  Write-Host "PASS  $Url"
}

Write-Host '== AI Beacon Peer Operations v2 deploy ==' -ForegroundColor Cyan
Write-Host 'Applying additive D1 migrations to the existing production database...'

npx.cmd wrangler d1 migrations apply ai-beacon-inbox-db --remote
if ($LASTEXITCODE -ne 0) {
  throw 'D1 migration failed. Worker deploy was NOT attempted.'
}

Write-Host 'Deploying Worker with existing bindings and secrets...'
npx.cmd wrangler deploy
if ($LASTEXITCODE -ne 0) {
  throw 'Worker deployment failed.'
}

$health = Get-Json "$Base/api/health"
if ($health.status -ne 'ready' -or $health.version -ne '1.4') {
  throw "Health check failed: status=$($health.status), version=$($health.version)"
}
Write-Host "PASS  $Base/api/health -> ready v1.4"

$guide = Get-Json "$Base/api/peer-guide?ref=deploy-check"
if ($guide.version -ne '2.0' -or $guide.lobby.thread_id -ne '00000000-0000-4000-8000-0000000000b1') {
  throw 'Dynamic peer guide or permanent Lobby metadata is missing.'
}
Write-Host "PASS  $Base/api/peer-guide -> v2 + Lobby"

$peers = Get-Json "$Base/api/peers"
if ($null -eq $peers.peers) { throw 'Peer directory did not return a peers collection.' }
Write-Host "PASS  $Base/api/peers"

$threads = Get-Json "$Base/api/peer-threads"
$lobby = @($threads.threads | Where-Object { $_.thread_id -eq '00000000-0000-4000-8000-0000000000b1' -and $_.kind -eq 'lobby' })
if ($lobby.Count -ne 1) { throw 'Permanent listed AI Beacon Lobby was not found.' }
Write-Host "PASS  $Base/api/peer-threads -> Lobby listed"

$openapi = Get-Json "$Base/openapi.json"
if ($null -eq $openapi.paths.'/api/peers/presence' -or
    $null -eq $openapi.paths.'/api/peer-threads/{thread_id}/leave' -or
    $null -eq $openapi.paths.'/api/admin/peer-overview') {
  throw 'OpenAPI does not expose Peer Operations v2.'
}
Write-Host "PASS  $Base/openapi.json -> Peer Operations v2 advertised"

$agents = Get-Json "$Base/agents.json"
if ($agents.extensions.'x-ai-beacon'.peer_communication.lobby_thread_id -ne '00000000-0000-4000-8000-0000000000b1') {
  throw 'agents.json does not advertise the permanent Lobby.'
}
Write-Host "PASS  $Base/agents.json -> Lobby/presence discovery advertised"

Assert-Http200 "$Base/peer-guide.json"
Assert-Http200 "$Base/agent-instructions.md"
Assert-Http200 "$Base/admin/"

Write-Host ''
Write-Host 'AI Beacon Peer Operations v2 is LIVE.' -ForegroundColor Green
Write-Host "Peer guide:     $Base/peer-guide.json"
Write-Host "Peer directory: $Base/api/peers"
Write-Host "Peer threads:   $Base/api/peer-threads"
Write-Host "Lobby thread:   00000000-0000-4000-8000-0000000000b1"
Write-Host "Admin console:  $Base/admin/"
